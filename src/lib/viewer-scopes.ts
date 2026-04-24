/**
 * Phase 8 — **read-scope policy surface** (pragmatic, not a full rules engine):
 * one import path for org / product-division / customer / supplier-portal / CT / WMS read rules.
 *
 * Product “policy engine” (conditions + effects, centralized evaluation) is still a product decision;
 * this module **documents and composes** the code paths that already exist so new routes and reports
 * use the same building blocks. See `docs/engineering/READ_SCOPE_INVENTORY.md` and
 * `scripts/read-scope-audit-hints.mjs`.
 */

import type { Prisma } from "@prisma/client";

import {
  actorIsCustomerCrmScoped,
  actorIsSupplierPortalRestricted,
  userIsSuperuser,
} from "@/lib/authz";
import {
  crmAccountInScope,
  crmOwnerRelationClause,
  getCrmAccessScope,
  getCrmOwnerUserScopeWhere,
  type CrmAccessScope,
} from "@/lib/crm-scope";
import {
  controlTowerBaseOrderWhere,
  controlTowerShipmentAccessWhere,
  controlTowerShipmentScopeWhere,
  getControlTowerPortalContext,
  type ControlTowerPortalContext,
} from "@/lib/control-tower/viewer";
import {
  getPurchaseOrderScopeWhere,
  loadOrgUnitSubtreeIds,
  orgUnitSubtreeIds,
  purchaseOrderWhereWithViewerScope,
} from "@/lib/org-scope";
import { loadWmsViewReadScope, type WmsViewReadScope } from "@/lib/wms/wms-read-scope";

export {
  crmAccountInScope,
  crmOwnerRelationClause,
  getCrmAccessScope,
  getCrmOwnerUserScopeWhere,
  type CrmAccessScope,
  controlTowerBaseOrderWhere,
  controlTowerShipmentAccessWhere,
  controlTowerShipmentScopeWhere,
  getControlTowerPortalContext,
  type ControlTowerPortalContext,
  getPurchaseOrderScopeWhere,
  loadOrgUnitSubtreeIds,
  orgUnitSubtreeIds,
  purchaseOrderWhereWithViewerScope,
  loadWmsViewReadScope,
  type WmsViewReadScope,
  actorIsCustomerCrmScoped,
  actorIsSupplierPortalRestricted,
  userIsSuperuser,
};

export type ViewerReadScopeBundle = {
  tenantId: string;
  actorUserId: string;
  wms: WmsViewReadScope;
  isSupplierPortal: boolean;
  isCustomerCrmScoped: boolean;
  isSuperuser: boolean;
  /**
   * Merges purchase-order org / division / customer / supplier-portal rules with `base`
   * (use for lists, groupBy, aggregates).
   */
  mergePurchaseOrderWhere: (
    base: Prisma.PurchaseOrderWhereInput,
  ) => Promise<Prisma.PurchaseOrderWhereInput>;
};

/**
 * Loads WMS+CT+CRM composite scope **once** and exposes a PO merge helper. Prefer this over
 * ad-hoc `Promise.all` of the same modules in new code paths. UI flags (`getControlTowerPortalContext`)
 * can be requested separately when needed; they are already evaluated inside WMS/CT lower layers
 * (may duplicate a DB read in those paths until a shared context cache exists).
 */
export async function loadViewerReadScopeBundle(
  tenantId: string,
  actorUserId: string,
): Promise<ViewerReadScopeBundle> {
  const [wms, isSupplier, isCustomer, isSuper] = await Promise.all([
    loadWmsViewReadScope(tenantId, actorUserId),
    actorIsSupplierPortalRestricted(actorUserId),
    actorIsCustomerCrmScoped(actorUserId),
    userIsSuperuser(actorUserId),
  ]);

  return {
    tenantId,
    actorUserId,
    wms,
    isSupplierPortal: isSupplier,
    isCustomerCrmScoped: isCustomer,
    isSuperuser: isSuper,
    mergePurchaseOrderWhere: (base) =>
      purchaseOrderWhereWithViewerScope(tenantId, actorUserId, base, {
        isSupplierPortalUser: isSupplier,
      }),
  };
}
