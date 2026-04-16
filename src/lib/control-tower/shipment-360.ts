import { prisma } from "@/lib/prisma";
import { convertAmount, minorToAmount, normalizeCurrency } from "@/lib/control-tower/currency";

import {
  controlTowerShipmentScopeWhere,
  type ControlTowerPortalContext,
} from "./viewer";
import { computeCtMilestoneSummary } from "./milestone-summary";
import { listMilestonePackSummaries } from "./milestone-templates";

export async function getShipment360(params: {
  tenantId: string;
  shipmentId: string;
  ctx: ControlTowerPortalContext;
  actorUserId: string;
}) {
  const { tenantId, shipmentId, ctx, actorUserId } = params;
  const scope = controlTowerShipmentScopeWhere(tenantId, ctx);
  const restricted = ctx.isRestrictedView;

  const s = await prisma.shipment.findFirst({
    where: { id: shipmentId, ...scope },
    include: {
      customerCrmAccount: {
        select: { id: true, name: true, legalName: true },
      },
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
      ctCostLines: {
        orderBy: { createdAt: "desc" },
        include: { createdBy: { select: { name: true } } },
      },
      ctAlerts: {
        orderBy: { createdAt: "desc" },
        take: 40,
        include: {
          owner: { select: { id: true, name: true } },
          acknowledgedBy: { select: { id: true, name: true } },
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
      ctLegs: { orderBy: { legNo: "asc" } },
      ctContainers: {
        orderBy: { createdAt: "asc" },
        include: { leg: { select: { id: true, legNo: true } } },
      },
    },
  });

  if (!s) return null;

  const crmAccountChoices = restricted
    ? []
    : await prisma.crmAccount.findMany({
        where: { tenantId, lifecycle: "ACTIVE" },
        take: 100,
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });
  const pref = await prisma.userPreference.findUnique({
    where: { userId_key: { userId: actorUserId, key: "controlTower.displayCurrency" } },
    select: { value: true },
  });
  const prefCurrencyRaw =
    pref && pref.value && typeof pref.value === "object" && "currency" in pref.value
      ? (pref.value as { currency?: unknown }).currency
      : null;
  const displayCurrency = normalizeCurrency(typeof prefCurrencyRaw === "string" ? prefCurrencyRaw : "USD");
  const costCurrencies = Array.from(new Set(s.ctCostLines.map((c) => normalizeCurrency(c.currency))));
  const fxRates = await prisma.ctFxRate.findMany({
    where: {
      tenantId,
      OR: [
        { baseCurrency: { in: costCurrencies }, quoteCurrency: displayCurrency },
        { baseCurrency: displayCurrency, quoteCurrency: { in: costCurrencies } },
      ],
    },
    orderBy: { rateDate: "desc" },
  });
  const seenPair = new Set<string>();
  const latestRates = fxRates.filter((r) => {
    const k = `${r.baseCurrency}->${r.quoteCurrency}`;
    if (seenPair.has(k)) return false;
    seenPair.add(k);
    return true;
  });
  const fxDates = new Set<string>();
  const costLines = s.ctCostLines.map((line) => {
    const amount = minorToAmount(line.amountMinor);
    const converted = convertAmount({
      amount,
      sourceCurrency: normalizeCurrency(line.currency),
      targetCurrency: displayCurrency,
      rates: latestRates,
    });
    if (converted.fxDate) fxDates.add(converted.fxDate);
    return {
      id: line.id,
      category: line.category,
      description: line.description,
      vendor: line.vendor,
      invoiceNo: line.invoiceNo,
      invoiceDate: line.invoiceDate?.toISOString() ?? null,
      currency: normalizeCurrency(line.currency),
      amount,
      convertedAmount: converted.converted,
      convertedCurrency: displayCurrency,
      convertedFxDate: converted.fxDate,
      createdByName: line.createdBy.name,
      createdAt: line.createdAt.toISOString(),
    };
  });
  const totalOriginalByCurrency = costLines.reduce<Record<string, number>>((acc, row) => {
    const key = row.currency;
    acc[key] = (acc[key] ?? 0) + row.amount;
    return acc;
  }, {});
  const convertedRows = costLines.filter((r) => r.convertedAmount != null);
  const missingRows = costLines.filter((r) => r.convertedAmount == null && r.currency !== displayCurrency);
  const convertedTotal = convertedRows.reduce((sum, r) => sum + Number(r.convertedAmount ?? 0), 0);
  const assigneeChoices = restricted
    ? []
    : await prisma.user.findMany({
        where: { tenantId, isActive: true },
        orderBy: { name: "asc" },
        take: 200,
        select: { id: true, name: true },
      });

  const docFilter = restricted
    ? s.ctDocuments.filter((d) => d.visibility === "CUSTOMER_SHAREABLE")
    : s.ctDocuments;

  const noteFilter = restricted
    ? s.ctNotes.filter((n) => n.visibility === "SHARED")
    : s.ctNotes;

  const fin = s.ctFinancialSnapshots[0];
  const financial = fin
    ? restricted
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
    restricted
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

  const alerts = restricted
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
        acknowledgedByName: a.acknowledgedBy?.name ?? null,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      }));

  const customerCrmAccount = s.customerCrmAccount
    ? {
        id: s.customerCrmAccount.id,
        name: s.customerCrmAccount.name,
        legalName: restricted ? null : (s.customerCrmAccount.legalName ?? null),
      }
    : null;

  const orderPayload = restricted
    ? {
        id: s.order.id,
        orderNumber: s.order.orderNumber,
        incoterm: s.order.incoterm,
        shipToName: s.order.shipToName,
        shipToCity: s.order.shipToCity,
        shipToCountryCode: s.order.shipToCountryCode,
        supplier: s.order.supplier
          ? { id: s.order.supplier.id, name: s.order.supplier.name }
          : null,
      }
    : s.order;

  const ctMilestoneInputs = s.ctTrackingMilestones.map((m) => ({
    code: m.code,
    label: m.label,
    plannedAt: m.plannedAt?.toISOString() ?? null,
    predictedAt: m.predictedAt?.toISOString() ?? null,
    actualAt: m.actualAt?.toISOString() ?? null,
  }));
  const milestoneSummary = restricted ? null : computeCtMilestoneSummary(ctMilestoneInputs);
  const milestonePackCatalog = restricted ? null : listMilestonePackSummaries();

  return {
    view: { restricted },
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
    shipmentNotes: restricted ? null : s.notes,
    customerCrmAccountId: s.customerCrmAccountId,
    customerCrmAccount,
    crmAccountChoices,
    assigneeChoices,
    createdBy: { name: s.createdBy.name },
    order: orderPayload,
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
          notes: restricted ? null : s.booking.notes,
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
      note: restricted ? null : m.note,
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
      notes: restricted ? null : m.notes,
      updatedByName: m.updatedBy.name,
      updatedAt: m.updatedAt.toISOString(),
    })),
    milestoneSummary,
    milestonePackCatalog,
    legs: s.ctLegs.map((leg) => ({
      id: leg.id,
      legNo: leg.legNo,
      originCode: leg.originCode,
      destinationCode: leg.destinationCode,
      carrier: leg.carrier,
      transportMode: leg.transportMode,
      plannedEtd: leg.plannedEtd?.toISOString() ?? null,
      plannedEta: leg.plannedEta?.toISOString() ?? null,
      actualAtd: leg.actualAtd?.toISOString() ?? null,
      actualAta: leg.actualAta?.toISOString() ?? null,
      notes: restricted ? null : leg.notes,
      updatedAt: leg.updatedAt.toISOString(),
    })),
    containers: s.ctContainers.map((c) => ({
      id: c.id,
      containerNumber: c.containerNumber,
      containerType: c.containerType,
      seal: restricted ? null : c.seal,
      status: c.status,
      gateInAt: c.gateInAt?.toISOString() ?? null,
      gateOutAt: c.gateOutAt?.toISOString() ?? null,
      notes: restricted ? null : c.notes,
      legId: c.legId,
      legNo: c.leg?.legNo ?? null,
      updatedAt: c.updatedAt.toISOString(),
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
    costing: restricted
      ? null
      : {
          displayCurrency,
          totalOriginalByCurrency,
          convertedTotal,
          missingConversionCount: missingRows.length,
          fxDates: Array.from(fxDates).sort(),
          lines: costLines,
          availableFxRates: latestRates.map((r) => ({
            id: r.id,
            baseCurrency: r.baseCurrency,
            quoteCurrency: r.quoteCurrency,
            rate: Number(r.rate),
            rateDate: r.rateDate.toISOString(),
            provider: r.provider,
          })),
        },
    alerts,
    exceptions,
    auditTrail: restricted
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
