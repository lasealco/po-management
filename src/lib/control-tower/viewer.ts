import { userHasRoleNamed } from "@/lib/authz";
import { Prisma } from "@prisma/client";

/** Supplier portal users get customer-safe payloads only. */
export async function isControlTowerCustomerView(actorUserId: string) {
  return userHasRoleNamed(actorUserId, "Supplier portal");
}

/** Extra `order` filter when listing shipments for supplier portal (same idea as orders API). */
export function controlTowerOrderWhere(
  isCustomer: boolean,
): Prisma.PurchaseOrderWhereInput {
  if (!isCustomer) return {};
  return { workflow: { supplierPortalOn: true } };
}
