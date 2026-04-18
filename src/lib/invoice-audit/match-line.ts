import { Prisma } from "@prisma/client";

import { DISCREPANCY_CATEGORY } from "@/lib/invoice-audit/discrepancy-categories";
import type { SnapshotPriceCandidate } from "@/lib/invoice-audit/snapshot-candidates";

export type LineAuditComputed = {
  outcome: "GREEN" | "AMBER" | "RED" | "UNKNOWN";
  discrepancyCategories: string[];
  expectedAmount: Prisma.Decimal | null;
  amountVariance: Prisma.Decimal | null;
  percentVariance: Prisma.Decimal | null;
  snapshotMatchedJson: Prisma.InputJsonValue | null;
  explanation: string;
  toleranceRuleId: string | null;
};

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenOverlapScore(invoiceText: string, candidateLabel: string): number {
  const a = new Set(normalizeText(invoiceText).split(" ").filter((t) => t.length > 1));
  const b = new Set(normalizeText(candidateLabel).split(" ").filter((t) => t.length > 1));
  if (a.size === 0 || b.size === 0) return 0;
  let hit = 0;
  for (const t of a) {
    if (b.has(t)) hit += 1;
  }
  const ni = normalizeText(invoiceText);
  const nc = normalizeText(candidateLabel);
  if (ni.length > 0 && nc.length > 0 && (ni.includes(nc) || nc.includes(ni))) hit += 2;
  return hit;
}

function pickBestCandidates(
  invoiceDescription: string,
  normalizedLabel: string | null,
  candidates: SnapshotPriceCandidate[],
): { best: SnapshotPriceCandidate[]; score: number } {
  const needle = [normalizedLabel, invoiceDescription].filter(Boolean).join(" ");
  let bestScore = 0;
  const best: SnapshotPriceCandidate[] = [];
  for (const c of candidates) {
    const s = Math.max(
      tokenOverlapScore(invoiceDescription, c.label),
      normalizedLabel ? tokenOverlapScore(normalizedLabel, c.label) : 0,
      tokenOverlapScore(needle, c.label),
    );
    if (s > bestScore) {
      best.length = 0;
      best.push(c);
      bestScore = s;
    } else if (s === bestScore && s > 0) {
      best.push(c);
    }
  }
  return { best, score: bestScore };
}

export function auditInvoiceLineAgainstCandidates(params: {
  invoiceLine: {
    rawDescription: string;
    normalizedLabel: string | null;
    currency: string;
    amount: Prisma.Decimal;
  };
  candidates: SnapshotPriceCandidate[];
  amountAbsTolerance: number;
  percentTolerance: number;
  toleranceRuleId: string | null;
}): LineAuditComputed {
  const invCur = params.invoiceLine.currency.toUpperCase().slice(0, 3);
  const actual = Number(params.invoiceLine.amount);

  const { best, score } = pickBestCandidates(
    params.invoiceLine.rawDescription,
    params.invoiceLine.normalizedLabel,
    params.candidates,
  );

  if (best.length === 0 || score <= 0) {
    return {
      outcome: "UNKNOWN",
      discrepancyCategories: [DISCREPANCY_CATEGORY.NO_SNAPSHOT_LINE_MATCH],
      expectedAmount: null,
      amountVariance: null,
      percentVariance: null,
      snapshotMatchedJson: null,
      explanation:
        "No snapshot line scored above the minimum text match threshold. Check charge descriptions or snapshot contents.",
      toleranceRuleId: params.toleranceRuleId,
    };
  }

  if (best.length > 1) {
    const top = best.slice(0, 3).map((c) => `${c.kind}:${c.label}`);
    return {
      outcome: "AMBER",
      discrepancyCategories: [DISCREPANCY_CATEGORY.AMBIGUOUS_SNAPSHOT_MATCH],
      expectedAmount: null,
      amountVariance: null,
      percentVariance: null,
      snapshotMatchedJson: { ambiguousCandidates: top },
      explanation: `Multiple snapshot lines tied for best text match (${best.length}). Narrow labels or split invoice lines.`,
      toleranceRuleId: params.toleranceRuleId,
    };
  }

  const match = best[0]!;
  if (match.currency !== invCur) {
    return {
      outcome: "UNKNOWN",
      discrepancyCategories: [DISCREPANCY_CATEGORY.CURRENCY_MISMATCH],
      expectedAmount: new Prisma.Decimal(String(match.amount)),
      amountVariance: new Prisma.Decimal(String(Math.abs(actual - match.amount))),
      percentVariance: null,
      snapshotMatchedJson: { kind: match.kind, id: match.id, label: match.label, currency: match.currency },
      explanation: `Invoice line currency ${invCur} does not match snapshot line currency ${match.currency}.`,
      toleranceRuleId: params.toleranceRuleId,
    };
  }

  const expected = match.amount;
  const variance = Math.abs(actual - expected);
  const threshold = Math.max(
    params.amountAbsTolerance,
    Math.abs(expected) * params.percentTolerance,
  );
  const warnThreshold = threshold * 2;

  const matchedJson: Prisma.InputJsonValue = {
    kind: match.kind,
    id: match.id,
    label: match.label,
    currency: match.currency,
    expectedAmount: expected,
    invoiceAmount: actual,
  };

  if (variance <= threshold) {
    return {
      outcome: "GREEN",
      discrepancyCategories: [DISCREPANCY_CATEGORY.AMOUNT_MATCH_WITHIN_TOLERANCE],
      expectedAmount: new Prisma.Decimal(String(expected)),
      amountVariance: new Prisma.Decimal(String(variance)),
      percentVariance:
        expected !== 0 ? new Prisma.Decimal(String(variance / Math.abs(expected))) : new Prisma.Decimal(0),
      snapshotMatchedJson: matchedJson,
      explanation: `Matched "${match.label}" within tolerance (Δ=${variance.toFixed(4)}, threshold≈${threshold.toFixed(4)}).`,
      toleranceRuleId: params.toleranceRuleId,
    };
  }

  if (variance <= warnThreshold) {
    return {
      outcome: "AMBER",
      discrepancyCategories: [DISCREPANCY_CATEGORY.AMOUNT_MINOR_DISCREPANCY],
      expectedAmount: new Prisma.Decimal(String(expected)),
      amountVariance: new Prisma.Decimal(String(variance)),
      percentVariance: new Prisma.Decimal(String(variance / Math.abs(expected || 1))),
      snapshotMatchedJson: matchedJson,
      explanation: `Matched "${match.label}" but amount exceeds primary tolerance yet stays within warn band (Δ=${variance.toFixed(4)}).`,
      toleranceRuleId: params.toleranceRuleId,
    };
  }

  return {
    outcome: "RED",
    discrepancyCategories: [DISCREPANCY_CATEGORY.AMOUNT_MAJOR_DISCREPANCY],
    expectedAmount: new Prisma.Decimal(String(expected)),
    amountVariance: new Prisma.Decimal(String(variance)),
    percentVariance: new Prisma.Decimal(String(variance / Math.abs(expected || 1))),
    snapshotMatchedJson: matchedJson,
    explanation: `Matched "${match.label}" but invoice amount differs materially from snapshot (Δ=${variance.toFixed(4)}).`,
    toleranceRuleId: params.toleranceRuleId,
  };
}
