import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import type { Prisma } from "@prisma/client";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { nextSalesOrderNumber, parseSalesOrdersListQuery, salesOrdersListPrismaWhere } from "@/lib/sales-orders";
import {
  loadSerializedCompanyLegalForServedOrg,
  mapOrgUnitIdsToCompanyLegalNames,
} from "@/lib/sales-order-company-legal";
import { resolveServedOrgUnitIdForTenant } from "@/lib/served-org-unit";

/** Matches `SalesOrderCreateForm` option values for logistics-only SRM suppliers. */
const SUPPLIER_CUSTOMER_PREFIX = "__supplier__:";

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.orders", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });

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
      servedOrgUnit: { select: { id: true, name: true, code: true, kind: true } },
      _count: { select: { shipments: true } },
    },
  });

  const servedIds = rows
    .map((r) => r.servedOrgUnit?.id)
    .filter((x): x is string => Boolean(x));
  const legalNameByOrgUnit = await mapOrgUnitIdsToCompanyLegalNames(tenant.id, servedIds);

  return NextResponse.json({
    salesOrders: rows.map((r) => ({
      ...r,
      servedOrgUnit: r.servedOrgUnit
        ? {
            id: r.servedOrgUnit.id,
            name: r.servedOrgUnit.name,
            code: r.servedOrgUnit.code,
            kind: r.servedOrgUnit.kind,
          }
        : null,
      /** Registered legal name from Settings → Legal entities when a profile exists for the served org. */
      sellingEntityLegalName:
        r.servedOrgUnit ? legalNameByOrgUnit.get(r.servedOrgUnit.id) ?? null : null,
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
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const tenantId = tenant.id;
  const actorId = await getActorUserId();
  if (!actorId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const customerRaw =
    typeof o.customerCrmAccountId === "string" ? o.customerCrmAccountId.trim() : "";
  if (!customerRaw) {
    return toApiErrorResponse({ error: "customerCrmAccountId is required.", code: "BAD_INPUT", status: 400 });
  }
  const soNumberRaw = typeof o.soNumber === "string" ? o.soNumber.trim() : "";
  const soNumber = soNumberRaw || (await nextSalesOrderNumber(tenantId));
  const externalRef = typeof o.externalRef === "string" ? o.externalRef.trim() || null : null;
  const requestedDeliveryDateRaw = typeof o.requestedDeliveryDate === "string" ? o.requestedDeliveryDate.trim() : "";
  const requestedDeliveryDate = requestedDeliveryDateRaw ? new Date(requestedDeliveryDateRaw) : null;
  if (requestedDeliveryDate && Number.isNaN(requestedDeliveryDate.getTime())) {
    return toApiErrorResponse({ error: "Invalid requestedDeliveryDate.", code: "BAD_INPUT", status: 400 });
  }
  const shipmentId = typeof o.shipmentId === "string" ? o.shipmentId.trim() : "";
  const servedResolved = await resolveServedOrgUnitIdForTenant(tenantId, o.servedOrgUnitId);
  if (!servedResolved.ok) {
    return toApiErrorResponse({ error: servedResolved.error, code: "BAD_INPUT", status: 400 });
  }

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
          servedOrgUnitId: servedResolved.value,
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
      return toApiErrorResponse({ error: "Shipment not found.", code: "NOT_FOUND", status: 404 });
    }
    if (msg === "Forwarder supplier not found or not eligible.") {
      return toApiErrorResponse({ error: msg, code: "NOT_FOUND", status: 404 });
    }
    if (msg === "Customer CRM account not found.") {
      return toApiErrorResponse({ error: msg, code: "NOT_FOUND", status: 404 });
    }
    throw e;
  }

  const companyLegalEntity = await loadSerializedCompanyLegalForServedOrg(
    tenantId,
    servedResolved.value,
  );
  return NextResponse.json({ ok: true, id: created.id, soNumber: created.soNumber, companyLegalEntity });
}
