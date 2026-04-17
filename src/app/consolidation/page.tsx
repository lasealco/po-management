import { AccessDenied } from "@/components/access-denied";
import { ConsolidationPlanner } from "@/components/consolidation-planner";
import {
  actorIsSupplierPortalRestricted,
  getActorUserId,
  getViewerGrantSet,
  viewerHas,
} from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ConsolidationPage() {
  const access = await getViewerGrantSet();
  if (!access) {
    return (
      <AccessDenied
        title="Demo tenant missing"
        message="Run npm run db:seed on the same database, then reload."
      />
    );
  }

  const canViewOrders = viewerHas(access.grantSet, "org.orders", "view");
  if (!canViewOrders) {
    return (
      <AccessDenied
        title="Access denied"
        message="You need org.orders -> view to open consolidation planning."
      />
    );
  }

  const actorId = await getActorUserId();
  const isSupplierPortalUser =
    actorId !== null && (await actorIsSupplierPortalRestricted(actorId));
  if (isSupplierPortalUser) {
    return (
      <AccessDenied
        title="Buyer view only"
        message="Consolidation planning is for buyer operations."
      />
    );
  }

  const [shipments, warehouses, loadPlans, assignedRows] = await Promise.all([
    prisma.shipment.findMany({
      where: {
        order: { tenantId: access.tenant.id },
      },
      orderBy: { shippedAt: "desc" },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            supplier: { select: { name: true } },
          },
        },
        items: {
          select: {
            quantityShipped: true,
            quantityReceived: true,
          },
        },
      },
    }),
    prisma.warehouse.findMany({
      where: { tenantId: access.tenant.id, isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true, type: true },
    }),
    prisma.loadPlan.findMany({
      where: { tenantId: access.tenant.id },
      orderBy: { createdAt: "desc" },
      include: {
        warehouse: { select: { id: true, code: true, name: true, type: true } },
        assignments: {
          include: {
            shipment: {
              include: {
                items: {
                  select: { quantityShipped: true, quantityReceived: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.loadPlanShipment.findMany({
      where: { loadPlan: { tenantId: access.tenant.id } },
      select: { shipmentId: true },
    }),
  ]);
  const assignedShipmentIds = new Set(assignedRows.map((row) => row.shipmentId));

  const available = shipments
    .map((shipment) => {
      const remainingUnits = shipment.items.reduce(
        (sum, row) => sum + (Number(row.quantityShipped) - Number(row.quantityReceived)),
        0,
      );
      return {
        shipmentId: shipment.id,
        shipmentNo: shipment.shipmentNo || `ASN-${shipment.id.slice(0, 8)}`,
        orderId: shipment.order.id,
        orderNumber: shipment.order.orderNumber,
        supplierName: shipment.order.supplier?.name || "No supplier",
        carrier: shipment.carrier,
        shippedAt: shipment.shippedAt.toISOString(),
        transportMode: shipment.transportMode ?? null,
        estimatedVolumeCbm:
          shipment.estimatedVolumeCbm?.toString() ??
          (remainingUnits * 0.02).toFixed(3),
        estimatedWeightKg:
          shipment.estimatedWeightKg?.toString() ??
          (remainingUnits * 18).toFixed(3),
        remainingUnits,
        lineCount: shipment.items.length,
      };
    })
    .filter((row) => row.remainingUnits > 0 && !assignedShipmentIds.has(row.shipmentId));

  return (
    <div className="min-h-screen bg-zinc-50">
      <ConsolidationPlanner
        initialAvailable={available}
        initialWarehouses={warehouses}
        initialLoadPlans={loadPlans.map((plan) => ({
          id: plan.id,
          reference: plan.reference,
          status: plan.status,
          transportMode: plan.transportMode,
          containerSize: plan.containerSize,
          plannedEta: plan.plannedEta?.toISOString() ?? null,
          notes: plan.notes,
          warehouse: plan.warehouse,
          shipmentCount: plan.assignments.length,
          unitCount: plan.assignments.reduce(
            (sum, assignment) =>
              sum +
              assignment.shipment.items.reduce(
                (s, row) => s + (Number(row.quantityShipped) - Number(row.quantityReceived)),
                0,
              ),
            0,
          ),
          volumeCbm: plan.assignments.reduce(
            (sum, assignment) =>
              sum +
              Number(
                assignment.shipment.estimatedVolumeCbm ??
                  assignment.shipment.items.reduce(
                    (s, row) =>
                      s + (Number(row.quantityShipped) - Number(row.quantityReceived)) * 0.02,
                    0,
                  ),
              ),
            0,
          ),
        }))}
      />
    </div>
  );
}
