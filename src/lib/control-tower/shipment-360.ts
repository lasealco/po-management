import { userHasGlobalGrant } from "@/lib/authz";
import { addTariffShipmentApplicationSourceLabel } from "@/lib/tariff/tariff-shipment-application-labels";
import { prisma } from "@/lib/prisma";
import { convertAmount, minorToAmount, normalizeCurrency } from "@/lib/control-tower/currency";

import {
  controlTowerShipmentAccessWhere,
  type ControlTowerPortalContext,
} from "./viewer";
import { computeCtMilestoneSummary } from "./milestone-summary";
import { filterCtTrackingMilestonesForPortal } from "./milestone-visibility";
import {
  filterMilestonePackCatalogByTransportMode,
  listMilestonePackCatalogForTenant,
} from "./milestone-templates";
import { buildRoutePerformance } from "./route-performance";
import { computeShipmentEmissionsSummary } from "./shipment-emissions";
import { labelForCtDocType } from "./shipment-document-types";

function localityLine(
  city: string | null | undefined,
  region: string | null | undefined,
  postal: string | null | undefined,
  country: string | null | undefined,
): string | null {
  const line = [postal, region, city].map((x) => (x ? String(x).trim() : "")).filter(Boolean).join(" ");
  const cc = country ? String(country).trim().toUpperCase() : "";
  if (line && cc) return `${line}, ${cc}`;
  if (line) return line;
  if (cc) return cc;
  return null;
}

/** Shipper / consignee / notify blocks in the style of BOL / AWB party boxes (from PO + supplier master). */
function buildBolDocumentParties(
  s: {
    order: {
      internalNotes?: string | null;
      shipToName: string | null;
      shipToLine1: string | null;
      shipToLine2: string | null;
      shipToCity: string | null;
      shipToRegion: string | null;
      shipToPostalCode: string | null;
      shipToCountryCode: string | null;
      supplier: {
        name: string;
        legalName: string | null;
        taxId: string | null;
        registeredAddressLine1: string | null;
        registeredAddressLine2: string | null;
        registeredCity: string | null;
        registeredRegion: string | null;
        registeredPostalCode: string | null;
        registeredCountryCode: string | null;
      } | null;
    };
    customerCrmAccount: { name: string; legalName: string | null } | null;
  },
  restricted: boolean,
) {
  const o = s.order;
  const sup = o.supplier;
  const shipperFallback = (() => {
    const text = o.internalNotes || "";
    const m = text.match(/(?:^|\n)Shipper:\s*(.+)/i);
    return m?.[1]?.trim() || null;
  })();
  const shipperName = sup ? (sup.legalName?.trim() || sup.name) : shipperFallback;
  const shipperLines: string[] = [];
  if (sup && !restricted) {
    if (sup.registeredAddressLine1?.trim()) shipperLines.push(sup.registeredAddressLine1.trim());
    if (sup.registeredAddressLine2?.trim()) shipperLines.push(sup.registeredAddressLine2.trim());
  }
  const shipperLocality = sup
    ? localityLine(sup.registeredCity, sup.registeredRegion, sup.registeredPostalCode, sup.registeredCountryCode)
    : null;

  const consigneeName = o.shipToName?.trim() || null;
  const consigneeLines: string[] = [];
  if (!restricted) {
    if (o.shipToLine1?.trim()) consigneeLines.push(o.shipToLine1.trim());
    if (o.shipToLine2?.trim()) consigneeLines.push(o.shipToLine2.trim());
  }
  const consigneeLocality = localityLine(
    o.shipToCity,
    o.shipToRegion,
    o.shipToPostalCode,
    o.shipToCountryCode,
  );

  return {
    shipper: {
      name: shipperName,
      addressLines: shipperLines,
      localityLine: shipperLocality,
      taxId: restricted ? null : (sup?.taxId?.trim() || null),
    },
    consignee: {
      name: consigneeName,
      addressLines: consigneeLines,
      localityLine: consigneeLocality,
    },
    notifyParty: s.customerCrmAccount
      ? {
          name: s.customerCrmAccount.name,
          legalName: restricted ? null : (s.customerCrmAccount.legalName?.trim() || null),
        }
      : null,
  };
}

