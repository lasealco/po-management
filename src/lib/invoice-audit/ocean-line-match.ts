import { Prisma } from "@prisma/client";

import { DISCREPANCY_CATEGORY } from "@/lib/invoice-audit/discrepancy-categories";
import { buildContractOceanBasket, rfqAllInReferenceTotal } from "@/lib/invoice-audit/ocean-basket";
import { equipmentMatches, normalizeEquipmentKey, parseEquipmentFromText } from "@/lib/invoice-audit/ocean-equipment";
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

export type InvoiceChargeAliasRow = {
  pattern: string;
  canonicalTokens: string[];
  targetKind: string | null;
  priority: number;
};

/**
 * Outcome rules (commercial matching, ocean):
 * - UNKNOWN: No eligible snapshot target (empty basket, no candidates after hard filters, or best score < MIN_CONFIDENCE_SCORE), or currency mismatch.
 * - AMBER: Target identified but confidence is borderline (ties within epsilon), soft commercial mismatches (unit basis, geography scope vs POL/POD), warn-band amount vs expected, or all-in basket minor variance.
 * - RED: Target identified with sufficient confidence and amount outside warn band (major variance vs matched line or basket).
 * - GREEN: Dominant target, aligned commercial keys within tolerance rules, amount within primary tolerance.
 */
const MIN_CONFIDENCE_SCORE = 5;
const SCORE_TIE_EPSILON = 1.25;

const ALL_IN_RE =
  /\b(all[\s-]?in|allin|lump[\s-]?sum|lumpsum|package\s+rate|flat\s+rate|port[\s-]to[\s-]port|total\s+ocean|ocean\s+freight\s+only|fcl\s+package|door\s+to\s+port\s+package|sea\s+freight|carrier\s+freight|main\s+leg|freight\s+all\s+inclusive|all\s+inclusive\s+freight)\b/i;

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Appends canonical ocean-freight tokens implied by carrier-style wording so token/alias
 * scoring works when invoices omit standard abbreviations (e.g. "Terminal handling" → THC).
 */
function expandOceanSynonymAppendix(combined: string): string {
  const lower = combined.toLowerCase();
  const parts: string[] = [];
  if (
    /\bthc\b|terminal\s+handling|cargo\s+handling|port\s+handling|wharf\s+handling|stevedor|stevedore|origin\s+handling|destination\s+handling|\bdthc\b|\bothc\b|wharfage\b/i.test(
      lower,
    )
  ) {
    parts.push("thc terminal handling");
  }
  if (/\bbaf\b|bunker\b|baf\s+surcharge/i.test(lower)) {
    parts.push("baf bunker adjustment");
  }
  if (/\bcaf\b|currency\s+(adjustment|surcharge)|curr\s+surcharge/i.test(lower)) {
    parts.push("caf currency adjustment");
  }
  if (/\blss\b|low\s+sulphur|low\s+sulfur|\bemo\b/i.test(lower)) {
    parts.push("lss low sulphur");
  }
  if (/\bpss\b|peak\s+season/i.test(lower)) {
    parts.push("pss peak season");
  }
  if (/\bisps\b|security\s+surcharge|port\s+security/i.test(lower)) {
    parts.push("isps security");
  }
  if (/\bbl\s*fee|b\/l\s*fee|bill\s+of\s+lading|documentation\s+fee|doc\s+fee|surrender\s+fee/i.test(lower)) {
    parts.push("documentation bl fee");
  }
  if (/\b(base\s+rate|sea\s+freight|ocean\s+rate|carrier\s+ocean|main\s+leg|fcl\s+freight)\b/i.test(lower)) {
    parts.push("ocean freight fak base rate");
  }
  return parts.join(" ");
}

