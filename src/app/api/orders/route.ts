import { NextResponse } from "next/server";
import { getActorUserId, requireApiGrant, userHasRoleNamed } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { visibleOnBoard } from "@/lib/workflow-actions";
import { Prisma } from "@prisma/client";

type CreateOrderItemInput = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

type CreateOrderBody = {
  supplierId?: string;
  buyerWarehouseId?: string | null;
  cfsWarehouseId?: string | null;
  forwarderSupplierId?: string | null;
  forwarderOfficeId?: string | null;
  forwarderContactId?: string | null;
  buyerOffice?: string;
  deliveryAddress?: {
    name?: string;
    line1?: string;
    line2?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    countryCode?: string;
  };
  forwarder?: string;
  adminNote?: string;
  notesToSupplier?: string;
  requestedDeliveryDate?: string | null;
  currency?: string;
  paymentTermsDays?: number | null;
  paymentTermsLabel?: string | null;
  incoterm?: string | null;
  taxPercent?: number | null;
  discountPercent?: number | null;
  discountAmount?: number | null;
  transportMode?: "OCEAN" | "AIR" | "ROAD" | "RAIL" | null;
  originCode?: string | null;
  destinationCode?: string | null;
  tags?: string[] | null;
  items?: CreateOrderItemInput[];
};

