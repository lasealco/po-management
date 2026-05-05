/**
 * BF-72 — dangerous goods checklist state + DG manifest JSON (operator attestation; not IMDG certification).
 */

export const DG_MANIFEST_SCHEMA_VERSION = "bf72.v1" as const;

export const DG_CHECKLIST_STATE_SCHEMA = "wms.dg_checklist_state.bf72.v1" as const;

/** Fixed checklist the operator must confirm when any line SKU is flagged `Product.isDangerousGoods`. */
export const DG_CHECKLIST_ITEM_DEFS = [
  {
    code: "SDS_REVIEWED",
    label: "Safety data sheet (SDS) reviewed for each dangerous goods SKU on this outbound.",
  },
  {
    code: "LABELS_MATCH_MASTER_DATA",
    label: "Dangerous goods labels match registered UN number, class, and packing group for declared SKUs.",
  },
  {
    code: "PACKAGING_CLOSURE_OK",
    label: "Inner packaging, closures, and orientation checked against packing group (operator attestation).",
  },
  {
    code: "LIMITS_SEGREGATION_REVIEWED",
    label: "Quantity limits / segregation rules for this mode reviewed at operator discretion (informational).",
  },
] as const;

export type DgChecklistItemCode = (typeof DG_CHECKLIST_ITEM_DEFS)[number]["code"];

export type WmsDgChecklistStateBf72V1 = {
  schema: typeof DG_CHECKLIST_STATE_SCHEMA;
  completedAt: string;
  actorUserId: string;
  items: Array<{ code: string; label: string; ok: boolean }>;
};

export type DgManifestProductSnapshot = {
  id: string;
  sku: string | null;
  productCode: string | null;
  name: string;
  isDangerousGoods: boolean;
  dangerousGoodsClass: string | null;
  unNumber: string | null;
  properShippingName: string | null;
  packingGroup: string | null;
  msdsUrl: string | null;
};

export type DangerousGoodsManifestBf72V1 = {
  schemaVersion: typeof DG_MANIFEST_SCHEMA_VERSION;
  profile: "WMS_DANGEROUS_GOODS_MANIFEST_STUB_V1";
  generatedAt: string;
  methodology: string;
  shipment: {
    outboundOrderId: string;
    outboundNo: string;
    status: string;
    carrierTrackingNo: string | null;
    shipToName: string | null;
    shipToCity: string | null;
    shipToCountryCode: string | null;
  };
  checklistRequired: boolean;
  checklist: WmsDgChecklistStateBf72V1 | null;
  checklistComplete: boolean;
  lines: Array<{
    lineNo: number;
    productId: string;
    quantityBasis: "PACKED" | "SHIPPED";
    quantity: string;
    product: DgManifestProductSnapshot;
  }>;
  dangerousGoodsLines: Array<{
    lineNo: number;
    productId: string;
    sku: string | null;
    productCode: string | null;
    description: string;
    unNumber: string | null;
    dangerousGoodsClass: string | null;
    packingGroup: string | null;
    properShippingName: string | null;
    msdsUrl: string | null;
  }>;
  warnings: string[];
};

export function outboundLinesRequireDangerousGoodsChecklist(
  lines: Array<{ product: { isDangerousGoods: boolean } }>,
): boolean {
  return lines.some((l) => l.product.isDangerousGoods);
}

export function parseDgChecklistJsonFromDb(raw: unknown): WmsDgChecklistStateBf72V1 | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.schema !== DG_CHECKLIST_STATE_SCHEMA) return null;
  if (typeof o.completedAt !== "string" || !o.completedAt.trim()) return null;
  if (typeof o.actorUserId !== "string" || !o.actorUserId.trim()) return null;
  if (!Array.isArray(o.items)) return null;
  const items: WmsDgChecklistStateBf72V1["items"] = [];
  for (const row of o.items) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    const r = row as Record<string, unknown>;
    if (typeof r.code !== "string" || typeof r.label !== "string" || typeof r.ok !== "boolean") return null;
    items.push({ code: r.code, label: r.label, ok: r.ok });
  }
  return { schema: DG_CHECKLIST_STATE_SCHEMA, completedAt: o.completedAt, actorUserId: o.actorUserId, items };
}

export function checklistStateSatisfiesTemplate(state: WmsDgChecklistStateBf72V1 | null): boolean {
  if (!state) return false;
  const expectedCodes = new Set(DG_CHECKLIST_ITEM_DEFS.map((d) => d.code));
  const seen = new Map<string, boolean>();
  for (const row of state.items) {
    seen.set(row.code, row.ok);
  }
  if (seen.size !== expectedCodes.size) return false;
  for (const code of expectedCodes) {
    if (!seen.has(code) || seen.get(code) !== true) return false;
  }
  return true;
}

export function buildDgChecklistStateBf72V1(actorUserId: string): WmsDgChecklistStateBf72V1 {
  const completedAt = new Date().toISOString();
  return {
    schema: DG_CHECKLIST_STATE_SCHEMA,
    completedAt,
    actorUserId,
    items: DG_CHECKLIST_ITEM_DEFS.map((d) => ({
      code: d.code,
      label: d.label,
      ok: true,
    })),
  };
}

