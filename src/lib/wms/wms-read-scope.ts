import type { Prisma } from "@prisma/client";

import { userIsSuperuser } from "@/lib/authz";
import {
  type CrmAccessScope,
  crmAccountInScope,
  getCrmAccessScope,
  getCrmOwnerUserScopeWhere,
} from "@/lib/crm-scope";
import { controlTowerShipmentAccessWhere, getControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { purchaseOrderWhereWithViewerScope } from "@/lib/org-scope";
import { prisma } from "@/lib/prisma";

export type WmsViewReadScope = {
  crmAccess: CrmAccessScope;
  wmsTask: Prisma.WmsTaskWhereInput;
  wmsWave: Prisma.WmsWaveWhereInput;
  outboundOrder: Prisma.OutboundOrderWhereInput;
  /** Inventory balances / movements / replenishment product filter (undefined = tenant-wide by product). */
  inventoryProduct: Prisma.ProductWhereInput | undefined;
  wmsBillingEvent: Prisma.WmsBillingEventWhereInput;
  shipment: Prisma.ShipmentWhereInput;
  shipmentItem: Prisma.ShipmentItemWhereInput;
};

async function wmsProductDivisionWhere(
  tenantId: string,
  actorUserId: string,
): Promise<Prisma.ProductWhereInput | undefined> {
  if (await userIsSuperuser(actorUserId)) return undefined;
  const user = await prisma.user.findFirst({
    where: { id: actorUserId, tenantId, isActive: true },
    select: { productDivisionScope: { select: { productDivisionId: true } } },
  });
  const divIds = user?.productDivisionScope.map((s) => s.productDivisionId) ?? [];
  if (divIds.length === 0) return undefined;
  return {
    OR: [{ divisionId: { in: divIds } }, { divisionId: null }],
  } satisfies Prisma.ProductWhereInput;
}

/**
 * WMS workbench / dashboard + billing reads: org + product-division rules consistent with
 * purchase orders, CRM account ownership, and Control Tower (shipments on linked POs).
 */
export async function loadWmsViewReadScope(
  tenantId: string,
  actorUserId: string,
): Promise<WmsViewReadScope> {
  if (await userIsSuperuser(actorUserId)) {
    const [sh, crmAccess] = await Promise.all([
      controlTowerShipmentAccessWhere(
        tenantId,
        await getControlTowerPortalContext(actorUserId),
        actorUserId,
      ),
      getCrmAccessScope(tenantId, actorUserId),
    ]);
    return {
      crmAccess,
      wmsTask: {},
      wmsWave: {},
      outboundOrder: {},
      inventoryProduct: undefined,
      wmsBillingEvent: {},
      shipment: sh,
      shipmentItem: { shipment: sh },
    };
  }

  const [poWhere, userW, crmAcc, inventoryProduct, ctCtx] = await Promise.all([
    purchaseOrderWhereWithViewerScope(tenantId, actorUserId, { tenantId }),
    getCrmOwnerUserScopeWhere(tenantId, actorUserId),
    getCrmAccessScope(tenantId, actorUserId),
    wmsProductDivisionWhere(tenantId, actorUserId),
    getControlTowerPortalContext(actorUserId),
  ]);

  const internalTask: Prisma.WmsTaskWhereInput = { orderId: null, shipmentId: null };
  if (userW) {
    internalTask.createdBy = { is: userW };
  }

  const wmsTask: Prisma.WmsTaskWhereInput = {
    OR: [
      { order: poWhere },
      { shipment: { order: poWhere } },
      internalTask,
    ],
  };

  const taskInWave: Prisma.WmsTaskWhereInput = { tenantId, ...wmsTask };
  const waveOrs: Prisma.WmsWaveWhereInput[] = [{ tasks: { some: taskInWave } }];
  if (userW) {
    waveOrs.push({ createdBy: { is: userW } });
  } else {
    waveOrs.push({ id: { not: "" } });
  }
  const wmsWave: Prisma.WmsWaveWhereInput = { OR: waveOrs };

  const outboundOr: Prisma.OutboundOrderWhereInput[] = [
    { crmAccount: crmAccountInScope(tenantId, crmAcc) },
  ];
  if (userW) {
    outboundOr.push({ createdBy: { is: userW } });
  } else {
    outboundOr.push({ crmAccountId: null });
  }
  const outboundOrder: Prisma.OutboundOrderWhereInput = { OR: outboundOr };

  const beParts: Prisma.WmsBillingEventWhereInput[] = [
    { OR: [{ crmAccount: crmAccountInScope(tenantId, crmAcc) }, { crmAccountId: null }] },
  ];
  if (inventoryProduct) {
    beParts.push({ product: inventoryProduct });
  }
  const wmsBillingEvent: Prisma.WmsBillingEventWhereInput =
    beParts.length === 1 ? beParts[0]! : { AND: beParts };

  const shipment = await controlTowerShipmentAccessWhere(tenantId, ctCtx, actorUserId);

  return {
    crmAccess: crmAcc,
    wmsTask,
    wmsWave,
    outboundOrder,
    inventoryProduct,
    wmsBillingEvent,
    shipment,
    shipmentItem: { shipment },
  };
}
