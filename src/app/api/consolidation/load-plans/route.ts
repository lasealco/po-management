import { NextResponse } from "next/server";
import { getActorUserId, requireApiGrant, userHasRoleNamed } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

type CreateLoadPlanBody = {
  reference?: string;
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
  notes?: string | null;
};

async function gateBuyerConsolidationAccess() {
  const gate = await requireApiGrant("org.orders", "view");
  if (gate) return gate;
  const actorId = await getActorUserId();
  if (!actorId) {
    return NextResponse.json({ error: "No active demo actor." }, { status: 403 });
  }
  const isSupplierPortalUser = await userHasRoleNamed(actorId, "Supplier portal");
  if (isSupplierPortalUser) {
    return NextResponse.json(
      { error: "Supplier users cannot manage buyer consolidation." },
      { status: 403 },
    );
  }
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }
  return { actorId, tenant };
}

export async function GET() {
  const access = await gateBuyerConsolidationAccess();
  if (access instanceof NextResponse) return access;

  const [plans, warehouses] = await Promise.all([
    prisma.loadPlan.findMany({
      where: { tenantId: access.tenant.id },
      orderBy: { createdAt: "desc" },
      include: {
        warehouse: { select: { id: true, name: true, code: true, type: true } },
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
    prisma.warehouse.findMany({
      where: { tenantId: access.tenant.id, isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
      },
    }),
  ]);

  return NextResponse.json({
    warehouses,
    loadPlans: plans.map((plan) => ({
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
            (itemsSum, item) =>
              itemsSum + (Number(item.quantityShipped) - Number(item.quantityReceived)),
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
                (s, item) =>
                  s + (Number(item.quantityShipped) - Number(item.quantityReceived)) * 0.02,
                0,
              ),
          ),
        0,
      ),
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const access = await gateBuyerConsolidationAccess();
  if (access instanceof NextResponse) return access;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const input = (body && typeof body === "object" ? body : {}) as CreateLoadPlanBody;
  const reference = (input.reference ?? "").trim();
  if (!reference) {
    return NextResponse.json({ error: "reference is required." }, { status: 400 });
  }
  if (!input.warehouseId) {
    return NextResponse.json({ error: "warehouseId is required." }, { status: 400 });
  }

  const warehouse = await prisma.warehouse.findFirst({
    where: { id: input.warehouseId, tenantId: access.tenant.id, isActive: true },
    select: { id: true },
  });
  if (!warehouse) {
    return NextResponse.json({ error: "Warehouse not found." }, { status: 404 });
  }

  const plannedEta =
    input.plannedEta && input.plannedEta.trim()
      ? new Date(`${input.plannedEta}T00:00:00.000Z`)
      : null;
  if (plannedEta && Number.isNaN(plannedEta.getTime())) {
    return NextResponse.json({ error: "plannedEta must be a valid date." }, { status: 400 });
  }

  try {
    const created = await prisma.loadPlan.create({
      data: {
        tenantId: access.tenant.id,
        reference,
        warehouseId: input.warehouseId,
        transportMode: input.transportMode ?? "OCEAN",
        containerSize: input.containerSize ?? "LCL",
        plannedEta,
        notes: input.notes?.trim() || null,
        createdById: access.actorId,
      },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id: created.id });
  } catch {
    return NextResponse.json(
      { error: "Could not create load plan (reference may already exist)." },
      { status: 400 },
    );
  }
}