/** Validates POST body map: every checklist code must be explicitly true. */
export function validateDangerousGoodsChecklistSubmission(
  items: Record<string, unknown> | null | undefined,
): { ok: true } | { ok: false; message: string } {
  if (!items || typeof items !== "object" || Array.isArray(items)) {
    return { ok: false, message: "dangerousGoodsChecklistItems must be an object of code → boolean." };
  }
  for (const def of DG_CHECKLIST_ITEM_DEFS) {
    if (!(def.code in items)) {
      return { ok: false, message: `Missing checklist key "${def.code}".` };
    }
    const v = items[def.code];
    if (v !== true) {
      return { ok: false, message: `Checklist item "${def.code}" must be true.` };
    }
  }
  for (const k of Object.keys(items)) {
    if (!DG_CHECKLIST_ITEM_DEFS.some((d) => d.code === k)) {
      return { ok: false, message: `Unknown checklist key "${k}".` };
    }
  }
  return { ok: true };
}

export function evaluateDangerousGoodsReadinessBf72(order: {
  lines: Array<{ product: DgManifestProductSnapshot | { isDangerousGoods: boolean } }>;
  wmsDangerousGoodsChecklistJson: unknown;
}): {
  checklistRequired: boolean;
  checklistComplete: boolean;
  warnings: string[];
} {
  const checklistRequired = outboundLinesRequireDangerousGoodsChecklist(order.lines as Array<{ product: { isDangerousGoods: boolean } }>);
  const parsed = parseDgChecklistJsonFromDb(order.wmsDangerousGoodsChecklistJson);
  const checklistComplete = checklistRequired ? checklistStateSatisfiesTemplate(parsed) : true;

  const warnings: string[] = [];
  if (!checklistRequired) return { checklistRequired, checklistComplete, warnings };

  for (const line of order.lines) {
    const p = line.product as DgManifestProductSnapshot;
    if (!p.isDangerousGoods) continue;
    if (!p.unNumber?.trim()) {
      warnings.push(`Dangerous goods line ${p.name}: UN number is empty — broker/regulatory filings may be incomplete.`);
    }
    if (!p.dangerousGoodsClass?.trim()) {
      warnings.push(`Dangerous goods line ${p.name}: hazard class is empty — verify master data.`);
    }
  }

  return { checklistRequired, checklistComplete, warnings };
}

export function buildDangerousGoodsManifestBf72(args: {
  outboundOrderId: string;
  outboundNo: string;
  status: string;
  carrierTrackingNo: string | null;
  shipToName: string | null;
  shipToCity: string | null;
  shipToCountryCode: string | null;
  wmsDangerousGoodsChecklistJson: unknown;
  lines: Array<{
    lineNo: number;
    quantity: { toString(): string };
    packedQty: { toString(): string };
    shippedQty: { toString(): string };
    product: DgManifestProductSnapshot;
  }>;
  generatedAt: Date;
}): DangerousGoodsManifestBf72V1 {
  const qtyBasis: "PACKED" | "SHIPPED" = args.status === "SHIPPED" ? "SHIPPED" : "PACKED";
  const methodology =
    "BF-72 minimal DG manifest: Product dangerous-goods master attributes plus outbound checklist attestation — not IMDG-certified labeling or agency filing.";

  const lines = args.lines.map((l) => ({
    lineNo: l.lineNo,
    productId: l.product.id,
    quantityBasis: qtyBasis,
    quantity: qtyBasis === "SHIPPED" ? l.shippedQty.toString() : l.packedQty.toString(),
    product: l.product,
  }));

  const checklist = parseDgChecklistJsonFromDb(args.wmsDangerousGoodsChecklistJson);
  const checklistRequired = outboundLinesRequireDangerousGoodsChecklist(
    args.lines.map((l) => ({ product: l.product })),
  );
  const readiness = evaluateDangerousGoodsReadinessBf72({
    lines: args.lines.map((l) => ({ product: l.product })),
    wmsDangerousGoodsChecklistJson: args.wmsDangerousGoodsChecklistJson,
  });

  const dangerousGoodsLines = args.lines
    .filter((l) => l.product.isDangerousGoods)
    .map((l) => ({
      lineNo: l.lineNo,
      productId: l.product.id,
      sku: l.product.sku,
      productCode: l.product.productCode,
      description: l.product.name,
      unNumber: l.product.unNumber,
      dangerousGoodsClass: l.product.dangerousGoodsClass,
      packingGroup: l.product.packingGroup,
      properShippingName: l.product.properShippingName,
      msdsUrl: l.product.msdsUrl,
    }));

  return {
    schemaVersion: DG_MANIFEST_SCHEMA_VERSION,
    profile: "WMS_DANGEROUS_GOODS_MANIFEST_STUB_V1",
    generatedAt: args.generatedAt.toISOString(),
    methodology,
    shipment: {
      outboundOrderId: args.outboundOrderId,
      outboundNo: args.outboundNo,
      status: args.status,
      carrierTrackingNo: args.carrierTrackingNo,
      shipToName: args.shipToName,
      shipToCity: args.shipToCity,
      shipToCountryCode: args.shipToCountryCode,
    },
    checklistRequired,
    checklist,
    checklistComplete: readiness.checklistComplete,
    lines,
    dangerousGoodsLines,
    warnings: readiness.warnings,
  };
}