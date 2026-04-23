import type { SrmSupplierDocumentStatus, SrmSupplierDocumentType } from "@prisma/client";

/**
 * I-v1: CSV manifest of SRM document metadata (no `fileUrl` in export for safer sharing/audit).
 */
export function escapeSrmManifestCsvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

type ManifestRow = {
  id: string;
  documentType: SrmSupplierDocumentType;
  status: SrmSupplierDocumentStatus;
  title: string | null;
  fileName: string;
  fileSize: number;
  revisionGroupId: string;
  revisionNumber: number;
  supersedesDocumentId: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  uploadedBy: { id: string; name: string; email: string };
  lastModifiedBy: { id: string; name: string; email: string } | null;
};

const HEADER = [
  "supplierName",
  "supplierCode",
  "id",
  "documentType",
  "status",
  "title",
  "fileName",
  "fileSize",
  "revisionGroupId",
  "revisionNumber",
  "supersedesDocumentId",
  "expiresAt",
  "createdAt",
  "updatedAt",
  "uploadedByEmail",
  "uploadedByName",
  "lastModifiedByEmail",
  "lastModifiedByName",
] as const;

export function buildSrmDocumentManifestCsv(
  supplier: { name: string; code: string | null },
  rows: ManifestRow[],
): string {
  const sc = supplier.code ?? "";
  const sn = supplier.name;
  const lines = [
    HEADER.join(","),
    ...rows.map((r) =>
      [
        escapeSrmManifestCsvCell(sn),
        escapeSrmManifestCsvCell(sc),
        escapeSrmManifestCsvCell(r.id),
        escapeSrmManifestCsvCell(r.documentType),
        escapeSrmManifestCsvCell(r.status),
        escapeSrmManifestCsvCell(r.title ?? ""),
        escapeSrmManifestCsvCell(r.fileName),
        String(r.fileSize),
        escapeSrmManifestCsvCell(r.revisionGroupId),
        String(r.revisionNumber),
        escapeSrmManifestCsvCell(r.supersedesDocumentId ?? ""),
        r.expiresAt ? escapeSrmManifestCsvCell(r.expiresAt.toISOString()) : "",
        escapeSrmManifestCsvCell(r.createdAt.toISOString()),
        escapeSrmManifestCsvCell(r.updatedAt.toISOString()),
        escapeSrmManifestCsvCell(r.uploadedBy.email),
        escapeSrmManifestCsvCell(r.uploadedBy.name),
        escapeSrmManifestCsvCell(r.lastModifiedBy?.email ?? ""),
        escapeSrmManifestCsvCell(r.lastModifiedBy?.name ?? ""),
      ].join(","),
    ),
  ];
  return lines.join("\n");
}
