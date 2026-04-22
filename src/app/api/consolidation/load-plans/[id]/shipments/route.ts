import { NextResponse } from "next/server";
import { actorIsSupplierPortalRestricted, getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


type AddShipmentBody = { shipmentId?: string };

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
  return { tenant };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await gateBuyerConsolidationAccess();
  if (access instanceof NextResponse) return access;
  const { id: loadPlanId } = await context.params;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const input = (body && typeof body === "object" ? body : {}) as AddShipmentBody;
  if (!input.shipmentId) {
    return toApiErrorResponse({ error: "shipmentId is required.", code: "BAD_INPUT", status: 400 });
  }

  const [plan, shipment] = await Promise.all([
    prisma.loadPlan.findFirst({
      where: { id: loadPlanId, tenantId: access.tenant.id },
      select: { id: true, status: true, transportMode: true },
    }),
    prisma.shipment.findFirst({
      where: { id: input.shipmentId, order: { tenantId: access.tenant.id } },
      include: {
        items: { select: { quantityShipped: true, quantityReceived: true } },
      },
    }),
  ]);
  if (!plan) {
    return toApiErrorResponse({ error: "Load plan not found.", code: "NOT_FOUND", status: 404 });
  }
  if (plan.status !== "DRAFT") {
    return toApiErrorResponse({ error: "Only DRAFT load plans can be changed.", code: "BAD_INPUT", status: 400 });
  }
  if (!shipment) {
    return toApiErrorResponse({ error: "Shipment not found.", code: "NOT_FOUND", status: 404 });
  }
  if (shipment.transportMode && shipment.transportMode !== plan.transportMode) {
    return toApiErrorResponse({ error: `Shipment mode (${shipment.transportMode}) does not match load mode (${plan.transportMode}).`, code: "BAD_INPUT", status: 400 });
  }
  const remainingUnits = shipment.items.reduce(
    (sum, row) => sum + (Number(row.quantityShipped) - Number(row.quantityReceived)),
    0,
  );
  if (remainingUnits <= 0) {
    return toApiErrorResponse({ error: "Shipment is fully received and cannot be consolidated.", code: "BAD_INPUT", status: 400 });
  }

  try {
    await prisma.loadPlanShipment.create({
      data: {
        loadPlanId,
        shipmentId: input.shipmentId,
      },
    });
  } catch {
    return toApiErrorResponse({ error: "Shipment is already assigned to another load plan.", code: "BAD_INPUT", status: 400 });
  }

  return NextResponse.json({ ok: true });
}