async function nextOrderNumber(tenantId: string) {
  const stamp = Date.now().toString().slice(-6);
  let candidate = `PO-${stamp}`;
  for (let i = 0; i < 8; i += 1) {
    const exists = await prisma.purchaseOrder.findFirst({
      where: { tenantId, orderNumber: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
    candidate = `PO-${stamp}-${i + 1}`;
  }
  return `PO-${stamp}-${Math.floor(Math.random() * 1000)}`;
}

export async function GET() {
  const gate = await requireApiGrant("org.orders", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json(
      {
        error:
          "Demo tenant not found. Run `npm run db:seed` to create starter data.",
      },
      { status: 404 },
    );
  }

  const actorId = await getActorUserId();
  const isSupplierPortalUser =
    actorId !== null && (await userHasRoleNamed(actorId, "Supplier portal"));
  const supplierOnlyActionCodes = new Set([
    "confirm",
    "decline",
    "propose_split",
    "mark_fulfilled",
  ]);
  const buyerOnlyActionCodes = new Set([
    "send_to_supplier",
    "buyer_accept_split",
    "buyer_reject_proposal",
    "buyer_cancel",
  ]);

  const orders = await prisma.purchaseOrder.findMany({
    where: {
      tenantId: tenant.id,
      splitParentId: null,
      ...(isSupplierPortalUser ? { workflow: { supplierPortalOn: true } } : {}),
    },
    include: {
      status: {
        select: { id: true, code: true, label: true },
      },
      supplier: {
        select: { id: true, name: true },
      },
      requester: {
        select: { id: true, name: true, email: true },
      },
      workflow: {
        select: {
          id: true,
          name: true,
          transitions: {
            select: {
              fromStatusId: true,
              toStatusId: true,
              actionCode: true,
              label: true,
              requiresComment: true,
              toStatus: {
                select: { id: true, code: true, label: true },
              },
            },
          },
        },
      },
      shipments: {
        select: {
          items: {
            select: {
              quantityShipped: true,
              quantityReceived: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const latestSharedByOrder = new Map<
    string,
    {
      createdAt: Date;
      authorRoleNames: string[];
    }
  >();
  if (orders.length > 0) {
    const shared = await prisma.orderChatMessage.findMany({
      where: { orderId: { in: orders.map((o) => o.id) }, isInternal: false },
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: {
            userRoles: {
              select: { role: { select: { name: true } } },
            },
          },
        },
      },
    });
    for (const row of shared) {
      if (latestSharedByOrder.has(row.orderId)) continue;
      latestSharedByOrder.set(row.orderId, {
        createdAt: row.createdAt,
        authorRoleNames: row.author.userRoles.map((ur) => ur.role.name),
      });
    }
  }

  const data = orders.map((order) => {
    const allowedActions = order.workflow.transitions
      .filter(
        (transition) =>
          transition.fromStatusId === order.statusId &&
          visibleOnBoard(transition.actionCode),
      )
      .filter((transition) => {
        if (supplierOnlyActionCodes.has(transition.actionCode)) {
          return isSupplierPortalUser;
        }
        if (buyerOnlyActionCodes.has(transition.actionCode)) {
          return !isSupplierPortalUser;
        }
        return true;
      })
      .map((transition) => ({
        actionCode: transition.actionCode,
        label: transition.label,
        requiresComment: transition.requiresComment,
        toStatus: transition.toStatus,
      }));

    const latestShared = latestSharedByOrder.get(order.id);
    const fromSupplier = Boolean(
      latestShared?.authorRoleNames.includes("Supplier portal"),
    );
    const awaitingReplyFrom: "buyer" | "supplier" | null = latestShared
      ? fromSupplier
        ? "buyer"
        : "supplier"
      : null;
    const daysSinceLastShared = latestShared
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - latestShared.createdAt.getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : null;
    const shippedTotal = order.shipments.reduce(
      (sum, shipment) =>
        sum +
        shipment.items.reduce((s, row) => s + Number(row.quantityShipped), 0),
      0,
    );
    const receivedTotal = order.shipments.reduce(
      (sum, shipment) =>
        sum +
        shipment.items.reduce((s, row) => s + Number(row.quantityReceived), 0),
      0,
    );
    const logisticsStatus: "NONE" | "SHIPPED" | "PARTIALLY_RECEIVED" | "RECEIVED" =
      shippedTotal <= 0
        ? "NONE"
        : receivedTotal <= 0
          ? "SHIPPED"
          : receivedTotal < shippedTotal
            ? "PARTIALLY_RECEIVED"
            : "RECEIVED";

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      title: order.title,
      buyerReference: order.buyerReference,
      requestedDeliveryDate: order.requestedDeliveryDate?.toISOString() ?? null,
      totalAmount: order.totalAmount.toString(),
      currency: order.currency,
      status: order.status,
      supplier: order.supplier,
      requester: order.requester,
      workflow: {
        id: order.workflow.id,
        name: order.workflow.name,
      },
      allowedActions,
      conversationSla: {
        awaitingReplyFrom,
        daysSinceLastShared,
        lastSharedAt: latestShared?.createdAt.toISOString() ?? null,
      },
      logisticsStatus,
      createdAt: order.createdAt,
    };
  });

  return NextResponse.json({
    viewerMode: isSupplierPortalUser ? "supplier" : "buyer",
    tenant,
    orders: data,
  });
}

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.orders", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Demo tenant not found." }, { status: 404 });
  }
  const requesterId = await getActorUserId();
  if (!requesterId) {
    return NextResponse.json({ error: "No active demo actor." }, { status: 403 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const input = (body && typeof body === "object" ? body : {}) as CreateOrderBody;

  if (!input.supplierId) {
    return NextResponse.json({ error: "supplierId is required." }, { status: 400 });
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return NextResponse.json({ error: "At least one order line is required." }, { status: 400 });
  }
  const validItems = input.items.filter(
    (row) =>
      row &&
      typeof row.productId === "string" &&
      Number.isFinite(row.quantity) &&
      row.quantity > 0 &&
      Number.isFinite(row.unitPrice) &&
      row.unitPrice >= 0,
  );
  if (validItems.length !== input.items.length) {
    return NextResponse.json({ error: "Invalid line values." }, { status: 400 });
  }

  const supplier = await prisma.supplier.findFirst({
    where: { id: input.supplierId, tenantId: tenant.id, isActive: true },
    select: {
      id: true,
      name: true,
      paymentTermsDays: true,
      paymentTermsLabel: true,
      defaultIncoterm: true,
    },
  });
  if (!supplier) {
    return NextResponse.json({ error: "Supplier not found." }, { status: 404 });
  }

  const products = await prisma.product.findMany({
    where: {
      id: { in: validItems.map((row) => row.productId) },
      tenantId: tenant.id,
      isActive: true,
      productSuppliers: { some: { supplierId: supplier.id } },
    },
    select: { id: true, name: true },
  });
  const allowedProductIds = new Set(products.map((p) => p.id));
  const blocked = validItems.find((row) => !allowedProductIds.has(row.productId));
  if (blocked) {
    return NextResponse.json(
      { error: "One or more products are not supplied by the selected supplier." },
      { status: 400 },
    );
  }

  const workflow = await prisma.workflow.findFirst({
    where: { tenantId: tenant.id, isDefault: true },
    select: { id: true, name: true },
  });
  if (!workflow) {
    return NextResponse.json(
      { error: "No default workflow found for tenant." },
      { status: 400 },
    );
  }
  const startStatus = await prisma.workflowStatus.findFirst({
    where: { workflowId: workflow.id, isStart: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  if (!startStatus) {
    return NextResponse.json({ error: "Default workflow has no start status." }, { status: 400 });
  }

  const subtotal = validItems.reduce((sum, row) => sum + row.quantity * row.unitPrice, 0);
  const requestedDeliveryDate =
    input.requestedDeliveryDate && input.requestedDeliveryDate.trim()
      ? new Date(`${input.requestedDeliveryDate}T00:00:00.000Z`)
      : null;
  if (requestedDeliveryDate && Number.isNaN(requestedDeliveryDate.getTime())) {
    return NextResponse.json({ error: "requestedDeliveryDate must be a valid date." }, { status: 400 });
  }
  const orderNumber = await nextOrderNumber(tenant.id);
  const currency = (input.currency || "USD").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    return NextResponse.json({ error: "Currency must be a 3-letter code." }, { status: 400 });
  }
  const taxPercent =
    typeof input.taxPercent === "number" && Number.isFinite(input.taxPercent)
      ? Math.max(0, input.taxPercent)
      : 8;
  const discountPercent =
    typeof input.discountPercent === "number" && Number.isFinite(input.discountPercent)
      ? Math.max(0, input.discountPercent)
      : 0;
  const discountAmount =
    typeof input.discountAmount === "number" && Number.isFinite(input.discountAmount)
      ? Math.max(0, input.discountAmount)
      : 0;
  const discountTotal = Math.min(subtotal, subtotal * (discountPercent / 100) + discountAmount);
  const taxable = Math.max(0, subtotal - discountTotal);
  const tax = taxable * (taxPercent / 100);
  const total = taxable + tax;
  const buyerOffice = input.buyerOffice?.trim() || null;
  const forwarder = input.forwarder?.trim() || null;
  const adminNote = input.adminNote?.trim() || null;
  const transportMode = input.transportMode?.trim() || null;
  const originCode = input.originCode?.trim() || null;
  const destinationCode = input.destinationCode?.trim() || null;
  const tags = Array.isArray(input.tags)
    ? input.tags
        .map((t) => (typeof t === "string" ? t.trim() : ""))
        .filter((t) => t.length > 0)
    : [];
  const buyerWarehouseId = input.buyerWarehouseId?.trim() || null;
  const cfsWarehouseId = input.cfsWarehouseId?.trim() || null;
  const forwarderSupplierId = input.forwarderSupplierId?.trim() || null;
  const forwarderOfficeId = input.forwarderOfficeId?.trim() || null;
  const forwarderContactId = input.forwarderContactId?.trim() || null;

  let buyerWarehouseName: string | null = null;
  let cfsWarehouseName: string | null = null;
  let forwarderSupplierName: string | null = null;
  let forwarderOfficeName: string | null = null;
  let forwarderContactName: string | null = null;

  if (buyerWarehouseId) {
    const w = await prisma.warehouse.findFirst({
      where: { id: buyerWarehouseId, tenantId: tenant.id, isActive: true },
      select: { name: true },
    });
    if (!w) return NextResponse.json({ error: "Invalid buyer office." }, { status: 400 });
    buyerWarehouseName = w.name;
  }
  if (cfsWarehouseId) {
    const w = await prisma.warehouse.findFirst({
      where: { id: cfsWarehouseId, tenantId: tenant.id, isActive: true },
      select: { name: true },
    });
    if (!w) return NextResponse.json({ error: "Invalid CFS." }, { status: 400 });
    cfsWarehouseName = w.name;
  }
  if (forwarderSupplierId) {
    const fwd = await prisma.supplier.findFirst({
      where: { id: forwarderSupplierId, tenantId: tenant.id, isActive: true },
      select: { id: true, name: true },
    });
    if (!fwd) return NextResponse.json({ error: "Invalid forwarder." }, { status: 400 });
    forwarderSupplierName = fwd.name;
    if (forwarderOfficeId) {
      const office = await prisma.supplierOffice.findFirst({
        where: {
          id: forwarderOfficeId,
          tenantId: tenant.id,
          supplierId: fwd.id,
          isActive: true,
        },
        select: { name: true },
      });
      if (!office) return NextResponse.json({ error: "Invalid forwarder office." }, { status: 400 });
      forwarderOfficeName = office.name;
    }
    if (forwarderContactId) {
      const contact = await prisma.supplierContact.findFirst({
        where: { id: forwarderContactId, tenantId: tenant.id, supplierId: fwd.id },
        select: { name: true },
      });
      if (!contact) {
        return NextResponse.json({ error: "Invalid forwarder contact." }, { status: 400 });
      }
      forwarderContactName = contact.name;
    }
  }

  const internalNotesParts = [
    buyerWarehouseName ? `Buyer office location: ${buyerWarehouseName}` : null,
    cfsWarehouseName ? `CFS: ${cfsWarehouseName}` : null,
    buyerOffice ? `Buyer office: ${buyerOffice}` : null,
    forwarderSupplierName ? `Forwarder company: ${forwarderSupplierName}` : null,
    forwarderOfficeName ? `Forwarder office: ${forwarderOfficeName}` : null,
    forwarderContactName ? `Forwarder contact: ${forwarderContactName}` : null,
    forwarder ? `Forwarder: ${forwarder}` : null,
    transportMode ? `Transport mode: ${transportMode}` : null,
    originCode ? `Origin code: ${originCode}` : null,
    destinationCode ? `Destination code: ${destinationCode}` : null,
    tags.length ? `Tags: ${tags.join(", ")}` : null,
    `Tax %: ${taxPercent.toFixed(2)}`,
    `Discount %: ${discountPercent.toFixed(2)}`,
    `Discount amount: ${discountAmount.toFixed(2)}`,
    adminNote ? `Admin note: ${adminNote}` : null,
  ].filter((v): v is string => Boolean(v));

  const created = await prisma.purchaseOrder.create({
    data: {
      tenantId: tenant.id,
      workflowId: workflow.id,
      orderNumber,
      title: `Purchase order for ${supplier.name}`,
      requesterId,
      supplierId: supplier.id,
      statusId: startStatus.id,
      currency,
      subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
      taxAmount: new Prisma.Decimal(tax.toFixed(2)),
      totalAmount: new Prisma.Decimal(total.toFixed(2)),
      buyerReference: buyerOffice,
      paymentTermsDays:
        typeof input.paymentTermsDays === "number" && Number.isFinite(input.paymentTermsDays)
          ? Math.max(0, Math.trunc(input.paymentTermsDays))
          : supplier.paymentTermsDays,
      paymentTermsLabel: input.paymentTermsLabel?.trim() || supplier.paymentTermsLabel,
      incoterm: input.incoterm?.trim() || supplier.defaultIncoterm,
      requestedDeliveryDate,
      shipToName: input.deliveryAddress?.name?.trim() || null,
      shipToLine1: input.deliveryAddress?.line1?.trim() || null,
      shipToLine2: input.deliveryAddress?.line2?.trim() || null,
      shipToCity: input.deliveryAddress?.city?.trim() || null,
      shipToRegion: input.deliveryAddress?.region?.trim() || null,
      shipToPostalCode: input.deliveryAddress?.postalCode?.trim() || null,
      shipToCountryCode: input.deliveryAddress?.countryCode?.trim()?.toUpperCase() || null,
      internalNotes: internalNotesParts.length ? internalNotesParts.join("\n") : null,
      notesToSupplier: input.notesToSupplier?.trim() || null,
      items: {
        create: validItems.map((row, idx) => {
          const lineTotal = row.quantity * row.unitPrice;
          const product = products.find((p) => p.id === row.productId);
          return {
            lineNo: idx + 1,
            productId: row.productId,
            description: product?.name || "Catalog line",
            quantity: new Prisma.Decimal(row.quantity.toFixed(3)),
            unitPrice: new Prisma.Decimal(row.unitPrice.toFixed(4)),
            lineTotal: new Prisma.Decimal(lineTotal.toFixed(2)),
          };
        }),
      },
    },
    select: { id: true, orderNumber: true },
  });

  return NextResponse.json({ ok: true, id: created.id, orderNumber: created.orderNumber });
}
