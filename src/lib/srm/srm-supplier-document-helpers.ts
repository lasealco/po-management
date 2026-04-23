import type { SrmSupplierDocumentStatus, SrmSupplierDocumentType } from "@prisma/client";

const DOC_TYPES: SrmSupplierDocumentType[] = [
  "certificate_of_insurance",
  "w9",
  "code_of_conduct",
  "quality_agreement",
  "tax_certificate",
  "other",
];

export function parseSrmSupplierDocumentType(raw: string): SrmSupplierDocumentType | null {
  const t = raw.trim() as SrmSupplierDocumentType;
  return DOC_TYPES.includes(t) ? t : null;
}

export const SRM_SUPPLIER_DOCUMENT_TYPE_LABEL: Record<SrmSupplierDocumentType, string> = {
  certificate_of_insurance: "Certificate of insurance",
  w9: "W-9 / tax ID",
  code_of_conduct: "Code of conduct",
  quality_agreement: "Quality agreement",
  tax_certificate: "Tax certificate",
  other: "Other",
};

/** Query-time expiry classification (slice 18). */
export type SrmDocExpirySignal = "none" | "ok" | "expiring_soon" | "expired";

const EXPIRING_SOON_DAYS = 30;

export function computeSrmDocExpirySignal(
  expiresAt: Date | null,
  now: Date = new Date(),
): SrmDocExpirySignal {
  if (!expiresAt) return "none";
  if (expiresAt.getTime() < now.getTime()) return "expired";
  const soon = new Date(now);
  soon.setDate(soon.getDate() + EXPIRING_SOON_DAYS);
  if (expiresAt.getTime() <= soon.getTime()) return "expiring_soon";
  return "ok";
}

type DocListRow = {
  id: string;
  documentType: SrmSupplierDocumentType;
  status: SrmSupplierDocumentStatus;
  title: string | null;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  uploadedBy: { id: string; name: string; email: string };
  lastModifiedBy: { id: string; name: string; email: string } | null;
};

export function toSrmSupplierDocumentJson(d: DocListRow) {
  return {
    id: d.id,
    documentType: d.documentType,
    status: d.status,
    title: d.title,
    fileName: d.fileName,
    mimeType: d.mimeType,
    fileSize: d.fileSize,
    fileUrl: d.fileUrl,
    expiresAt: d.expiresAt ? d.expiresAt.toISOString() : null,
    expirySignal: computeSrmDocExpirySignal(d.expiresAt),
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    uploadedBy: d.uploadedBy,
    lastModifiedBy: d.lastModifiedBy,
  };
}
