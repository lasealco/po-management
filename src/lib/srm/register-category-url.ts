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
