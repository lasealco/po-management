/**
 * BF-87 — outbound commercial terms snapshot for DESADV / ASN JSON (`bf87.v1`).
 */

export const BF87_COMMERCIAL_SCHEMA_VERSION = "bf87.v1" as const;

export type WmsCommercialTermsBf87BillTo = {
  name?: string | null;
  line1?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
};

export type WmsCommercialTermsBf87V1 = {
  schemaVersion: typeof BF87_COMMERCIAL_SCHEMA_VERSION;
  incoterm?: string | null;
  paymentTermsDays?: number | null;
  paymentTermsLabel?: string | null;
  billTo?: WmsCommercialTermsBf87BillTo | null;
};

export function emptyCommercialTermsBf87V1(): WmsCommercialTermsBf87V1 {
  return {
    schemaVersion: BF87_COMMERCIAL_SCHEMA_VERSION,
    incoterm: null,
    paymentTermsDays: null,
    paymentTermsLabel: null,
    billTo: null,
  };
}

export function parseWmsCommercialTermsBf87FromDb(raw: unknown): WmsCommercialTermsBf87V1 | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== BF87_COMMERCIAL_SCHEMA_VERSION) return null;

  let billTo: WmsCommercialTermsBf87BillTo | null = null;
  const bt = o.billTo;
  if (bt != null && typeof bt === "object" && !Array.isArray(bt)) {
    const b = bt as Record<string, unknown>;
    billTo = {
      name: typeof b.name === "string" ? b.name : b.name == null ? null : String(b.name),
      line1: typeof b.line1 === "string" ? b.line1 : b.line1 == null ? null : String(b.line1),
      city: typeof b.city === "string" ? b.city : b.city == null ? null : String(b.city),
      region: typeof b.region === "string" ? b.region : b.region == null ? null : String(b.region),
      postalCode:
        typeof b.postalCode === "string" ? b.postalCode : b.postalCode == null ? null : String(b.postalCode),
      countryCode:
        typeof b.countryCode === "string" ? b.countryCode : b.countryCode == null ? null : String(b.countryCode),
    };
  }

  let paymentTermsDays: number | null = null;
  if (o.paymentTermsDays !== undefined && o.paymentTermsDays !== null) {
    const n = Number(o.paymentTermsDays);
    paymentTermsDays = Number.isFinite(n) ? Math.floor(n) : null;
  }

  return {
    schemaVersion: BF87_COMMERCIAL_SCHEMA_VERSION,
    incoterm:
      o.incoterm === undefined || o.incoterm === null ? null : String(o.incoterm).trim() || null,
    paymentTermsDays,
    paymentTermsLabel:
      o.paymentTermsLabel === undefined || o.paymentTermsLabel === null
        ? null
        : String(o.paymentTermsLabel).trim() || null,
    billTo,
  };
}

export function mergeOutboundCommercialTermsPatchBf87(
  existing: WmsCommercialTermsBf87V1 | null,
  patch: {
    incoterm?: string | null;
    paymentTermsDays?: number | null;
    paymentTermsLabel?: string | null;
    billToName?: string | null;
    billToLine1?: string | null;
    billToCity?: string | null;
    billToRegion?: string | null;
    billToPostalCode?: string | null;
    billToCountryCode?: string | null;
  },
): WmsCommercialTermsBf87V1 {
  const base = existing ?? emptyCommercialTermsBf87V1();
  const billBase = base.billTo ?? {};

  let billTo: WmsCommercialTermsBf87BillTo | null = base.billTo ?? null;
  const billPatchKeys =
    patch.billToName !== undefined ||
    patch.billToLine1 !== undefined ||
    patch.billToCity !== undefined ||
    patch.billToRegion !== undefined ||
    patch.billToPostalCode !== undefined ||
    patch.billToCountryCode !== undefined;
  if (billPatchKeys) {
    billTo = {
      name: patch.billToName !== undefined ? patch.billToName : billBase.name ?? null,
      line1: patch.billToLine1 !== undefined ? patch.billToLine1 : billBase.line1 ?? null,
      city: patch.billToCity !== undefined ? patch.billToCity : billBase.city ?? null,
      region: patch.billToRegion !== undefined ? patch.billToRegion : billBase.region ?? null,
      postalCode:
        patch.billToPostalCode !== undefined ? patch.billToPostalCode : billBase.postalCode ?? null,
      countryCode:
        patch.billToCountryCode !== undefined ? patch.billToCountryCode : billBase.countryCode ?? null,
    };
    const allEmpty =
      !billTo.name?.trim() &&
      !billTo.line1?.trim() &&
      !billTo.city?.trim() &&
      !billTo.region?.trim() &&
      !billTo.postalCode?.trim() &&
      !billTo.countryCode?.trim();
    if (allEmpty) billTo = null;
  }

  return {
    schemaVersion: BF87_COMMERCIAL_SCHEMA_VERSION,
    incoterm: patch.incoterm !== undefined ? patch.incoterm : base.incoterm ?? null,
    paymentTermsDays:
      patch.paymentTermsDays !== undefined ? patch.paymentTermsDays : base.paymentTermsDays ?? null,
    paymentTermsLabel:
      patch.paymentTermsLabel !== undefined ? patch.paymentTermsLabel : base.paymentTermsLabel ?? null,
    billTo,
  };
}

/** Serialize for Prisma Json column — omit heavy null-only clutter when everything empty */
export function commercialTermsBf87ToJsonValue(doc: WmsCommercialTermsBf87V1): Record<string, unknown> {
  const out: Record<string, unknown> = { schemaVersion: doc.schemaVersion };
  if (doc.incoterm != null && doc.incoterm !== "") out.incoterm = doc.incoterm;
  if (doc.paymentTermsDays != null) out.paymentTermsDays = doc.paymentTermsDays;
  if (doc.paymentTermsLabel != null && doc.paymentTermsLabel !== "") {
    out.paymentTermsLabel = doc.paymentTermsLabel;
  }
  if (doc.billTo) {
    const b: Record<string, unknown> = {};
    if (doc.billTo.name) b.name = doc.billTo.name;
    if (doc.billTo.line1) b.line1 = doc.billTo.line1;
    if (doc.billTo.city) b.city = doc.billTo.city;
    if (doc.billTo.region) b.region = doc.billTo.region;
    if (doc.billTo.postalCode) b.postalCode = doc.billTo.postalCode;
    if (doc.billTo.countryCode) b.countryCode = doc.billTo.countryCode;
    if (Object.keys(b).length > 0) out.billTo = b;
  }
  return out;
}

export function isCommercialTermsBf87DocEmpty(doc: WmsCommercialTermsBf87V1): boolean {
  const j = commercialTermsBf87ToJsonValue(doc);
  return Object.keys(j).length <= 1;
}
