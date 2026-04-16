/** Canonical `CtShipmentDocument.docType` values for uploads and UI. */
export const CT_SHIPMENT_DOCUMENT_TYPES = [
  { code: "AIR_WAYBILL", label: "Air waybill (AWB)", group: "Transport" },
  { code: "BILL_OF_LADING", label: "Bill of lading", group: "Transport" },
  { code: "SEA_WAYBILL", label: "Sea waybill", group: "Transport" },
  { code: "CMR", label: "CMR (road)", group: "Transport" },
  { code: "COURIER_WAYBILL", label: "Courier waybill", group: "Transport" },
  { code: "COMMERCIAL_INVOICE", label: "Commercial invoice", group: "Commercial" },
  { code: "PACKING_LIST", label: "Packing list", group: "Commercial" },
  { code: "CERTIFICATE_OF_ORIGIN", label: "Certificate of origin", group: "Commercial" },
  { code: "INSURANCE_CERTIFICATE", label: "Insurance certificate", group: "Commercial" },
  { code: "CUSTOMS_DECLARATION", label: "Customs declaration", group: "Customs & compliance" },
  { code: "DANGEROUS_GOODS_DECLARATION", label: "Dangerous goods declaration", group: "Customs & compliance" },
  { code: "OTHER", label: "Other", group: "Other" },
] as const;

const CANONICAL = new Set(
  CT_SHIPMENT_DOCUMENT_TYPES.map((t) => t.code as string),
);

const LABEL_BY_CODE = new Map(
  CT_SHIPMENT_DOCUMENT_TYPES.map((t) => [t.code as string, t.label] as const),
);

/** Normalize doc type from the upload form (unknown values become OTHER). */
export function normalizeUploadDocType(raw: string): string {
  const u = raw.trim().toUpperCase().replace(/\s+/g, "_");
  if (CANONICAL.has(u)) return u;
  return "OTHER";
}

export function labelForCtDocType(code: string): string {
  return LABEL_BY_CODE.get(code) ?? code;
}

/**
 * Doc type from an integration payload: printable ASCII, no control chars, max 80 chars.
 * Allows vendor-specific codes (e.g. CargoWise) while staying DB-safe.
 */
export function parseIntegrationDocType(raw: unknown): string | "invalid" {
  if (typeof raw !== "string") return "invalid";
  const t = raw.trim();
  if (!t || t.length > 80) return "invalid";
  if (/[\r\n\x00-\x1f]/.test(t)) return "invalid";
  return t;
}
