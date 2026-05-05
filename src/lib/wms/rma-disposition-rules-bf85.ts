import type {
  WmsRmaDispositionMatchFieldBf85,
  WmsRmaDispositionMatchModeBf85,
  WmsReturnLineDisposition,
} from "@prisma/client";

export type WmsRmaDispositionRuleBf85Row = {
  id: string;
  priority: number;
  matchField: WmsRmaDispositionMatchFieldBf85;
  matchMode: WmsRmaDispositionMatchModeBf85;
  pattern: string;
  applyDisposition: WmsReturnLineDisposition;
  receivingDispositionTemplateId: string | null;
};

export type RmaDispositionRuleLineContextBf85 = {
  orderLineDescription: string;
  productSku: string | null;
  productCode: string | null;
  shipmentRmaReference: string | null;
};

const MATCH_FIELDS: readonly WmsRmaDispositionMatchFieldBf85[] = [
  "ORDER_LINE_DESCRIPTION",
  "PRODUCT_SKU",
  "PRODUCT_CODE",
  "SHIPMENT_RMA_REFERENCE",
] as const;

const MATCH_MODES: readonly WmsRmaDispositionMatchModeBf85[] = [
  "EXACT",
  "PREFIX",
  "CONTAINS",
] as const;

export function normalizeBf85MatchText(input: string): string {
  return input.trim().toLowerCase();
}

export function haystackForRmaDispositionRuleBf85(
  field: WmsRmaDispositionMatchFieldBf85,
  ctx: RmaDispositionRuleLineContextBf85,
): string {
  switch (field) {
    case "ORDER_LINE_DESCRIPTION":
      return ctx.orderLineDescription;
    case "PRODUCT_SKU":
      return ctx.productSku ?? "";
    case "PRODUCT_CODE":
      return ctx.productCode ?? "";
    case "SHIPMENT_RMA_REFERENCE":
      return ctx.shipmentRmaReference ?? "";
    default:
      return "";
  }
}

export function ruleMatchesBf85Pattern(
  mode: WmsRmaDispositionMatchModeBf85,
  patternNorm: string,
  haystackNorm: string,
): boolean {
  if (!patternNorm) return false;
  switch (mode) {
    case "EXACT":
      return haystackNorm === patternNorm;
    case "PREFIX":
      return haystackNorm.startsWith(patternNorm);
    case "CONTAINS":
      return haystackNorm.includes(patternNorm);
    default:
      return false;
  }
}

export function findFirstMatchingRmaDispositionRuleBf85(
  rules: readonly WmsRmaDispositionRuleBf85Row[],
  ctx: RmaDispositionRuleLineContextBf85,
): WmsRmaDispositionRuleBf85Row | null {
  const sorted = [...rules].sort((a, b) =>
    a.priority !== b.priority ? a.priority - b.priority : a.id.localeCompare(b.id),
  );
  for (const rule of sorted) {
    const hay = normalizeBf85MatchText(haystackForRmaDispositionRuleBf85(rule.matchField, ctx));
    const pat = normalizeBf85MatchText(rule.pattern);
    if (ruleMatchesBf85Pattern(rule.matchMode, pat, hay)) {
      return rule;
    }
  }
  return null;
}

export function parseWmsRmaDispositionMatchFieldBf85(
  raw: string | undefined,
): WmsRmaDispositionMatchFieldBf85 | null {
  const u = raw?.trim().toUpperCase();
  if (!u) return null;
  return (MATCH_FIELDS as readonly string[]).includes(u) ? (u as WmsRmaDispositionMatchFieldBf85) : null;
}

export function parseWmsRmaDispositionMatchModeBf85(
  raw: string | undefined,
): WmsRmaDispositionMatchModeBf85 | null {
  const u = raw?.trim().toUpperCase();
  if (!u) return null;
  return (MATCH_MODES as readonly string[]).includes(u) ? (u as WmsRmaDispositionMatchModeBf85) : null;
}

export function parseWmsReturnDispositionBf85(
  raw: string | undefined,
): WmsReturnLineDisposition | null {
  const u = raw?.trim().toUpperCase();
  if (u === "RESTOCK" || u === "SCRAP" || u === "QUARANTINE") return u;
  return null;
}
