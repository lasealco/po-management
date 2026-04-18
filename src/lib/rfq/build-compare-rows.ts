import { summarizeFreeTime, summarizeJsonArray } from "@/lib/rfq/compare-helpers";
import type { getQuoteRequestDetail } from "@/lib/rfq/quote-requests";

const COMPARABLE_RESPONSE_STATUSES = new Set([
  "SUBMITTED",
  "UNDER_REVIEW",
  "SHORTLISTED",
  "AWARDED",
  "REJECTED",
]);

export type RfqCompareRow = {
  responseId: string;
  recipient: string;
  status: string;
  total: string;
  currency: string;
  validity: string;
  includedSummary: string;
  excludedSummary: string;
  freeTimeSummary: string;
  /** Per-currency peer context: lowest total or delta vs lowest when two+ numeric totals exist. */
  peerBenchmarkLabel: string | null;
  peerBenchmarkTone: "lowest" | "delta" | "neutral";
  peerBenchmarkTitle: string | null;
};

type DraftRow = Omit<RfqCompareRow, "peerBenchmarkLabel" | "peerBenchmarkTone" | "peerBenchmarkTitle"> & {
  totalNumeric: number | null;
};

function currencyKey(currency: string): string {
  const t = currency.trim();
  return t ? t.toUpperCase() : "__EMPTY__";
}

function parseDecimalTotal(value: unknown): number | null {
  if (value == null) return null;
  const s =
    typeof value === "object" && value !== null && "toString" in value
      ? String((value as { toString(): string }).toString())
      : String(value);
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function buildRfqCompareRows(detail: Awaited<ReturnType<typeof getQuoteRequestDetail>>): RfqCompareRow[] {
  const drafts: DraftRow[] = [];
  for (const rec of detail.recipients) {
    const resp = rec.response;
    if (!resp) continue;
    if (!COMPARABLE_RESPONSE_STATUSES.has(resp.status)) continue;

    const vf = resp.validityFrom ? resp.validityFrom.toISOString().slice(0, 10) : "";
    const vt = resp.validityTo ? resp.validityTo.toISOString().slice(0, 10) : "";

    drafts.push({
      responseId: resp.id,
      recipient: rec.displayName,
      status: resp.status,
      total: resp.totalAllInAmount != null ? String(resp.totalAllInAmount) : "—",
      currency: resp.currency ?? "",
      validity: vf && vt ? `${vf} → ${vt}` : "—",
      includedSummary: summarizeJsonArray(resp.includedChargesJson),
      excludedSummary: summarizeJsonArray(resp.excludedChargesJson),
      freeTimeSummary: summarizeFreeTime(resp.freeTimeSummaryJson),
      totalNumeric: parseDecimalTotal(resp.totalAllInAmount),
    });
  }

  const minByCurrency = new Map<string, number>();
  const countNumericByCurrency = new Map<string, number>();

  for (const r of drafts) {
    const k = currencyKey(r.currency);
    if (r.totalNumeric == null) continue;
    countNumericByCurrency.set(k, (countNumericByCurrency.get(k) ?? 0) + 1);
    const prev = minByCurrency.get(k);
    minByCurrency.set(k, prev == null ? r.totalNumeric : Math.min(prev, r.totalNumeric));
  }

  return drafts.map((r) => {
    const { totalNumeric, ...base } = r;
    const k = currencyKey(r.currency);
    const numericPeers = (countNumericByCurrency.get(k) ?? 0) >= 2;
    const min = minByCurrency.get(k);

    let peerBenchmarkLabel: string | null = null;
    let peerBenchmarkTone: RfqCompareRow["peerBenchmarkTone"] = "neutral";
    let peerBenchmarkTitle: string | null = null;

    if (!numericPeers || min == null || totalNumeric == null) {
      return {
        ...base,
        peerBenchmarkLabel,
        peerBenchmarkTone,
        peerBenchmarkTitle,
      };
    }

    const eps = 1e-9;
    const atOrNearLow = Math.abs(totalNumeric - min) <= eps;
    peerBenchmarkTitle = `Lowest submitted all-in in ${r.currency.trim() || "this row"} within this RFQ: ${String(min)}`;

    if (atOrNearLow) {
      peerBenchmarkLabel = "Lowest";
      peerBenchmarkTone = "lowest";
    } else {
      const delta = totalNumeric - min;
      const sign = delta > 0 ? "+" : "";
      peerBenchmarkLabel = `${sign}${delta.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })} vs low`;
      peerBenchmarkTone = "delta";
      peerBenchmarkTitle = `${peerBenchmarkTitle}. This quote is ${sign}${delta} vs that benchmark.`;
    }

    return {
      ...base,
      peerBenchmarkLabel,
      peerBenchmarkTone,
      peerBenchmarkTitle,
    };
  });
}
