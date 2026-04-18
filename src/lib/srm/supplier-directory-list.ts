import type { Prisma, SupplierApprovalStatus } from "@prisma/client";

/** Product vs logistics partner directory (matches `Supplier.srmCategory`). */
export type SupplierDirectoryKind = "product" | "logistics";

export type SupplierDirectoryApprovalFilter = "all" | "pending" | "approved" | "rejected";

export type SupplierDirectoryActiveFilter = "all" | "active" | "inactive";

export type SupplierDirectorySort = "name" | "code" | "updated";

function firstParam(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

export function parseDirectorySearchQ(raw: string | string[] | undefined): string {
  const v = (firstParam(raw) ?? "").trim();
  return v.slice(0, 120);
}

export function parseDirectoryKind(
  raw: string | string[] | undefined,
): SupplierDirectoryKind {
  const v = firstParam(raw);
  return v === "logistics" ? "logistics" : "product";
}

export function parseDirectoryApproval(
  raw: string | string[] | undefined,
): SupplierDirectoryApprovalFilter {
  const v = (firstParam(raw) ?? "all").trim().toLowerCase();
  if (v === "pending" || v === "pending_approval") return "pending";
  if (v === "approved") return "approved";
  if (v === "rejected") return "rejected";
  return "all";
}

export function parseDirectoryActive(
  raw: string | string[] | undefined,
): SupplierDirectoryActiveFilter {
  const v = (firstParam(raw) ?? "all").trim().toLowerCase();
  if (v === "active" || v === "true" || v === "1") return "active";
  if (v === "inactive" || v === "false" || v === "0") return "inactive";
  return "all";
}

export function parseDirectorySort(
  raw: string | string[] | undefined,
): SupplierDirectorySort {
  const v = (firstParam(raw) ?? "name").trim().toLowerCase();
  if (v === "code") return "code";
  if (v === "updated") return "updated";
  return "name";
}

function approvalToPrisma(
  f: SupplierDirectoryApprovalFilter,
): SupplierApprovalStatus | undefined {
  if (f === "all") return undefined;
  if (f === "pending") return "pending_approval";
  if (f === "approved") return "approved";
  return "rejected";
}

export function supplierDirectoryWhere(
  tenantId: string,
  kind: SupplierDirectoryKind,
  q: string,
  approval: SupplierDirectoryApprovalFilter,
  active: SupplierDirectoryActiveFilter,
): Prisma.SupplierWhereInput {
  const approvalStatus = approvalToPrisma(approval);
  return {
    tenantId,
    srmCategory: kind === "logistics" ? "logistics" : "product",
    ...(approvalStatus ? { approvalStatus } : {}),
    ...(active === "active" ? { isActive: true } : {}),
    ...(active === "inactive" ? { isActive: false } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { code: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

export function supplierDirectoryOrderBy(
  sort: SupplierDirectorySort,
): Prisma.SupplierOrderByWithRelationInput {
  if (sort === "code") return { code: "asc" };
  if (sort === "updated") return { updatedAt: "desc" };
  return { name: "asc" };
}

/** Query string without `kind` (for `SupplierKindTabs` `extraQuery`). Omits default filter/sort values. */
export function buildSupplierDirectoryExtraQuery(input: {
  q: string;
  approval: SupplierDirectoryApprovalFilter;
  active: SupplierDirectoryActiveFilter;
  sort: SupplierDirectorySort;
}): string | undefined {
  const p = new URLSearchParams();
  if (input.q) p.set("q", input.q);
  if (input.approval !== "all") p.set("approval", input.approval);
  if (input.active !== "all") p.set("active", input.active);
  if (input.sort !== "name") p.set("sort", input.sort);
  const s = p.toString();
  return s.length ? s : undefined;
}