function normalizeUnitBasis(s: string | null | undefined): string | null {
  if (!s?.trim()) return null;
  return s.replace(/[_\s]+/g, "").toUpperCase();
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

function aliasAugmentedText(
  rawDescription: string,
  normalizedLabel: string | null,
  aliases: InvoiceChargeAliasRow[],
): string {
  const base = normalizeText([normalizedLabel, rawDescription].filter(Boolean).join(" "));
  const extra: string[] = [];
  const sorted = [...aliases].sort((a, b) => b.priority - a.priority);
  for (const a of sorted) {
    const p = a.pattern.trim().toLowerCase();
    if (!p || !base.includes(p)) continue;
    for (const t of a.canonicalTokens) {
      if (t.trim()) extra.push(t.trim().toLowerCase());
    }
  }
  return [base, ...extra].join(" ");
}

function polPodScore(
  pol: string | null,
  pod: string | null,
  c: SnapshotPriceCandidate,
): { delta: number; suppressGeoSoftFlag: boolean } {
  let delta = 0;
  let suppressGeoSoftFlag = false;
  const polU = pol?.trim().toUpperCase() || null;
  const podU = pod?.trim().toUpperCase() || null;
  if (polU && c.kind === "CONTRACT_RATE") {
    if (c.originCode && c.originCode === polU) delta += 5;
    else if (c.originCode && c.originCode.length >= 4) {
      delta -= 6;
      suppressGeoSoftFlag = true;
    }
  }
  if (podU && c.kind === "CONTRACT_RATE") {
    if (c.destCode && c.destCode === podU) delta += 4;
    else if (c.destCode && c.destCode.length >= 4) delta -= 3;
  }
  if (polU && c.kind === "CONTRACT_CHARGE" && c.originCode) {
    if (c.originCode === polU) delta += 3;
  }
  if (podU && c.kind === "CONTRACT_CHARGE" && c.originCode && c.originCode === podU) {
    delta += 2;
  }
  if (polU && c.kind === "RFQ_LINE" && c.originCode && c.originCode === polU) {
    delta += 3;
  }
  if (podU && c.kind === "RFQ_LINE" && c.destCode && c.destCode === podU) {
    delta += 2;
  }
  return { delta, suppressGeoSoftFlag };
}

function scoreCandidate(
  c: SnapshotPriceCandidate,
  augmentedInvoiceText: string,
  invoiceUnit: string | null,
  invoiceEqKey: string | null,
  aliases: InvoiceChargeAliasRow[],
  pol: string | null,
  pod: string | null,
): { score: number; unitSoftMismatch: boolean; geoSoftPenalty: boolean } {
  let score = tokenOverlapScore(augmentedInvoiceText, c.label) * 2.8;

  const labNorm = normalizeText(c.label);
  for (const a of aliases) {
    if (a.targetKind && a.targetKind !== c.kind) continue;
    const p = a.pattern.trim().toLowerCase();
    if (!p || !normalizeText(augmentedInvoiceText).includes(p)) continue;
    for (const t of a.canonicalTokens) {
      if (!t.trim()) continue;
      const tn = normalizeText(t);
      if (!tn) continue;
      if (labNorm.includes(tn)) {
        score += 3.5;
        continue;
      }
      for (const w of tn.split(" ").filter((x) => x.length > 2)) {
        if (labNorm.includes(w)) score += 2.2;
      }
    }
  }

  const eqM = equipmentMatches(invoiceEqKey, c.equipmentHint);
  if (c.kind === "CONTRACT_RATE") {
    if (invoiceEqKey && c.equipmentHint && eqM === "MISMATCH") score = -999;
    else if (eqM === "MATCH") score += 6;
  } else if (c.kind === "CONTRACT_CHARGE") {
    if (invoiceEqKey && c.equipmentHint && eqM === "MISMATCH") score -= 4;
    else if (eqM === "MATCH") score += 2;
  } else if (c.kind === "RFQ_LINE") {
    if (invoiceEqKey && c.equipmentHint && eqM === "MISMATCH") score -= 3;
    else if (invoiceEqKey && c.equipmentHint && eqM === "MATCH") score += 2;
  }

  const { delta, suppressGeoSoftFlag } = polPodScore(pol, pod, c);
  score += delta;
  const geoSoftPenalty = delta < 0 && !suppressGeoSoftFlag;

  const iu = normalizeUnitBasis(invoiceUnit);
  const su = normalizeUnitBasis(c.unitBasis);
  let unitSoftMismatch = false;
  if (iu && su) {
    if (iu === su || iu.includes(su) || su.includes(iu)) score += 2;
    else {
      unitSoftMismatch = true;
      score -= 2.5;
    }
  }

  return { score, unitSoftMismatch, geoSoftPenalty: Boolean(geoSoftPenalty) };
}

function isAllInInvoiceLine(params: {
  rawDescription: string;
  chargeStructureHint: string | null | undefined;
  invoiceLineCount: number;
}): boolean {
  if (params.chargeStructureHint?.toUpperCase() === "ITEMIZED") return false;
  if (params.chargeStructureHint?.toUpperCase() === "ALL_IN") return true;
  return params.invoiceLineCount === 1 && ALL_IN_RE.test(params.rawDescription);
}

function amountOutcome(
  actual: number,
  expected: number,
  absTol: number,
  pctTol: number,
): "GREEN" | "AMBER" | "RED" {
  const variance = Math.abs(actual - expected);
  const threshold = Math.max(absTol, Math.abs(expected) * pctTol);
  const warn = threshold * 2;
  if (variance <= threshold) return "GREEN";
  if (variance <= warn) return "AMBER";
  return "RED";
}

function filterEligibleRates(
  candidates: SnapshotPriceCandidate[],
  invoiceEqKey: string | null,
): SnapshotPriceCandidate[] {
  return candidates.filter((c) => {
    if (c.kind !== "CONTRACT_RATE") return true;
    if (!invoiceEqKey || !c.equipmentHint) return true;
    return equipmentMatches(invoiceEqKey, c.equipmentHint) !== "MISMATCH";
  });
}

export function auditOceanInvoiceLine(params: {
  invoiceLine: {
    rawDescription: string;
    normalizedLabel: string | null;
    currency: string;
    amount: Prisma.Decimal;
    unitBasis: string | null;
    equipmentType: string | null;
    chargeStructureHint: string | null;
  };
  intake: { polCode: string | null; podCode: string | null };
  candidates: SnapshotPriceCandidate[];
  snapshotSourceType: string;
  rfqGrandTotal: number | null;
  /** Frozen contract `totals.grand` when extractor found it; used for all-in without equipment. */
  contractGrandTotal: number | null;
  aliases: InvoiceChargeAliasRow[];
  amountAbsTolerance: number;
  percentTolerance: number;
  toleranceRuleId: string | null;
  invoiceLineCount: number;
}): LineAuditComputed {
  const invCur = params.invoiceLine.currency.toUpperCase().slice(0, 3);
  const actual = Number(params.invoiceLine.amount);
  const invoiceEqKey =
    normalizeEquipmentKey(params.invoiceLine.equipmentType) ?? parseEquipmentFromText(params.invoiceLine.rawDescription);
  const combinedInvoiceText = [params.invoiceLine.normalizedLabel, params.invoiceLine.rawDescription]
    .filter(Boolean)
    .join(" ");
  const invoiceTextForScoring = [combinedInvoiceText, expandOceanSynonymAppendix(combinedInvoiceText)]
    .filter(Boolean)
    .join(" ");
  const augmented = aliasAugmentedText(invoiceTextForScoring, null, params.aliases);

  const allIn = isAllInInvoiceLine({
    rawDescription: params.invoiceLine.rawDescription,
    chargeStructureHint: params.invoiceLine.chargeStructureHint,
    invoiceLineCount: params.invoiceLineCount,
  });

  if (allIn) {
    let expected: number;
    let components: ReturnType<typeof buildContractOceanBasket>["components"] | ReturnType<
      typeof rfqAllInReferenceTotal
    >["components"] = [];
    let mode: string;

    if (params.snapshotSourceType === "QUOTE_RESPONSE") {
      const rfq = rfqAllInReferenceTotal({ candidates: params.candidates, breakdownGrand: params.rfqGrandTotal });
      expected = rfq.total;
      components = rfq.components;
      mode = "RFQ_ALL_IN_TOTAL";
    } else if (
      invoiceEqKey == null &&
      params.contractGrandTotal != null &&
      Number.isFinite(params.contractGrandTotal)
    ) {
      expected = params.contractGrandTotal;
      components = [
        {
          kind: "CONTRACT_SNAPSHOT_GRAND",
          id: "totals.grand",
          label: "Contract snapshot grand total (rates + charges)",
          amount: expected,
        },
      ];
      mode = "CONTRACT_BREAKDOWN_GRAND";
    } else {
      const basket = buildContractOceanBasket({ candidates: params.candidates, equipmentKey: invoiceEqKey });
      expected = basket.total;
      components = basket.components;
      mode = "CONTRACT_BASKET_SUM";
    }

    if (!Number.isFinite(expected) || components.length === 0) {
      return {
        outcome: "UNKNOWN",
        discrepancyCategories: [DISCREPANCY_CATEGORY.NO_SNAPSHOT_LINE_MATCH],
        expectedAmount: null,
        amountVariance: null,
        percentVariance: null,
        snapshotMatchedJson: { mode, reason: "NO_BASKET_COMPONENTS" },
        explanation:
          "All-in line detected but no contract rate basket or RFQ total could be built (missing equipment match or empty snapshot).",
        toleranceRuleId: params.toleranceRuleId,
      };
    }

    const cur0 = params.candidates[0]?.currency ?? invCur;
    if (cur0 !== invCur) {
      return {
        outcome: "UNKNOWN",
        discrepancyCategories: [DISCREPANCY_CATEGORY.CURRENCY_MISMATCH],
        expectedAmount: new Prisma.Decimal(String(expected)),
        amountVariance: new Prisma.Decimal(String(Math.abs(actual - expected))),
        percentVariance: null,
        snapshotMatchedJson: { mode, components },
        explanation: `Invoice currency ${invCur} does not match snapshot basket currency ${cur0}.`,
        toleranceRuleId: params.toleranceRuleId,
      };
    }

    const band = amountOutcome(actual, expected, params.amountAbsTolerance, params.percentTolerance);
    const variance = Math.abs(actual - expected);
    const matchedJson: Prisma.InputJsonValue = {
      mode,
      expectedAmount: expected,
      invoiceAmount: actual,
      components,
      decisionRulesVersion: 1,
    };

    if (band === "GREEN") {
      return {
        outcome: "GREEN",
        discrepancyCategories: [DISCREPANCY_CATEGORY.ALL_IN_BASKET_MATCH, DISCREPANCY_CATEGORY.AMOUNT_MATCH_WITHIN_TOLERANCE],
        expectedAmount: new Prisma.Decimal(String(expected)),
        amountVariance: new Prisma.Decimal(String(variance)),
        percentVariance:
          expected !== 0 ? new Prisma.Decimal(String(variance / Math.abs(expected))) : new Prisma.Decimal(0),
        snapshotMatchedJson: matchedJson,
        explanation: `All-in amount matched snapshot basket (${mode}) within tolerance (Δ=${variance.toFixed(4)}).`,
        toleranceRuleId: params.toleranceRuleId,
      };
    }
    if (band === "AMBER") {
      return {
        outcome: "AMBER",
        discrepancyCategories: [DISCREPANCY_CATEGORY.ALL_IN_BASKET_MINOR_VARIANCE],
        expectedAmount: new Prisma.Decimal(String(expected)),
        amountVariance: new Prisma.Decimal(String(variance)),
        percentVariance: new Prisma.Decimal(String(variance / Math.abs(expected || 1))),
        snapshotMatchedJson: matchedJson,
        explanation: `All-in vs snapshot basket (${mode}) is in the warn band (Δ=${variance.toFixed(4)}).`,
        toleranceRuleId: params.toleranceRuleId,
      };
    }
    return {
      outcome: "RED",
      discrepancyCategories: [DISCREPANCY_CATEGORY.ALL_IN_BASKET_MAJOR_VARIANCE],
      expectedAmount: new Prisma.Decimal(String(expected)),
      amountVariance: new Prisma.Decimal(String(variance)),
      percentVariance: new Prisma.Decimal(String(variance / Math.abs(expected || 1))),
      snapshotMatchedJson: matchedJson,
      explanation: `All-in vs snapshot basket (${mode}) exceeds warn band (Δ=${variance.toFixed(4)}).`,
      toleranceRuleId: params.toleranceRuleId,
    };
  }

  const inInvoiceCurrency = params.candidates.filter((c) => c.currency.toUpperCase().slice(0, 3) === invCur);
  if (!inInvoiceCurrency.length) {
    return {
      outcome: "UNKNOWN",
      discrepancyCategories: [DISCREPANCY_CATEGORY.CURRENCY_MISMATCH, DISCREPANCY_CATEGORY.NO_SNAPSHOT_LINE_MATCH],
      expectedAmount: null,
      amountVariance: null,
      percentVariance: null,
      snapshotMatchedJson: { invoiceCurrency: invCur, snapshotCurrencies: [...new Set(params.candidates.map((c) => c.currency))] },
      explanation: `No snapshot pricing lines use currency ${invCur} (invoice header/line currency).`,
      toleranceRuleId: params.toleranceRuleId,
    };
  }

  const pool = filterEligibleRates(inInvoiceCurrency, invoiceEqKey);

  if (!pool.length) {
    const eqKey = invoiceEqKey;
    const equipmentLikelyCause =
      Boolean(eqKey) &&
      inInvoiceCurrency.length > 0 &&
      inInvoiceCurrency.every((c) => c.kind === "CONTRACT_RATE") &&
      inInvoiceCurrency.every(
        (c) => Boolean(c.equipmentHint) && equipmentMatches(eqKey, c.equipmentHint) === "MISMATCH",
      );
    return {
      outcome: "UNKNOWN",
      discrepancyCategories: equipmentLikelyCause
        ? [DISCREPANCY_CATEGORY.EQUIPMENT_MISMATCH, DISCREPANCY_CATEGORY.NO_SNAPSHOT_LINE_MATCH]
        : [DISCREPANCY_CATEGORY.NO_SNAPSHOT_LINE_MATCH],
      expectedAmount: null,
      amountVariance: null,
      percentVariance: null,
      snapshotMatchedJson: { invoiceEquipment: invoiceEqKey, reason: "EMPTY_POOL_AFTER_FILTERS" },
      explanation: equipmentLikelyCause
        ? `No eligible snapshot lines in ${invCur}: every contract rate is for different equipment than the invoice (${invoiceEqKey}), and there are no charges/RFQ lines in this currency to score.`
        : `No snapshot lines remained in ${invCur} after filters (unexpected empty pool — check snapshot breakdown).`,
      toleranceRuleId: params.toleranceRuleId,
    };
  }

  const scored = pool.map((c) => {
    const s = scoreCandidate(
      c,
      augmented,
      params.invoiceLine.unitBasis,
      invoiceEqKey,
      params.aliases,
      params.intake.polCode,
      params.intake.podCode,
    );
    return { c, ...s };
  });

  const viable = scored.filter((x) => x.score > -100).sort((a, b) => b.score - a.score);
  if (!viable.length) {
    return {
      outcome: "UNKNOWN",
      discrepancyCategories: [DISCREPANCY_CATEGORY.MATCH_CONFIDENCE_LOW, DISCREPANCY_CATEGORY.NO_SNAPSHOT_LINE_MATCH],
      expectedAmount: null,
      amountVariance: null,
      percentVariance: null,
      snapshotMatchedJson: { topScores: [] },
      explanation:
        "No snapshot line remained after equipment and currency filtering (ocean scoring pool empty).",
      toleranceRuleId: params.toleranceRuleId,
    };
  }

  const top = viable[0]!;
  const second = viable[1];
  if (second && Math.abs(top.score - second.score) <= SCORE_TIE_EPSILON) {
    const topTwo = viable.filter((x) => Math.abs(x.score - top.score) <= SCORE_TIE_EPSILON).slice(0, 4);
    return {
      outcome: "AMBER",
      discrepancyCategories: [DISCREPANCY_CATEGORY.AMBIGUOUS_SNAPSHOT_MATCH],
      expectedAmount: null,
      amountVariance: null,
      percentVariance: null,
      snapshotMatchedJson: {
        ambiguousCandidates: topTwo.map((x) => `${x.c.kind}:${x.c.label}`),
        scores: topTwo.map((x) => x.score),
      },
      explanation: `Multiple snapshot lines tied within ε=${SCORE_TIE_EPSILON} after ocean scoring (${topTwo.length} candidates).`,
      toleranceRuleId: params.toleranceRuleId,
    };
  }

  if (top.score < MIN_CONFIDENCE_SCORE) {
    return {
      outcome: "UNKNOWN",
      discrepancyCategories: [DISCREPANCY_CATEGORY.MATCH_CONFIDENCE_LOW, DISCREPANCY_CATEGORY.NO_SNAPSHOT_LINE_MATCH],
      expectedAmount: null,
      amountVariance: null,
      percentVariance: null,
      snapshotMatchedJson: { topScores: viable.slice(0, 5).map((x) => ({ id: x.c.id, label: x.c.label, score: x.score })) },
      explanation:
        "Best candidate remained below the minimum confidence score after equipment, POL/POD, unit-basis, and alias-augmented text scoring.",
      toleranceRuleId: params.toleranceRuleId,
    };
  }

  const match = top.c;
  const expected = match.amount;
  const variance = Math.abs(actual - expected);
  const threshold = Math.max(
    params.amountAbsTolerance,
    Math.abs(expected) * params.percentTolerance,
  );
  const warnThreshold = threshold * 2;

  const cats: string[] = [];
  if (top.unitSoftMismatch) cats.push(DISCREPANCY_CATEGORY.UNIT_BASIS_MISMATCH);
  if (top.geoSoftPenalty) cats.push(DISCREPANCY_CATEGORY.GEO_SCOPE_MISMATCH);
  if (top.score < MIN_CONFIDENCE_SCORE + 2) cats.push(DISCREPANCY_CATEGORY.MATCH_RESOLVED_WITH_WARNINGS);

  const matchedJson: Prisma.InputJsonValue = {
    kind: match.kind,
    id: match.id,
    label: match.label,
    currency: match.currency,
    expectedAmount: expected,
    invoiceAmount: actual,
    score: top.score,
    equipmentInvoice: invoiceEqKey,
    equipmentSnapshot: match.equipmentHint,
    pol: params.intake.polCode,
    pod: params.intake.podCode,
    snapshotOrigin: match.originCode,
    snapshotDest: match.destCode,
    decisionRulesVersion: 1,
  };

  if (variance <= threshold) {
    let outcome: "GREEN" | "AMBER" = "GREEN";
    if (cats.length > 0) outcome = "AMBER";
    return {
      outcome,
      discrepancyCategories:
        outcome === "GREEN"
          ? [DISCREPANCY_CATEGORY.AMOUNT_MATCH_WITHIN_TOLERANCE]
          : [...cats, DISCREPANCY_CATEGORY.AMOUNT_MATCH_WITHIN_TOLERANCE],
      expectedAmount: new Prisma.Decimal(String(expected)),
      amountVariance: new Prisma.Decimal(String(variance)),
      percentVariance:
        expected !== 0 ? new Prisma.Decimal(String(variance / Math.abs(expected))) : new Prisma.Decimal(0),
      snapshotMatchedJson: matchedJson,
      explanation:
        outcome === "GREEN"
          ? `Matched "${match.label}" within tolerance (Δ=${variance.toFixed(4)}).`
          : `Matched "${match.label}" within amount tolerance but flagged soft commercial mismatches: ${cats.join(", ")}.`,
      toleranceRuleId: params.toleranceRuleId,
    };
  }

  if (variance <= warnThreshold) {
    return {
      outcome: "AMBER",
      discrepancyCategories: [...cats, DISCREPANCY_CATEGORY.AMOUNT_MINOR_DISCREPANCY],
      expectedAmount: new Prisma.Decimal(String(expected)),
      amountVariance: new Prisma.Decimal(String(variance)),
      percentVariance: new Prisma.Decimal(String(variance / Math.abs(expected || 1))),
      snapshotMatchedJson: matchedJson,
      explanation: `Matched "${match.label}"; amount in warn band (Δ=${variance.toFixed(4)}).`,
      toleranceRuleId: params.toleranceRuleId,
    };
  }

  return {
    outcome: "RED",
    discrepancyCategories: [...cats, DISCREPANCY_CATEGORY.AMOUNT_MAJOR_DISCREPANCY],
    expectedAmount: new Prisma.Decimal(String(expected)),
    amountVariance: new Prisma.Decimal(String(variance)),
    percentVariance: new Prisma.Decimal(String(variance / Math.abs(expected || 1))),
    snapshotMatchedJson: matchedJson,
    explanation: `Matched "${match.label}" but amount materially differs from snapshot (Δ=${variance.toFixed(4)}).`,
    toleranceRuleId: params.toleranceRuleId,
  };
}