export async function getShipment360(params: {
  tenantId: string;
  shipmentId: string;
  ctx: ControlTowerPortalContext;
  actorUserId: string;
}) {
  const { tenantId, shipmentId, ctx, actorUserId } = params;
  const scope = await controlTowerShipmentAccessWhere(tenantId, ctx, actorUserId);
  const restricted = ctx.isRestrictedView;

  const s = await prisma.shipment.findFirst({
    where: { id: shipmentId, ...scope },
    include: {
      customerCrmAccount: {
        select: { id: true, name: true, legalName: true },
      },
      carrierSupplier: {
        select: { id: true, name: true },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          requestedDeliveryDate: true,
          incoterm: true,
          internalNotes: true,
          buyerReference: true,
          supplierReference: true,
          shipToName: true,
          shipToLine1: true,
          shipToLine2: true,
          shipToCity: true,
          shipToRegion: true,
          shipToPostalCode: true,
          shipToCountryCode: true,
          supplier: {
            select: {
              id: true,
              name: true,
              legalName: true,
              taxId: true,
              registeredAddressLine1: true,
              registeredAddressLine2: true,
              registeredCity: true,
              registeredRegion: true,
              registeredPostalCode: true,
              registeredCountryCode: true,
            },
          },
        },
      },
      createdBy: { select: { id: true, name: true } },
      opsAssignee: { select: { id: true, name: true } },
      salesOrder: {
        select: {
          id: true,
          soNumber: true,
          status: true,
          customerName: true,
          externalRef: true,
        },
      },
      booking: {
        include: {
          forwarderSupplier: { select: { id: true, name: true } },
          forwarderOffice: { select: { id: true, name: true, city: true } },
          forwarderContact: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true } },
          updatedBy: { select: { id: true, name: true } },
        },
      },
      items: {
        include: {
          orderItem: {
            select: {
              lineNo: true,
              description: true,
              quantity: true,
              product: {
                select: {
                  sku: true,
                  productCode: true,
                  name: true,
                  hsCode: true,
                  isDangerousGoods: true,
                  unNumber: true,
                },
              },
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
        include: {
          leg: { select: { id: true, legNo: true } },
          cargoLines: {
            orderBy: { createdAt: "asc" },
            include: {
              shipmentItem: {
                select: {
                  id: true,
                  orderItem: { select: { lineNo: true, description: true } },
                },
              },
            },
          },
        },
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
  const salesOrderChoices = restricted
    ? []
    : await prisma.salesOrder.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true, soNumber: true, customerName: true, status: true },
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
        vendorSupplierId: line.vendorSupplierId,
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

  const exceptionCodeCatalog = await prisma.ctExceptionCode.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    select: { code: true, label: true, defaultSeverity: true },
  });
  const exceptionLabelByCode = new Map(exceptionCodeCatalog.map((c) => [c.code, c.label]));

  let forwarderSupplierChoices: { id: string; name: string }[] = [];
  let forwarderOfficeChoices: { id: string; name: string; supplierId: string }[] = [];
  let forwarderContactChoices: { id: string; name: string; supplierId: string; email: string | null }[] = [];
  if (!restricted) {
    forwarderSupplierChoices = await prisma.supplier.findMany({
      where: {
        tenantId,
        isActive: true,
        approvalStatus: "approved",
        srmCategory: "logistics",
      },
      orderBy: { name: "asc" },
      take: 400,
      select: { id: true, name: true },
    });
    const fwdSid = s.booking?.forwarderSupplierId;
    if (fwdSid) {
      forwarderOfficeChoices = await prisma.supplierOffice.findMany({
        where: { tenantId, supplierId: fwdSid, isActive: true },
        orderBy: { name: "asc" },
        take: 200,
        select: { id: true, name: true, supplierId: true },
      });
      forwarderContactChoices = await prisma.supplierContact.findMany({
        where: { tenantId, supplierId: fwdSid },
        orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
        take: 200,
        select: { id: true, name: true, supplierId: true, email: true },
      });
    }
  }

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
          typeLabel: exceptionLabelByCode.get(e.type) ?? e.type,
          status: e.status,
          severity: e.severity,
          createdAt: e.createdAt.toISOString(),
        }
      : {
          id: e.id,
          type: e.type,
          typeLabel: exceptionLabelByCode.get(e.type) ?? e.type,
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
        requestedDeliveryDate: s.order.requestedDeliveryDate?.toISOString() ?? null,
        incoterm: s.order.incoterm,
        shipToName: s.order.shipToName,
        shipToCity: s.order.shipToCity,
        shipToCountryCode: s.order.shipToCountryCode,
        supplier: s.order.supplier
          ? { id: s.order.supplier.id, name: s.order.supplier.name }
          : null,
      }
    : {
        ...s.order,
        requestedDeliveryDate: s.order.requestedDeliveryDate?.toISOString() ?? null,
      };

  const canViewTariffGlueCT =
    !restricted && (await userHasGlobalGrant(actorUserId, "org.tariffs", "view"));
  const canEditTariffGlueCT =
    !restricted && (await userHasGlobalGrant(actorUserId, "org.tariffs", "edit"));

  const tariffGlue = canViewTariffGlueCT
    ? await (async () => {
        const apps = await prisma.tariffShipmentApplication.findMany({
          where: { tenantId, shipmentId },
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
        return {
          canView: true as const,
          canEdit: canEditTariffGlueCT,
          applications: apps.map((a) => {
            const h = a.contractVersion.contractHeader;
            return addTariffShipmentApplicationSourceLabel({
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
            });
          }),
        };
      })()
    : null;

  const bolDocumentParties = buildBolDocumentParties(s, restricted);
  const documentRouting = {
    originCode: s.booking?.originCode ?? null,
    destinationCode: s.booking?.destinationCode ?? null,
    incoterm: s.order.incoterm ?? null,
    buyerReference: restricted ? null : (s.order.buyerReference ?? null),
    supplierReference: restricted ? null : (s.order.supplierReference ?? null),
  };

  const ctMilestoneSourceRows = restricted
    ? filterCtTrackingMilestonesForPortal(s.ctTrackingMilestones)
    : s.ctTrackingMilestones;
  const ctMilestoneInputs = ctMilestoneSourceRows.map((m) => ({
    code: m.code,
    label: m.label,
    plannedAt: m.plannedAt?.toISOString() ?? null,
    predictedAt: m.predictedAt?.toISOString() ?? null,
    actualAt: m.actualAt?.toISOString() ?? null,
  }));
  const milestoneSummary = computeCtMilestoneSummary(ctMilestoneInputs);
  const fullMilestonePackCatalog = restricted ? null : await listMilestonePackCatalogForTenant(tenantId);
  const effectiveTransportMode = (s.transportMode ?? s.booking?.mode) ?? null;
  const milestonePackCatalog =
    restricted || !fullMilestonePackCatalog
      ? null
      : filterMilestonePackCatalogByTransportMode(fullMilestonePackCatalog, effectiveTransportMode);
  const canApplyMilestonePack = !restricted && s.ctTrackingMilestones.length === 0;

  const legsForEmissions =
    s.ctLegs.length > 0
      ? s.ctLegs.map((leg) => ({
          legNo: leg.legNo,
          originCode: leg.originCode,
          destinationCode: leg.destinationCode,
          transportMode: leg.transportMode,
          plannedEtd: leg.plannedEtd,
          plannedEta: leg.plannedEta,
          actualAtd: leg.actualAtd,
          actualAta: leg.actualAta,
        }))
      : s.booking?.originCode?.trim() && s.booking?.destinationCode?.trim()
        ? [
            {
              legNo: 1,
              originCode: s.booking.originCode,
              destinationCode: s.booking.destinationCode,
              transportMode: s.booking.mode ?? s.transportMode,
              plannedEtd: s.booking.etd,
              plannedEta: s.booking.latestEta ?? s.booking.eta,
              actualAtd: null,
              actualAta: null,
            },
          ]
        : [];

  const emissionsSummary = computeShipmentEmissionsSummary({
    legs: legsForEmissions,
    shipmentTransportMode: s.transportMode,
    cargoChargeableWeightKg: s.cargoChargeableWeightKg,
    estimatedWeightKg: s.estimatedWeightKg,
    lineCargoGrossKg: s.items.map((it) => it.cargoGrossWeightKg),
  });

  const routePerformance = buildRoutePerformance({
    requestedDeliveryDate: s.order.requestedDeliveryDate,
    booking: s.booking
      ? {
          etd: s.booking.etd,
          eta: s.booking.eta,
          latestEta: s.booking.latestEta,
          originCode: s.booking.originCode,
          destinationCode: s.booking.destinationCode,
        }
      : null,
    legs: s.ctLegs.map((leg) => ({
      legNo: leg.legNo,
      originCode: leg.originCode,
      destinationCode: leg.destinationCode,
      plannedEtd: leg.plannedEtd,
      plannedEta: leg.plannedEta,
      actualAtd: leg.actualAtd,
      actualAta: leg.actualAta,
    })),
    shipmentReceivedAt: s.receivedAt,
    shipmentStatus: s.status,
  });

  return {
    view: { restricted },
    id: s.id,
    shipmentNo: s.shipmentNo,
    status: s.status,
    transportMode: s.transportMode,
    carrierSupplierId: s.carrierSupplierId,
    carrierSupplierName: s.carrierSupplier?.name ?? null,
    carrier: s.carrier,
    trackingNo: s.trackingNo,
    asnReference: s.asnReference,
    expectedReceiveAt: s.expectedReceiveAt?.toISOString() ?? null,
    shippedAt: s.shippedAt.toISOString(),
    receivedAt: s.receivedAt?.toISOString() ?? null,
    estimatedVolumeCbm: s.estimatedVolumeCbm?.toString() ?? null,
    estimatedWeightKg: s.estimatedWeightKg?.toString() ?? null,
    cargoOuterPackageCount: s.cargoOuterPackageCount ?? null,
    cargoChargeableWeightKg: s.cargoChargeableWeightKg?.toString() ?? null,
    cargoDimensionsText: s.cargoDimensionsText ?? null,
    cargoCommoditySummary: s.cargoCommoditySummary ?? null,
    shipmentNotes: restricted ? null : s.notes,
    customerCrmAccountId: s.customerCrmAccountId,
    customerCrmAccount,
    bolDocumentParties,
    documentRouting,
    crmAccountChoices,
    assigneeChoices,
    exceptionCodeCatalog,
    forwarderSupplierChoices: restricted ? [] : forwarderSupplierChoices,
    forwarderOfficeChoices: restricted ? [] : forwarderOfficeChoices,
    forwarderContactChoices: restricted ? [] : forwarderContactChoices,
    opsAssigneeUserId: restricted ? null : s.opsAssigneeUserId,
    opsAssignee: restricted
      ? null
      : s.opsAssignee
        ? { id: s.opsAssignee.id, name: s.opsAssignee.name }
        : null,
    createdBy: { id: s.createdBy.id, name: s.createdBy.name },
    salesOrder: s.salesOrder
      ? {
          id: s.salesOrder.id,
          soNumber: s.salesOrder.soNumber,
          status: s.salesOrder.status,
          customerName: s.salesOrder.customerName,
          externalRef: s.salesOrder.externalRef,
        }
      : null,
    salesOrderChoices,
    order: orderPayload,
    routePerformance,
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
          bookingSentAt: s.booking.bookingSentAt?.toISOString() ?? null,
          bookingConfirmSlaDueAt: s.booking.bookingConfirmSlaDueAt?.toISOString() ?? null,
          notes: restricted ? null : s.booking.notes,
          forwarderSupplierId: s.booking.forwarderSupplierId,
          forwarderOfficeId: restricted ? null : s.booking.forwarderOfficeId,
          forwarderContactId: restricted ? null : s.booking.forwarderContactId,
          forwarderSupplierName: s.booking.forwarderSupplier?.name ?? null,
          forwarderOfficeName: restricted ? null : (s.booking.forwarderOffice?.name ?? null),
          forwarderOfficeCity: restricted ? null : (s.booking.forwarderOffice?.city ?? null),
          forwarderContactName: restricted ? null : (s.booking.forwarderContact?.name ?? null),
          forwarderContactEmail: restricted ? null : (s.booking.forwarderContact?.email ?? null),
          bookingCreatedByName: restricted ? null : s.booking.createdBy.name,
          bookingUpdatedByName: restricted ? null : s.booking.updatedBy.name,
        }
      : null,
    lines: s.items.map((it) => ({
      id: it.id,
      quantityShipped: it.quantityShipped.toString(),
      quantityReceived: it.quantityReceived.toString(),
      lineNo: it.orderItem.lineNo,
      description: it.orderItem.description,
      orderLineQuantity: it.orderItem.quantity.toString(),
      product: it.orderItem.product,
      cargoPackageCount: it.cargoPackageCount ?? null,
      cargoGrossWeightKg: it.cargoGrossWeightKg?.toString() ?? null,
      cargoVolumeCbm: it.cargoVolumeCbm?.toString() ?? null,
      cargoDimensionsText: it.cargoDimensionsText ?? null,
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
    ctTrackingMilestones: ctMilestoneSourceRows.map((m) => ({
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
    canApplyMilestonePack,
    transportModeForMilestonePacks: effectiveTransportMode,
    emissionsSummary: {
      tonnageKg: emissionsSummary.tonnageKg,
      tonnageSource: emissionsSummary.tonnageSource,
      totalKgCo2e: emissionsSummary.totalKgCo2e,
      totalDistanceKm: emissionsSummary.totalDistanceKm,
      methodology: emissionsSummary.methodology,
      legs: emissionsSummary.legs.map((row) => ({
        legNo: row.legNo,
        originCode: row.originCode,
        destinationCode: row.destinationCode,
        mode: row.mode,
        distanceKm: row.distanceKm,
        distanceSource: row.distanceSource,
        kgCo2e: row.kgCo2e,
      })),
    },
    legs: s.ctLegs.map((leg) => ({
      id: leg.id,
      legNo: leg.legNo,
      originCode: leg.originCode,
      destinationCode: leg.destinationCode,
      carrierSupplierId: leg.carrierSupplierId,
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
      cargoLines: c.cargoLines.map((cl) => ({
        id: cl.id,
        shipmentItemId: cl.shipmentItemId,
        quantity: cl.quantity.toString(),
        notes: restricted ? null : cl.notes,
        lineNo: cl.shipmentItem.orderItem.lineNo,
        description: cl.shipmentItem.orderItem.description,
      })),
    })),
    documents: docFilter.map((d) => ({
      id: d.id,
      docType: d.docType,
      docTypeLabel: labelForCtDocType(d.docType),
      fileName: d.fileName,
      blobUrl: d.blobUrl,
      visibility: d.visibility,
      version: d.version,
      source: d.source,
      integrationProvider: restricted ? null : d.integrationProvider,
      externalRef: restricted ? null : d.externalRef,
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
    tariff: tariffGlue,
  };
}
