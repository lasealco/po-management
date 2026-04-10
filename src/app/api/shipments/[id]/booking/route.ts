import { NextResponse } from "next/server";
import { getActorUserId, requireApiGrant, userHasRoleNamed } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

type BookingBody = {
  mode?: "draft" | "confirm" | "cancel";
  bookingNo?: string | null;
  serviceLevel?: string | null;
  forwarderSupplierId?: string | null;
  forwarderOfficeId?: string | null;
  forwarderContactId?: string | null;
  transportMode?: "OCEAN" | "AIR" | "ROAD" | "RAIL" | null;
  originCode?: string | null;
  destinationCode?: string | null;
  etd?: string | null;
  eta?: string | null;
  latestEta?: string | null;
  notes?: string | null;
};

function parseDate(v: string | null | undefined) {
  if (!v || !v.trim()) return null;
  const d = new Date(`${v.trim()}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return "invalid";
  return d;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.orders", "transition");
  if (gate) return gate;

  const actorId = await getActorUserId();
  if (!actorId) {
    return NextResponse.json({ error: "No active demo actor." }, { status: 403 });
  }
  const isSupplier = await userHasRoleNamed(actorId, "Supplier portal");
  if (isSupplier) {
    return NextResponse.json(
      { error: "Supplier users cannot manage forwarder booking." },
      { status: 403 },
    );
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const { id: shipmentId } = await context.params;
  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, order: { tenantId: tenant.id } },
    select: { id: true, status: true },
  });
  if (!shipment) {
    return NextResponse.json({ error: "Shipment not found." }, { status: 404 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const input = (body && typeof body === "object" ? body : {}) as BookingBody;
  const mode = input.mode ?? "draft";
  if (!["draft", "confirm", "cancel"].includes(mode)) {
    return NextResponse.json({ error: "Invalid booking mode." }, { status: 400 });
  }

  const etd = parseDate(input.etd);
  const eta = parseDate(input.eta);
  const latestEta = parseDate(input.latestEta);
  if (etd === "invalid" || eta === "invalid" || latestEta === "invalid") {
    return NextResponse.json({ error: "Invalid booking date field." }, { status: 400 });
  }

  const forwarderSupplierId = input.forwarderSupplierId?.trim() || null;
  const forwarderOfficeId = input.forwarderOfficeId?.trim() || null;
  const forwarderContactId = input.forwarderContactId?.trim() || null;
  if (forwarderSupplierId) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: forwarderSupplierId, tenantId: tenant.id, isActive: true },
      select: { id: true },
    });
    if (!supplier) {
      return NextResponse.json({ error: "Invalid forwarder supplier." }, { status: 400 });
    }
    if (forwarderOfficeId) {
      const office = await prisma.supplierOffice.findFirst({
        where: {
          id: forwarderOfficeId,
          supplierId: supplier.id,
          tenantId: tenant.id,
          isActive: true,
        },
        select: { id: true },
      });
      if (!office) {
        return NextResponse.json({ error: "Invalid forwarder office." }, { status: 400 });
      }
    }
    if (forwarderContactId) {
      const contact = await prisma.supplierContact.findFirst({
        where: {
          id: forwarderContactId,
          supplierId: supplier.id,
          tenantId: tenant.id,
        },
        select: { id: true },
      });
      if (!contact) {
        return NextResponse.json({ error: "Invalid forwarder contact." }, { status: 400 });
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.shipmentBooking.upsert({
      where: { shipmentId: shipment.id },
      create: {
        shipmentId: shipment.id,
        status: mode === "confirm" ? "CONFIRMED" : mode === "cancel" ? "CANCELLED" : "DRAFT",
        bookingNo: input.bookingNo?.trim() || null,
        serviceLevel: input.serviceLevel?.trim() || null,
        forwarderSupplierId,
        forwarderOfficeId,
        forwarderContactId,
        mode: input.transportMode ?? null,
        originCode: input.originCode?.trim() || null,
        destinationCode: input.destinationCode?.trim() || null,
        etd: etd || null,
        eta: eta || null,
        latestEta: latestEta || null,
        notes: input.notes?.trim() || null,
        createdById: actorId,
        updatedById: actorId,
      },
      update: {
        status: mode === "confirm" ? "CONFIRMED" : mode === "cancel" ? "CANCELLED" : "DRAFT",
        bookingNo: input.bookingNo?.trim() || null,
        serviceLevel: input.serviceLevel?.trim() || null,
        forwarderSupplierId,
        forwarderOfficeId,
        forwarderContactId,
        mode: input.transportMode ?? null,
        originCode: input.originCode?.trim() || null,
        destinationCode: input.destinationCode?.trim() || null,
        etd: etd || null,
        eta: eta || null,
        latestEta: latestEta || null,
        notes: input.notes?.trim() || null,
        updatedById: actorId,
      },
    });

    if (mode === "confirm") {
      await tx.shipment.update({
        where: { id: shipment.id },
        data: { status: "BOOKED" },
      });
      await tx.shipmentMilestone.create({
        data: {
          shipmentId: shipment.id,
          code: "BOOKING_CONFIRMED",
          source: "INTERNAL",
          actualAt: new Date(),
          note: input.bookingNo?.trim()
            ? `Booking confirmed: ${input.bookingNo.trim()}`
            : "Booking confirmed",
          updatedById: actorId,
        },
      });
    }
    if (mode === "cancel") {
      await tx.shipment.update({
        where: { id: shipment.id },
        data: { status: "VALIDATED" },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
