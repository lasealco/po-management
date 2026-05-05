/**
 * BF-79 — inventory balance vendor/consignment ownership metadata (nullable supplier FK).
 */

import type { Prisma } from "@prisma/client";

export const INVENTORY_OWNERSHIP_BF79_SCHEMA_VERSION = "bf79.v1" as const;

export type ParsedInventoryOwnershipBf79BalanceFilter = {
  mode: "all" | "company" | "vendor";
  supplierId: string | null;
};

export type InventoryOwnershipBalanceFilterEchoBf79 = {
  schemaVersion: typeof INVENTORY_OWNERSHIP_BF79_SCHEMA_VERSION;
  mode: ParsedInventoryOwnershipBf79BalanceFilter["mode"];
  supplierId: string | null;
};

/** Parse `GET /api/wms` balance ownership filter params; returns null when API-default (no filter). */
export function parseInventoryOwnershipBf79BalanceFilter(
  searchParams: URLSearchParams,
): ParsedInventoryOwnershipBf79BalanceFilter | null {
  const modeRaw = searchParams.get("balanceOwnership")?.trim().toLowerCase() ?? "";
  const supplierRaw = searchParams.get("balanceOwnershipSupplierId")?.trim();
  const supplierId = supplierRaw && supplierRaw.length > 0 ? supplierRaw : null;

  const mode: ParsedInventoryOwnershipBf79BalanceFilter["mode"] =
    modeRaw === "company" ? "company" : modeRaw === "vendor" ? "vendor" : "all";

  if (mode === "all" && !supplierId) return null;
  return { mode, supplierId };
}

export function echoInventoryOwnershipBf79Filter(
  f: ParsedInventoryOwnershipBf79BalanceFilter | null | undefined,
): InventoryOwnershipBalanceFilterEchoBf79 {
  return {
    schemaVersion: INVENTORY_OWNERSHIP_BF79_SCHEMA_VERSION,
    mode: f?.mode ?? "all",
    supplierId: f?.supplierId ?? null,
  };
}

/** Narrow `balances` Prisma where from parsed URL filter. */
export function inventoryOwnershipBf79FilterToWhere(
  f: ParsedInventoryOwnershipBf79BalanceFilter | null | undefined,
): Prisma.InventoryBalanceWhereInput | undefined {
  if (!f) return undefined;
  if (f.supplierId) {
    return { inventoryOwnershipSupplierIdBf79: f.supplierId };
  }
  if (f.mode === "company") {
    return { inventoryOwnershipSupplierIdBf79: null };
  }
  if (f.mode === "vendor") {
    return { inventoryOwnershipSupplierIdBf79: { not: null } };
  }
  return undefined;
}
