import { NextResponse } from "next/server";
import { actorIsSupplierPortalRestricted, getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


type PatchLoadPlanBody = {
  warehouseId?: string;
  transportMode?: "OCEAN" | "AIR" | "ROAD" | "RAIL";
  containerSize?:
    | "LCL"
    | "FCL_20"
    | "FCL_40"
    | "FCL_40HC"
    | "TRUCK_13_6"
    | "AIR_ULD";
  plannedEta?: string | null;
  status?: "DRAFT" | "FINALIZED" | "CANCELLED";
  notes?: string | null;
};

async function gateBuyerConsolidationAccess() {
  const gate = await requireApiGrant("org.orders", "view");
  if (gate) return gate;
  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active demo actor.", code: "FORBIDDEN", status: 403 });
  }
  const isSupplierPortalUser = await actorIsSupplierPortalRestricted(actorId);
  if (isSupplierPortalUser) {
    return toApiErrorResponse({ error: "Supplier users cannot manage buyer consolidation.", code: "FORBIDDEN", status: 403 });
  }
  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  return { actorId, tenant };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await gateBuyerConsolidationAccess();
  if (access instanceof NextResponse) return access;
  const { id } = await context.params;

  const plan = await prisma.loadPlan.findFirst({
    where: { id, tenantId: access.tenant.id },
    include: {
      warehouse: { select: { id: true, name: true, code: true, type: true } },
      assignments: {
        orderBy: { createdAt: "desc" },
        include: {
          shipment: {
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
                  id: true,
                  quantityShipped: true,
                  quantityReceived: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!plan) {
    return toApiErrorResponse({ error: "Load plan not found.", code: "NOT_FOUND", status: 404 });
  }

  const shipments = plan.assignments.map((assignment) => {
    const remainingUnits = assignment.shipment.items.reduce(
      (sum, row) => sum + (Number(row.quantityShipped) - Number(row.quantityReceived)),
      0,
    );
    return {
      shipmentId: assignment.shipment.id,
      shipmentNo: assignment.shipment.shipmentNo || `ASN-${assignment.shipment.id.slice(0, 8)}`,
      orderId: assignment.shipment.order.id,
      orderNumber: assignment.shipment.order.orderNumber,
      supplierName: assignment.shipment.order.supplier?.name || "No supplier",
      carrier: assignment.shipment.carrier,
      shippedAt: assignment.shipment.shippedAt.toISOString(),
      transportMode: assignment.shipment.transportMode,
      estimatedVolumeCbm:
        assignment.shipment.estimatedVolumeCbm?.toString() ?? null,
      estimatedWeightKg:
        assignment.shipment.estimatedWeightKg?.toString() ??
        (remainingUnits * 18).toFixed(3),
      remainingUnits,
      lineCount: assignment.shipment.items.length,
    };
  });

  return NextResponse.json({
    id: plan.id,
    reference: plan.reference,
    status: plan.status,
    transportMode: plan.transportMode,
    containerSize: plan.containerSize,
    plannedEta: plan.plannedEta?.toISOString() ?? null,
    notes: plan.notes,
    warehouse: plan.warehouse,
    shipments,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await gateBuyerConsolidationAccess();
  if (access instanceof NextResponse) return access;
  const { id } = await context.params;

  const existing = await prisma.loadPlan.findFirst({
    where: { id, tenantId: access.tenant.id },
    select: { id: true, status: true },
  });
  if (!existing) {
    return toApiErrorResponse({ error: "Load plan not found.", code: "NOT_FOUND", status: 404 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const input = (body && typeof body === "object" ? body : {}) as PatchLoadPlanBody;
  const patch: {
    warehouseId?: string;
    transportMode?: "OCEAN" | "AIR" | "ROAD" | "RAIL";
    containerSize?:
      | "LCL"
      | "FCL_20"
      | "FCL_40"
      | "FCL_40HC"
      | "TRUCK_13_6"
      | "AIR_ULD";
    plannedEta?: Date | null;
    status?: "DRAFT" | "FINALIZED" | "CANCELLED";
    notes?: string | null;
  } = {};

  if (typeof input.warehouseId === "string") {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: input.warehouseId, tenantId: access.tenant.id, isActive: true },
      select: { id: true },
    });
    if (!warehouse) {
      return toApiErrorResponse({ error: "Warehouse not found.", code: "NOT_FOUND", status: 404 });
    }
    patch.warehouseId = input.warehouseId;
  }
  if (input.plannedEta !== undefined) {
    if (!input.plannedEta) {
      patch.plannedEta = null;
    } else {
      const parsed = new Date(`${input.plannedEta}T00:00:00.000Z`);
      if (Number.isNaN(parsed.getTime())) {
        return toApiErrorResponse({ error: "plannedEta must be a valid date.", code: "BAD_INPUT", status: 400 });
      }
      patch.plannedEta = parsed;
    }
  }
  if (input.status) {
    const current = existing.status;
    const next = input.status;
    const valid =
      (current === "DRAFT" && (next === "FINALIZED" || next === "CANCELLED")) ||
      (current === "FINALIZED" && (next === "DRAFT" || next === "CANCELLED")) ||
      (current === "CANCELLED" && next === "DRAFT");
    if (!valid) {
      return toApiErrorResponse({ error: `Invalid status transition: ${current} -> ${next}.`, code: "BAD_INPUT", status: 400 });
    }
    patch.status = next;
  }
  if (input.transportMode) {
    patch.transportMode = input.transportMode;
  }
  if (input.containerSize) {
    patch.containerSize = input.containerSize;
  }
  if (input.notes !== undefined) {
    patch.notes = input.notes?.trim() || null;
  }

  // Lock metadata while not in DRAFT (except status change back to DRAFT).
  if (existing.status !== "DRAFT") {
    const touchedMetadata =
      patch.warehouseId !== undefined ||
      patch.transportMode !== undefined ||
      patch.containerSize !== undefined ||
      patch.plannedEta !== undefined ||
      patch.notes !== undefined;
    if (touchedMetadata) {
      return toApiErrorResponse({ error: "Only DRAFT load plans can edit metadata.", code: "BAD_INPUT", status: 400 });
    }
  }

  await prisma.loadPlan.update({
    where: { id },
    data: patch,
  });
  return NextResponse.json({ ok: true });
}
