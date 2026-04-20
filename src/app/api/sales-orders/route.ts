import { NextResponse } from "next/server";

import type { Prisma } from "@prisma/client";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { nextSalesOrderNumber, parseSalesOrdersListQuery, salesOrdersListPrismaWhere } from "@/lib/sales-orders";

/** Matches `SalesOrderCreateForm` option values for logistics-only SRM suppliers. */
const SUPPLIER_CUSTOMER_PREFIX = "__supplier__:";

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.orders", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  const url = new URL(request.url);
  const listQuery = parseSalesOrdersListQuery(url.searchParams);
  const where = salesOrdersListPrismaWhere(tenant.id, listQuery);

  const rows = await prisma.salesOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      soNumber: true,
      status: true,
      customerName: true,
      externalRef: true,
      requestedDeliveryDate: true,
      createdAt: true,
      _count: { select: { shipments: true } },
    },
  });

  return NextResponse.json({
    salesOrders: rows.map((r) => ({
      ...r,
      requestedDeliveryDate: r.requestedDeliveryDate?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      shipmentCount: r._count.shipments,
    })),
  });
}

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.orders", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  const tenantId = tenant.id;
  const actorId = await getActorUserId();
  if (!actorId) return NextResponse.json({ error: "No active user." }, { status: 403 });

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const customerRaw =
    typeof o.customerCrmAccountId === "string" ? o.customerCrmAccountId.trim() : "";
  if (!customerRaw) {
    return NextResponse.json({ error: "customerCrmAccountId is required." }, { status: 400 });
  }
  const soNumberRaw = typeof o.soNumber === "string" ? o.soNumber.trim() : "";
  const soNumber = soNumberRaw || (await nextSalesOrderNumber(tenantId));
  const externalRef = typeof o.externalRef === "string" ? o.externalRef.trim() || null : null;
  const requestedDeliveryDateRaw = typeof o.requestedDeliveryDate === "string" ? o.requestedDeliveryDate.trim() : "";
  const requestedDeliveryDate = requestedDeliveryDateRaw ? new Date(requestedDeliveryDateRaw) : null;
  if (requestedDeliveryDate && Number.isNaN(requestedDeliveryDate.getTime())) {
    return NextResponse.json({ error: "Invalid requestedDeliveryDate." }, { status: 400 });
  }
  const shipmentId = typeof o.shipmentId === "string" ? o.shipmentId.trim() : "";

  async function resolveBillToAccount(
    tx: Prisma.TransactionClient,
    raw: string,
    ownerUserId: string,
  ): Promise<{ id: string; name: string }> {
    if (raw.startsWith(SUPPLIER_CUSTOMER_PREFIX)) {
      const supplierId = raw.slice(SUPPLIER_CUSTOMER_PREFIX.length);
      const supplier = await tx.supplier.findFirst({
        where: {
          id: supplierId,
          tenantId,
          isActive: true,
          approvalStatus: "approved",
          srmCategory: "logistics",
        },
        select: { id: true, name: true, legalName: true },
      });
      if (!supplier) {
        throw new Error("Forwarder supplier not found or not eligible.");
      }
      let acc = await tx.crmAccount.findFirst({
        where: {
          tenantId,
          lifecycle: "ACTIVE",
          accountType: { in: ["AGENT", "PARTNER"] },
          name: { equals: supplier.name, mode: "insensitive" },
        },
        select: { id: true, name: true },
      });
      if (!acc) {
        acc = await tx.crmAccount.findFirst({
          where: {
            tenantId,
            lifecycle: "ACTIVE",
            name: { equals: supplier.name, mode: "insensitive" },
          },
          select: { id: true, name: true },
        });
      }
      if (!acc) {
        acc = await tx.crmAccount.create({
          data: {
            tenantId,
            ownerUserId,
            name: supplier.name,
            legalName: supplier.legalName ?? undefined,
            accountType: "AGENT",
            lifecycle: "ACTIVE",
          },
          select: { id: true, name: true },
        });
      }
      return acc;
    }

    const account = await tx.crmAccount.findFirst({
      where: { id: raw, tenantId },
      select: { id: true, name: true },
    });
    if (!account) {
      throw new Error("Customer CRM account not found.");
    }
    return account;
  }

  let created: { id: string; soNumber: string };
  try {
    created = await prisma.$transaction(async (tx) => {
      const account = await resolveBillToAccount(tx, customerRaw, actorId);
      const row = await tx.salesOrder.create({
        data: {
          tenantId,
          soNumber,
          customerName: account.name,
          customerCrmAccountId: account.id,
          externalRef,
          requestedDeliveryDate,
          createdById: actorId,
          status: "DRAFT",
        },
        select: { id: true, soNumber: true },
      });
      if (shipmentId) {
        const ship = await tx.shipment.findFirst({
          where: { id: shipmentId, order: { tenantId } },
          select: { id: true },
        });
        if (!ship) throw new Error("Shipment not found.");
        await tx.shipment.update({
          where: { id: shipmentId },
          data: { salesOrderId: row.id },
        });
      }
      return row;
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "Shipment not found.") {
      return NextResponse.json({ error: "Shipment not found." }, { status: 404 });
    }
    if (msg === "Forwarder supplier not found or not eligible.") {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg === "Customer CRM account not found.") {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    throw e;
  }

  return NextResponse.json({ ok: true, id: created.id, soNumber: created.soNumber });
}
