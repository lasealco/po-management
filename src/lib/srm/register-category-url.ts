import type { SupplierDocumentCategory } from "@prisma/client";

/** Query key for `/srm/[id]?registerCategory=insurance` (and legacy supplier detail). */
export const SRM_REGISTER_CATEGORY_QUERY = "registerCategory";

const ALLOWED_REGISTER_CATEGORY_PARAM: SupplierDocumentCategory[] = [
  "insurance",
  "license",
  "certificate",
  "compliance_other",
  "commercial_other",
];

export function parseRegisterCategorySearchParam(
  value: string | null,
): SupplierDocumentCategory | null {
  if (!value?.trim()) return null;
  const t = value.trim().toLowerCase();
  return ALLOWED_REGISTER_CATEGORY_PARAM.includes(t as SupplierDocumentCategory)
    ? (t as SupplierDocumentCategory)
    : null;
}

/** How to merge query params when opening the documents workspace from the client. */
export type DocumentsWorkspaceQueryMode = "srm-documents-tab" | "register-only";

/**
 * Build the next `search` segment (no leading `?`) for `router.replace(pathname + "?" + result)`.
 * Centralizes SRM vs legacy rules so Vitest can lock the contract.
 */
export function mergeDocumentsWorkspaceQuery(options: {
  /** Existing query without `?` (e.g. `searchParams.toString()`). */
  currentSearch: string;
  mode: DocumentsWorkspaceQueryMode;
  /** When set, adds `registerCategory`; when null/undefined, removes the key. */
  focus: SupplierDocumentCategory | null | undefined;
}): string {
  const q = new URLSearchParams(options.currentSearch);
  const focus = options.focus ?? null;
  if (options.mode === "srm-documents-tab") {
    q.set("tab", "documents");
    if (focus) q.set(SRM_REGISTER_CATEGORY_QUERY, focus);
    else q.delete(SRM_REGISTER_CATEGORY_QUERY);
  } else {
    if (focus) q.set(SRM_REGISTER_CATEGORY_QUERY, focus);
    else q.delete(SRM_REGISTER_CATEGORY_QUERY);
  }
  return q.toString();
}
