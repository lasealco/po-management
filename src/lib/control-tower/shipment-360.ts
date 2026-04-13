import { prisma } from "@/lib/prisma";

import { controlTowerOrderWhere } from "./viewer";

export async function getShipment360(params: {
  tenantId: string;
  shipmentId: string;
  isCustomer: boolean;
}) {
  const { tenantId, shipmentId, isCustomer } = params;
  const orderWhere = controlTowerOrderWhere(isCustomer);

  const s = await prisma.shipment.findFirst({
    where: { id: shipmentId, order: { tenantId, ...orderWhere } },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          incoterm: true,
          buyerReference: true,
          supplierReference: true,
          shipToName: true,
          shipToCity: true,
          shipToCountryCode: true,
          supplier: { select: { id: true, name: true, legalName: true } },
        },
      },
      createdBy: { select: { id: true, name: true } },
      booking: true,
      items: {
        include: {
          orderItem: {
            select: {
              lineNo: true,
              description: true,
              quantity: true,
              product: { select: { sku: true, productCode: true, name: true } },
            },
          },
        },
      },
      milestones: {
        orderBy: { createdAt: "desc" },
        include: { updatedBy: { select: { name: true } } },
      },
      ctReferences: { orderBy: { createdAt: "asc" } },
      ctTrackingMilestones: {
        orderBy: { updatedAt: "desc" },
        include: { updatedBy: { select: { name: true } } },
      },
      ctDocuments: {
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: { select: { name: true } } },
      },
      ctNotes: {
        orderBy: { createdAt: "desc" },
        include: { createdBy: { select: { name: true } } },
      },
      ctFinancialSnapshots: {
        orderBy: { asOf: "desc" },
        take: 5,
        include: { createdBy: { select: { name: true } } },
      },
      ctAlerts: {
        orderBy: { createdAt: "desc" },
        take: 40,
        include: {
          owner: { select: { id: true, name: true } },
        },
      },
      ctExceptions: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { owner: { select: { id: true, name: true } } },
      },
      ctAuditLogs: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { actor: { select: { name: true } } },
      },
    },
  });

  if (!s) return null;

  const docFilter = isCustomer
    ? s.ctDocuments.filter((d) => d.visibility === "CUSTOMER_SHAREABLE")
    : s.ctDocuments;

  const noteFilter = isCustomer
    ? s.ctNotes.filter((n) => n.visibility === "SHARED")
    : s.ctNotes;

  const fin = s.ctFinancialSnapshots[0];
  const financial = fin
    ? isCustomer
      ? fin.customerVisibleCost != null
        ? {
            asOf: fin.asOf.toISOString(),
            customerVisibleCost: fin.customerVisibleCost?.toString() ?? null,
            currency: fin.currency,
          }
        : null
      : {
          asOf: fin.asOf.toISOString(),
          currency: fin.currency,
          customerVisibleCost: fin.customerVisibleCost?.toString() ?? null,
          internalCost: fin.internalCost?.toString() ?? null,
          internalRevenue: fin.internalRevenue?.toString() ?? null,
          internalNet: fin.internalNet?.toString() ?? null,
          internalMarginPct: fin.internalMarginPct?.toString() ?? null,
          createdByName: fin.createdBy.name,
        }
    : null;

  const exceptions = s.ctExceptions.map((e) =>
    isCustomer
      ? {
          id: e.id,
          type: e.type,
          status: e.status,
          severity: e.severity,
          createdAt: e.createdAt.toISOString(),
        }
      : {
          id: e.id,
          type: e.type,
          status: e.status,
          severity: e.severity,
          owner: e.owner ? { id: e.owner.id, name: e.owner.name } : null,
          rootCause: e.rootCause,
          claimAmount: e.claimAmount?.toString() ?? null,
          resolvedAt: e.resolvedAt?.toISOString() ?? null,
          createdAt: e.createdAt.toISOString(),
          updatedAt: e.updatedAt.toISOString(),
        },
  );

  const alerts = isCustomer
    ? s.ctAlerts
        .filter((a) => a.status !== "CLOSED")
        .map((a) => ({
          id: a.id,
          type: a.type,
          severity: a.severity,
          title: a.title,
          status: a.status,
          createdAt: a.createdAt.toISOString(),
        }))
    : s.ctAlerts.map((a) => ({
        id: a.id,
        type: a.type,
        severity: a.severity,
        title: a.title,
        body: a.body,
        status: a.status,
        owner: a.owner ? { id: a.owner.id, name: a.owner.name } : null,
        acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      }));

  return {
    id: s.id,
    shipmentNo: s.shipmentNo,
    status: s.status,
    transportMode: s.transportMode,
    carrier: s.carrier,
    trackingNo: s.trackingNo,
    asnReference: s.asnReference,
    expectedReceiveAt: s.expectedReceiveAt?.toISOString() ?? null,
    shippedAt: s.shippedAt.toISOString(),
    receivedAt: s.receivedAt?.toISOString() ?? null,
    estimatedVolumeCbm: s.estimatedVolumeCbm?.toString() ?? null,
    estimatedWeightKg: s.estimatedWeightKg?.toString() ?? null,
    shipmentNotes: s.notes,
    createdBy: { name: s.createdBy.name },
    order: s.order,
    booking: s.booking
      ? {
          status: s.booking.status,
          bookingNo: s.booking.bookingNo,
          serviceLevel: s.booking.serviceLevel,
          mode: s.booking.mode,
          originCode: s.booking.originCode,
          destinationCode: s.booking.destinationCode,
          etd: s.booking.etd?.toISOString() ?? null,
          eta: s.booking.eta?.toISOString() ?? null,
          latestEta: s.booking.latestEta?.toISOString() ?? null,
          notes: s.booking.notes,
        }
      : null,
    lines: s.items.map((it) => ({
      id: it.id,
      quantityShipped: it.quantityShipped.toString(),
      quantityReceived: it.quantityReceived.toString(),
      lineNo: it.orderItem.lineNo,
      description: it.orderItem.description,
      product: it.orderItem.product,
    })),
    milestones: s.milestones.map((m) => ({
      id: m.id,
      code: m.code,
      source: m.source,
      plannedAt: m.plannedAt?.toISOString() ?? null,
      actualAt: m.actualAt?.toISOString() ?? null,
      note: m.note,
      updatedByName: m.updatedBy.name,
      createdAt: m.createdAt.toISOString(),
    })),
    ctReferences: s.ctReferences.map((r) => ({
      id: r.id,
      refType: r.refType,
      refValue: r.refValue,
      createdAt: r.createdAt.toISOString(),
    })),
    ctTrackingMilestones: s.ctTrackingMilestones.map((m) => ({
      id: m.id,
      code: m.code,
      label: m.label,
      plannedAt: m.plannedAt?.toISOString() ?? null,
      predictedAt: m.predictedAt?.toISOString() ?? null,
      actualAt: m.actualAt?.toISOString() ?? null,
      sourceType: m.sourceType,
      sourceRef: m.sourceRef,
      confidence: m.confidence,
      notes: m.notes,
      updatedByName: m.updatedBy.name,
      updatedAt: m.updatedAt.toISOString(),
    })),
    documents: docFilter.map((d) => ({
      id: d.id,
      docType: d.docType,
      fileName: d.fileName,
      blobUrl: d.blobUrl,
      visibility: d.visibility,
      version: d.version,
      uploadedByName: d.uploadedBy.name,
      createdAt: d.createdAt.toISOString(),
    })),
    collaborationNotes: noteFilter.map((n) => ({
      id: n.id,
      body: n.body,
      visibility: n.visibility,
      createdByName: n.createdBy.name,
      createdAt: n.createdAt.toISOString(),
    })),
    financial,
    alerts,
    exceptions,
    auditTrail: isCustomer
      ? []
      : s.ctAuditLogs.map((a) => ({
          id: a.id,
          entityType: a.entityType,
          entityId: a.entityId,
          action: a.action,
          payload: a.payload,
          actorName: a.actor.name,
          createdAt: a.createdAt.toISOString(),
        })),
  };
}
