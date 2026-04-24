import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  actorIsSupplierPortalRestricted,
  getActorUserId,
  getViewerGrantSet,
  requireApiGrant,
  userHasGlobalGrant,
  userHasRoleNamed,
  viewerHas,
} from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { getPurchaseOrderScopeWhere } from "@/lib/org-scope";
import { optionalStringField } from "@/lib/supplier-patch";
import { assertSendToSupplierServedOrgPolicy } from "@/lib/po-served-org-workflow-policy";
import { resolveServedOrgUnitIdForTenant } from "@/lib/served-org-unit";
import { prisma } from "@/lib/prisma";
import { addTariffShipmentApplicationSourceLabel } from "@/lib/tariff/tariff-shipment-application-labels";

function parseRequestedDeliveryDate(
  v: unknown,
): Date | null | undefined | "invalid" {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") return "invalid";
  const t = v.trim();
  if (!t) return null;
  const d = new Date(`${t}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return "invalid";
  return d;
}

function preferText(
  childValue: string | null | undefined,
  parentValue: string | null | undefined,
) {
  if (typeof childValue === "string" && childValue.trim()) return childValue;
  if (typeof parentValue === "string" && parentValue.trim()) return parentValue;
  return null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.orders", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Demo tenant not found. Run `npm run db:seed` to create starter data.", code: "NOT_FOUND", status: 404 });
  }

  const { id } = await context.params;

  const actorId = await getActorUserId();
  const isSupplierPortalUser =
    actorId !== null && (await actorIsSupplierPortalRestricted(actorId));
  const poScope = await getPurchaseOrderScopeWhere(tenant.id, actorId, {
    isSupplierPortalUser,
  });

  const order = await prisma.purchaseOrder.findFirst({
    where: { id, tenantId: tenant.id, ...(poScope ?? {}) },
    include: {
      servedOrgUnit: { select: { id: true, name: true, code: true, kind: true } },
      customerCrmAccount: { select: { id: true, name: true, legalName: true } },
      status: true,
      supplier: {
        select: {
          id: true,
          name: true,
          paymentTermsDays: true,
          paymentTermsLabel: true,
          defaultIncoterm: true,
        },
      },
      splitParent: {
        select: {
          id: true,
          orderNumber: true,
          buyerReference: true,
          supplierReference: true,
          paymentTermsDays: true,
          paymentTermsLabel: true,
          incoterm: true,
          requestedDeliveryDate: true,
          shipToName: true,
          shipToLine1: true,
          shipToLine2: true,
          shipToCity: true,
          shipToRegion: true,
          shipToPostalCode: true,
          shipToCountryCode: true,
          internalNotes: true,
          notesToSupplier: true,
          customerCrmAccountId: true,
          customerCrmAccount: {
            select: { id: true, name: true, legalName: true },
          },
        },
      },
      requester: true,
      workflow: {
        include: {
          transitions: {
            include: {
              toStatus: true,
            },
          },
        },
      },
      items: {
        orderBy: { lineNo: "asc" },
        include: {
          product: {
            select: { sku: true, productCode: true, name: true },
          },
        },
      },
      splitChildren: {
        orderBy: { splitIndex: "asc" },
        include: { status: true },
      },
      shipments: {
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { name: true, email: true } },
          booking: {
            include: {
              forwarderSupplier: { select: { id: true, name: true, code: true } },
              forwarderOffice: { select: { id: true, name: true } },
              forwarderContact: {
                select: { id: true, name: true, email: true, phone: true },
              },
            },
          },
          milestones: {
            orderBy: { createdAt: "desc" },
            take: 20,
            include: { updatedBy: { select: { name: true, email: true } } },
          },
          items: {
            include: { orderItem: { select: { id: true, lineNo: true, description: true } } },
            orderBy: { orderItem: { lineNo: "asc" } },
          },
        },
      },
      splitProposalsAsParent: {
        where: { status: "PENDING" },
        include: {
          lines: {
            include: { sourceLine: true },
            orderBy: [{ childIndex: "asc" }, { id: "asc" }],
          },
        },
        take: 1,
      },
      transitions: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          actor: { select: { name: true, email: true } },
        },
      },
    },
  });

  if (!order) {
    return toApiErrorResponse({ error: "Order not found", code: "NOT_FOUND", status: 404 });
  }

  const statusIds = new Set<string>();
  for (const log of order.transitions) {
    if (log.fromStatusId) statusIds.add(log.fromStatusId);
    statusIds.add(log.toStatusId);
  }
  const statusRows =
    statusIds.size > 0
      ? await prisma.workflowStatus.findMany({
          where: { id: { in: [...statusIds] } },
          select: { id: true, code: true, label: true },
        })
      : [];
  const statusById = new Map(statusRows.map((s) => [s.id, s]));

  const isForwarderUser =
    actorId !== null && (await userHasRoleNamed(actorId, "Forwarder"));
  if (isSupplierPortalUser && !order.workflow.supplierPortalOn) {
    return toApiErrorResponse({ error: "Order not found", code: "NOT_FOUND", status: 404 });
  }

  const supplierOnlyActions = new Set([
    "confirm",
    "decline",
    "propose_split",
    "mark_fulfilled",
  ]);
  const buyerOnlyActions = new Set([
    "send_to_supplier",
    "buyer_accept_split",
    "buyer_reject_proposal",
    "buyer_cancel",
  ]);
  let transitionRows = order.workflow.transitions
    .filter((t) => t.fromStatusId === order.statusId)
    .filter((t) => {
      if (supplierOnlyActions.has(t.actionCode)) return isSupplierPortalUser;
      if (buyerOnlyActions.has(t.actionCode)) return !isSupplierPortalUser;
      return true;
    });
  if (actorId && !isSupplierPortalUser && order.servedOrgUnitId) {
    const sendPolicy = await assertSendToSupplierServedOrgPolicy(
      tenant.id,
      actorId,
      order.servedOrgUnitId,
    );
    if (!sendPolicy.ok) {
      transitionRows = transitionRows.filter((t) => t.actionCode !== "send_to_supplier");
    }
  }
  const allowedActions = transitionRows.map((t) => ({
    actionCode: t.actionCode,
    label: t.label,
    requiresComment: t.requiresComment,
    toStatus: t.toStatus,
  }));

  const pendingProposal = order.splitProposalsAsParent[0] ?? null;

  const canSeeInternalMessages =
    actorId !== null &&
    (await userHasGlobalGrant(actorId, "org.orders", "edit"));
  const canSeeInternalFields = canSeeInternalMessages;
  const canReceiveShipments = canSeeInternalMessages && !isSupplierPortalUser;
  const canManageBooking = canSeeInternalMessages && !isSupplierPortalUser;
  const canUpdateMilestones = canManageBooking || isForwarderUser;
  const canCreateShipments =
    isSupplierPortalUser &&
    order.workflow.supplierPortalOn &&
    (order.status.code === "SENT" || order.status.code === "CONFIRMED");
  const effective = {
    buyerReference: preferText(
      order.buyerReference,
      order.splitParent?.buyerReference,
    ),
    supplierReference: preferText(
      order.supplierReference,
      order.splitParent?.supplierReference,
    ),
    paymentTermsDays:
      order.paymentTermsDays ?? order.splitParent?.paymentTermsDays ?? null,
    paymentTermsLabel: preferText(
      order.paymentTermsLabel,
      order.splitParent?.paymentTermsLabel,
    ),
    incoterm: preferText(order.incoterm, order.splitParent?.incoterm),
    requestedDeliveryDate:
      order.requestedDeliveryDate ?? order.splitParent?.requestedDeliveryDate ?? null,
    shipToName: preferText(order.shipToName, order.splitParent?.shipToName),
    shipToLine1: preferText(order.shipToLine1, order.splitParent?.shipToLine1),
    shipToLine2: preferText(order.shipToLine2, order.splitParent?.shipToLine2),
    shipToCity: preferText(order.shipToCity, order.splitParent?.shipToCity),
    shipToRegion: preferText(order.shipToRegion, order.splitParent?.shipToRegion),
    shipToPostalCode: preferText(
      order.shipToPostalCode,
      order.splitParent?.shipToPostalCode,
    ),
    shipToCountryCode: preferText(
      order.shipToCountryCode,
      order.splitParent?.shipToCountryCode,
    ),
    internalNotes: preferText(order.internalNotes, order.splitParent?.internalNotes),
    notesToSupplier: preferText(
      order.notesToSupplier,
      order.splitParent?.notesToSupplier,
    ),
    customerCrmAccount: order.customerCrmAccountId
      ? order.customerCrmAccount
      : (order.splitParent?.customerCrmAccount ?? null),
  };

  let childPlannedShipDates: string[] = [];
  if (order.splitIndex != null) {
    const splitLines = await prisma.splitProposalLine.findMany({
      where: {
        childIndex: order.splitIndex,
        proposal: {
          parentOrderId: order.splitParentId ?? order.id,
          ...(order.splitProposalId ? { id: order.splitProposalId } : {}),
        },
      },
      orderBy: { plannedShipDate: "asc" },
      select: { plannedShipDate: true, proposalId: true },
      take: 200,
    });
    const firstProposal = splitLines[0]?.proposalId;
    const sameProposal = firstProposal
      ? splitLines.filter((line) => line.proposalId === firstProposal)
      : splitLines;
    const unique = new Set(
      sameProposal.map((line) => line.plannedShipDate.toISOString().slice(0, 10)),
    );
    childPlannedShipDates = [...unique];
  }

  const messages = await prisma.orderChatMessage.findMany({
    where: {
      orderId: id,
      ...(canSeeInternalMessages ? {} : { isInternal: false }),
    },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: {
      author: { select: { name: true, email: true } },
    },
  });
  const forwarders = await prisma.supplier.findMany({
    where: {
      tenantId: tenant.id,
      isActive: true,
      productSuppliers: { none: {} },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      offices: {
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      },
      contacts: {
        orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
        select: { id: true, name: true, email: true, phone: true },
      },
    },
  });

  const access = await getViewerGrantSet();
  const canViewTariffGlue = Boolean(access?.user && viewerHas(access.grantSet, "org.tariffs", "view"));
  const canEditTariffGlue = Boolean(access?.user && viewerHas(access.grantSet, "org.tariffs", "edit"));

  const shipmentIds = order.shipments.map((s) => s.id);
  const tariffAppsByShipment = new Map<
    string,
    {
      id: string;
      isPrimary: boolean;
      source: string;
      sourceLabel: string;
      polCode: string | null;
      podCode: string | null;
      equipmentType: string | null;
      contractVersionId: string;
      versionNo: number;
      contractHeaderId: string;
      contractNumber: string | null;
      contractTitle: string;
      providerLegalName: string;
      providerTradingName: string | null;
    }[]
  >();

  if (canViewTariffGlue && shipmentIds.length > 0) {
    const apps = await prisma.tariffShipmentApplication.findMany({
      where: { tenantId: tenant.id, shipmentId: { in: shipmentIds } },
      orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
      include: {
        contractVersion: {
          select: {
            id: true,
            versionNo: true,
            contractHeader: {
              select: {
                id: true,
                contractNumber: true,
                title: true,
                provider: { select: { legalName: true, tradingName: true } },
              },
            },
          },
        },
      },
    });
    for (const a of apps) {
      const h = a.contractVersion.contractHeader;
      const list = tariffAppsByShipment.get(a.shipmentId) ?? [];
      list.push(
        addTariffShipmentApplicationSourceLabel({
          id: a.id,
          isPrimary: a.isPrimary,
          source: a.source,
          polCode: a.polCode,
          podCode: a.podCode,
          equipmentType: a.equipmentType,
          contractVersionId: a.contractVersionId,
          versionNo: a.contractVersion.versionNo,
          contractHeaderId: h.id,
          contractNumber: h.contractNumber,
          contractTitle: h.title,
          providerLegalName: h.provider.legalName,
          providerTradingName: h.provider.tradingName,
        }),
      );
      tariffAppsByShipment.set(a.shipmentId, list);
    }
  }

  return NextResponse.json({
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      title: order.title,
      currency: order.currency,
      subtotal: order.subtotal.toString(),
      taxAmount: order.taxAmount.toString(),
      totalAmount: order.totalAmount.toString(),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      buyerReference: effective.buyerReference,
      supplierReference: effective.supplierReference,
      paymentTermsDays: effective.paymentTermsDays,
      paymentTermsLabel: effective.paymentTermsLabel,
      incoterm: effective.incoterm,
      requestedDeliveryDate: effective.requestedDeliveryDate?.toISOString() ?? null,
      shipToName: effective.shipToName,
      shipToLine1: effective.shipToLine1,
      shipToLine2: effective.shipToLine2,
      shipToCity: effective.shipToCity,
      shipToRegion: effective.shipToRegion,
      shipToPostalCode: effective.shipToPostalCode,
      shipToCountryCode: effective.shipToCountryCode,
      internalNotes: canSeeInternalFields ? effective.internalNotes : null,
      notesToSupplier: effective.notesToSupplier,
      customerCrmAccount: effective.customerCrmAccount
        ? {
            id: effective.customerCrmAccount.id,
            name: effective.customerCrmAccount.name,
            legalName: effective.customerCrmAccount.legalName,
          }
        : null,
      status: order.status,
      workflow: {
        id: order.workflow.id,
        name: order.workflow.name,
        allowSplitOrders: order.workflow.allowSplitOrders,
        supplierPortalOn: order.workflow.supplierPortalOn,
      },
      supplier: order.supplier,
      requester: order.requester,
      servedOrgUnit: order.servedOrgUnit
        ? {
            id: order.servedOrgUnit.id,
            name: order.servedOrgUnit.name,
            code: order.servedOrgUnit.code,
            kind: order.servedOrgUnit.kind,
          }
        : null,
      splitParentId: order.splitParentId,
      splitParent: order.splitParent
        ? {
            id: order.splitParent.id,
            orderNumber: order.splitParent.orderNumber,
          }
        : null,
      splitIndex: order.splitIndex,
      plannedShipDates: childPlannedShipDates,
    },
    items: order.items.map((item) => ({
      id: item.id,
      lineNo: item.lineNo,
      description: item.description,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      lineTotal: item.lineTotal.toString(),
      productId: item.productId,
      product: item.product
        ? {
            sku: item.product.sku,
            productCode: item.product.productCode,
            name: item.product.name,
          }
        : null,
    })),
    splitChildren: order.splitChildren.map((child) => ({
      id: child.id,
      orderNumber: child.orderNumber,
      splitIndex: child.splitIndex,
      status: child.status,
      totalAmount: child.totalAmount.toString(),
    })),
    shipments: order.shipments.map((shipment) => ({
      id: shipment.id,
      shipmentNo: shipment.shipmentNo,
      status: shipment.status,
      shippedAt: shipment.shippedAt.toISOString(),
      receivedAt: shipment.receivedAt?.toISOString() ?? null,
      carrier: shipment.carrier,
      trackingNo: shipment.trackingNo,
      transportMode: shipment.transportMode,
      estimatedVolumeCbm: shipment.estimatedVolumeCbm?.toString() ?? null,
      estimatedWeightKg: shipment.estimatedWeightKg?.toString() ?? null,
      notes: shipment.notes,
      createdBy: shipment.createdBy,
      ...(canViewTariffGlue
        ? { tariffApplications: tariffAppsByShipment.get(shipment.id) ?? [] }
        : {}),
      booking: shipment.booking
        ? {
            status: shipment.booking.status,
            bookingNo: shipment.booking.bookingNo,
            serviceLevel: shipment.booking.serviceLevel,
            mode: shipment.booking.mode,
            originCode: shipment.booking.originCode,
            destinationCode: shipment.booking.destinationCode,
            etd: shipment.booking.etd?.toISOString() ?? null,
            eta: shipment.booking.eta?.toISOString() ?? null,
            latestEta: shipment.booking.latestEta?.toISOString() ?? null,
            notes: shipment.booking.notes,
            forwarderSupplier: shipment.booking.forwarderSupplier,
            forwarderOffice: shipment.booking.forwarderOffice,
            forwarderContact: shipment.booking.forwarderContact,
          }
        : null,
      milestones: shipment.milestones.map((m) => ({
        id: m.id,
        code: m.code,
        source: m.source,
        plannedAt: m.plannedAt?.toISOString() ?? null,
        actualAt: m.actualAt?.toISOString() ?? null,
        note: m.note,
        createdAt: m.createdAt.toISOString(),
        updatedBy: m.updatedBy,
      })),
      items: shipment.items.map((item) => ({
        id: item.id,
        orderItemId: item.orderItemId,
        lineNo: item.orderItem.lineNo,
        description: item.orderItem.description,
        quantityShipped: item.quantityShipped.toString(),
        quantityReceived: item.quantityReceived.toString(),
        plannedShipDate: item.plannedShipDate?.toISOString() ?? null,
      })),
    })),
    pendingProposal: pendingProposal
      ? {
          id: pendingProposal.id,
          status: pendingProposal.status,
          comment: pendingProposal.comment,
          lines: pendingProposal.lines.map((line) => ({
            id: line.id,
            childIndex: line.childIndex,
            quantity: line.quantity.toString(),
            plannedShipDate: line.plannedShipDate.toISOString(),
            sourceLineId: line.sourceLineId,
            sourceDescription: line.sourceLine.description,
          })),
        }
      : null,
    allowedActions,
    activity: order.transitions.map((log) => ({
      id: log.id,
      createdAt: log.createdAt.toISOString(),
      actionCode: log.actionCode,
      comment: log.comment,
      actor: log.actor,
      fromStatus: log.fromStatusId
        ? (statusById.get(log.fromStatusId) ?? null)
        : null,
      toStatus: statusById.get(log.toStatusId) ?? {
        id: log.toStatusId,
        code: "?",
        label: "Unknown",
      },
    })),
    messages: messages.map((m) => ({
      id: m.id,
      createdAt: m.createdAt.toISOString(),
      body: m.body,
      isInternal: m.isInternal,
      author: m.author,
    })),
    messageCapabilities: {
      canPost: actorId !== null,
      canPostInternal: canSeeInternalMessages,
    },
    splitCapabilities: {
      canPropose: isSupplierPortalUser,
    },
    shipmentCapabilities: {
      canCreate: canCreateShipments,
      canReceive: canReceiveShipments,
      canValidate: canManageBooking,
      canBook: canManageBooking,
      canUpdateMilestones,
    },
    tariffShipmentCapabilities: {
      canView: canViewTariffGlue,
      canEdit: canEditTariffGlue,
    },
    forwarders,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.orders", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Demo tenant not found. Run `npm run db:seed` to create starter data.", code: "NOT_FOUND", status: 404 });
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return toApiErrorResponse({ error: "Expected object.", code: "BAD_INPUT", status: 400 });
  }

  const patchActorId = await getActorUserId();
  const patchIsSupplier =
    patchActorId !== null && (await actorIsSupplierPortalRestricted(patchActorId));
  const patchScope = await getPurchaseOrderScopeWhere(tenant.id, patchActorId, {
    isSupplierPortalUser: patchIsSupplier,
  });
  const existing = await prisma.purchaseOrder.findFirst({
    where: { id, tenantId: tenant.id, ...(patchScope ?? {}) },
    select: { id: true },
  });
  if (!existing) {
    return toApiErrorResponse({ error: "Order not found", code: "NOT_FOUND", status: 404 });
  }

  const o = body as Record<string, unknown>;
  const data: Prisma.PurchaseOrderUpdateInput = {};

  const stringKeys = [
    "buyerReference",
    "supplierReference",
    "paymentTermsLabel",
    "incoterm",
  ] as const;
  for (const key of stringKeys) {
    const v = optionalStringField(o, key);
    if (v !== undefined) data[key] = v;
  }

  if ("internalNotes" in o) {
    const v = optionalStringField(o, "internalNotes");
    if (v !== undefined) data.internalNotes = v;
  }
  if ("notesToSupplier" in o) {
    const v = optionalStringField(o, "notesToSupplier");
    if (v !== undefined) data.notesToSupplier = v;
  }

  if ("customerCrmAccountId" in o) {
    if (patchIsSupplier) {
      return toApiErrorResponse({
        error: "customerCrmAccountId cannot be set from the supplier portal.",
        code: "FORBIDDEN",
        status: 403,
      });
    }
    const v = o.customerCrmAccountId;
    if (v === null) {
      data.customerCrmAccount = { disconnect: true };
    } else if (typeof v === "string") {
      const id = v.trim();
      if (!id) {
        return toApiErrorResponse({
          error: "customerCrmAccountId must be a non-empty id or null.",
          code: "BAD_INPUT",
          status: 400,
        });
      }
      const acc = await prisma.crmAccount.findFirst({
        where: { id, tenantId: tenant.id },
        select: { id: true },
      });
      if (!acc) {
        return toApiErrorResponse({
          error: "Unknown CRM account for this tenant.",
          code: "BAD_INPUT",
          status: 400,
        });
      }
      data.customerCrmAccount = { connect: { id } };
    } else {
      return toApiErrorResponse({ error: "Invalid customerCrmAccountId.", code: "BAD_INPUT", status: 400 });
    }
  }

  if ("paymentTermsDays" in o) {
    const v = o.paymentTermsDays;
    if (v === null) {
      data.paymentTermsDays = null;
    } else if (
      typeof v === "number" &&
      Number.isInteger(v) &&
      v >= 0 &&
      v <= 3650
    ) {
      data.paymentTermsDays = v;
    } else {
      return toApiErrorResponse({ error: "Invalid paymentTermsDays.", code: "BAD_INPUT", status: 400 });
    }
  }

  if ("requestedDeliveryDate" in o) {
    const parsed = parseRequestedDeliveryDate(o.requestedDeliveryDate);
    if (parsed === "invalid") {
      return toApiErrorResponse({ error: "Invalid requestedDeliveryDate (use YYYY-MM-DD).", code: "BAD_INPUT", status: 400 });
    }
    if (parsed !== undefined) {
      data.requestedDeliveryDate = parsed;
    }
  }

  if (Object.prototype.hasOwnProperty.call(o, "servedOrgUnitId")) {
    if (patchIsSupplier) {
      return toApiErrorResponse({
        error: "servedOrgUnitId cannot be set from the supplier portal.",
        code: "FORBIDDEN",
        status: 403,
      });
    }
    const raw = o.servedOrgUnitId;
    if (raw === null || raw === "") {
      data.servedOrgUnit = { disconnect: true };
    } else if (typeof raw === "string") {
      const resolved = await resolveServedOrgUnitIdForTenant(tenant.id, raw);
      if (!resolved.ok) {
        return toApiErrorResponse({ error: resolved.error, code: "BAD_INPUT", status: 400 });
      }
      if (resolved.value) {
        data.servedOrgUnit = { connect: { id: resolved.value } };
      } else {
        data.servedOrgUnit = { disconnect: true };
      }
    } else {
      return toApiErrorResponse({ error: "Invalid servedOrgUnitId.", code: "BAD_INPUT", status: 400 });
    }
  }

  if (Object.keys(data).length === 0) {
    return toApiErrorResponse({ error: "No valid fields to update.", code: "BAD_INPUT", status: 400 });
  }

  await prisma.purchaseOrder.update({
    where: { id },
    data,
  });

  return GET(request, context);
}
