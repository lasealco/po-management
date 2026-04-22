import type { Prisma } from "@prisma/client";
import {
  ContainerSize,
  CtAlertSeverity,
  CtAlertStatus,
  CtDocVisibility,
  CtExceptionStatus,
  CtNoteVisibility,
  CtShipmentDocumentSource,
  InvoiceAuditLineOutcome,
  InvoiceAuditRollupOutcome,
  InvoiceIntakeStatus,
  InvoiceReviewDecision,
  LoadPlanStatus,
  SalesOrderStatus,
  ShipmentBookingStatus,
  ShipmentMilestoneCode,
  ShipmentMilestoneSource,
  ShipmentStatus,
  SrmSupplierCategory,
  SupplierApprovalStatus,
  TransportMode,
  WmsTaskStatus,
  WmsTaskType,
  WmsWaveStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { ensureBookingConfirmationSlaAlerts } from "./booking-sla";
import { isProbableControlTowerShipmentCuid } from "./search-query";
import {
  controlTowerShipmentScopeWhere,
  type ControlTowerPortalContext,
} from "./viewer";
import { computeCtMilestoneSummary } from "./milestone-summary";

const TERMINAL_SHIPMENT: Array<"DELIVERED" | "RECEIVED"> = ["DELIVERED", "RECEIVED"];

const ROUTE_ACTION_PREFIXES = [
  "Send booking",
  "Await booking",
  "Escalate booking",
  "Plan leg",
  "Mark departure",
  "Record arrival",
  "Route complete",
] as const;

/** Sanitized token for `CtException.type`, `CtAlert.type`, etc. (alphanumeric + `._-`, max 80). */
function parseControlTowerTokenFilter(raw: string | undefined | null): string | undefined {
  if (raw == null) return undefined;
  const t = raw.trim().slice(0, 80);
  if (!t || !/^[\w.-]+$/i.test(t)) return undefined;
  return t;
}

export type ListShipmentsQuery = {
  status?: ShipmentStatus | "";
  mode?: TransportMode | "";
  q?: string;
  take?: number;
  /** Booking ETA or latest ETA before now; excludes terminal shipments. */
  onlyOverdueEta?: boolean;
  /** Prefix of derived `nextAction` (e.g. `Plan leg`); applied after fetch with overscan. */
  routeActionPrefix?: (typeof ROUTE_ACTION_PREFIXES)[number] | "";
  /** Shipments with at least one open alert or open exception assigned to this user (internal lists). */
  dispatchOwnerUserId?: string;
  lane?: string;
  /** Shipment carrier supplier id exact match. */
  carrierSupplierId?: string;
  /** Purchase order supplier id exact match. */
  supplierId?: string;
  /** Linked CRM customer account id exact match. */
  customerCrmAccountId?: string;
  /** Booking or leg origin port code contains. */
  originCode?: string;
  /** Booking or leg destination port code contains. */
  destinationCode?: string;
  /** PO-linked operational flow vs ad-hoc export shell order flow. */
  shipmentSource?: "PO" | "UNLINKED" | "";
  /** Open / in-progress `CtException.type` equals this catalog-style code (case-insensitive). */
  exceptionCode?: string;
  /** Open / acknowledged `CtAlert.type` equals this string (case-insensitive). */
  alertType?: string;
  minRouteProgressPct?: number;
  maxRouteProgressPct?: number;
};

const listSelectCore = {
  id: true,
  shipmentNo: true,
  status: true,
  transportMode: true,
  trackingNo: true,
  carrierSupplierId: true,
  carrier: true,
  shippedAt: true,
  updatedAt: true,
  receivedAt: true,
  expectedReceiveAt: true,
  estimatedVolumeCbm: true,
  estimatedWeightKg: true,
  customerCrmAccountId: true,
  customerCrmAccount: {
    select: { name: true },
  },
  order: {
    select: {
      id: true,
      orderNumber: true,
      title: true,
      buyerReference: true,
      supplierId: true,
      supplier: { select: { id: true, name: true } },
    },
  },
  items: {
    orderBy: { id: "asc" as const },
    take: 1,
    select: { quantityShipped: true },
  },
  ctReferences: {
    where: {
      refType: {
        in: ["SHIPPER", "CONSIGNEE", "QTY", "WEIGHT_KG", "CBM"] as const,
      },
    },
    select: { refType: true, refValue: true },
    take: 12,
  },
  booking: {
    select: {
      status: true,
      mode: true,
      originCode: true,
      destinationCode: true,
      etd: true,
      eta: true,
      latestEta: true,
      bookingSentAt: true,
      bookingConfirmSlaDueAt: true,
    },
  },
  milestones: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { code: true, actualAt: true, plannedAt: true },
  },
  ctLegs: {
    orderBy: { legNo: "asc" as const },
    select: {
      legNo: true,
      originCode: true,
      destinationCode: true,
      transportMode: true,
      plannedEtd: true,
      plannedEta: true,
      actualAtd: true,
      actualAta: true,
    },
  },
} satisfies Prisma.ShipmentSelect;

const listSelectInternal = {
  ...listSelectCore,
  _count: {
    select: {
      ctAlerts: {
        where: { status: { in: ["OPEN", "ACKNOWLEDGED"] as const } },
      },
      ctExceptions: {
        where: { status: { in: ["OPEN", "IN_PROGRESS"] as const } },
      },
    },
  },
  ctAlerts: {
    where: { status: { in: ["OPEN", "ACKNOWLEDGED"] as const } },
    orderBy: { createdAt: "asc" as const },
    take: 25,
    select: {
      owner: { select: { id: true, name: true } },
    },
  },
  ctExceptions: {
    where: { status: { in: ["OPEN", "IN_PROGRESS"] as const } },
    orderBy: { createdAt: "asc" as const },
    take: 25,
    select: {
      owner: { select: { id: true, name: true } },
    },
  },
  ctTrackingMilestones: {
    where: { actualAt: null },
    orderBy: [{ plannedAt: "asc" }, { predictedAt: "asc" }],
    take: 20,
    select: {
      code: true,
      label: true,
      plannedAt: true,
      predictedAt: true,
      actualAt: true,
    },
  },
} satisfies Prisma.ShipmentSelect;

type ShipmentListCore = Prisma.ShipmentGetPayload<{ select: typeof listSelectCore }>;
type ShipmentListInternal = Prisma.ShipmentGetPayload<{ select: typeof listSelectInternal }>;

function decDisplay(d: Prisma.Decimal | null | undefined, fracDigits = 2): string | null {
  if (d == null) return null;
  const n = Number(d);
  if (!Number.isFinite(n)) return null;
  if (fracDigits <= 0) return String(Math.round(n));
  const rounded = Number(n.toFixed(fracDigits));
  return String(rounded);
}

function deriveRouteNextAction(s: ShipmentListCore | ShipmentListInternal): string | null {
  if (!s.ctLegs.length) return null;
  const phases = s.ctLegs.map((leg) => {
    if (leg.actualAta) return "Arrived";
    if (leg.actualAtd) return "Departed";
    if (leg.plannedEtd || leg.plannedEta) return "Planned";
    return "Draft";
  });
  const nextLegIdx = phases.findIndex((p) => p !== "Arrived");
  const nextLeg = nextLegIdx >= 0 ? s.ctLegs[nextLegIdx] : null;
  if (nextLegIdx === -1) return "Route complete";
  if (phases[nextLegIdx] === "Draft") return `Plan leg ${nextLeg?.legNo ?? "?"}`;
  if (phases[nextLegIdx] === "Planned") return `Mark departure leg ${nextLeg?.legNo ?? "?"}`;
  return `Record arrival leg ${nextLeg?.legNo ?? "?"}`;
}

function deriveBookingNextAction(s: ShipmentListCore | ShipmentListInternal): string | null {
  const b = s.booking;
  if (!b?.status) return null;
  if (b.status === "DRAFT") return "Send booking to forwarder";
  if (b.status === "SENT") {
    const dueMs = b.bookingConfirmSlaDueAt ? b.bookingConfirmSlaDueAt.getTime() : null;
    if (dueMs !== null && dueMs < Date.now()) return "Escalate booking SLA";
    return "Await booking confirmation";
  }
  return null;
}

function mapShipmentListRow(s: ShipmentListCore | ShipmentListInternal) {
  const firstLeg = s.ctLegs[0];
  const lastLeg = s.ctLegs[s.ctLegs.length - 1];
  const phases = s.ctLegs.map((leg) => {
    if (leg.actualAta) return "Arrived";
    if (leg.actualAtd) return "Departed";
    if (leg.plannedEtd || leg.plannedEta) return "Planned";
    return "Draft";
  });
  const routeProgressPct =
    s.ctLegs.length === 0
      ? null
      : Math.round(
          (phases.reduce((sum, p) => {
            if (p === "Arrived") return sum + 1;
            if (p === "Departed") return sum + 0.6;
            if (p === "Planned") return sum + 0.2;
            return sum;
          }, 0) /
            s.ctLegs.length) *
            100,
        );
  const bookingStatus = s.booking?.status ?? null;
  const bookingSlaBreached =
    bookingStatus === "SENT" &&
    Boolean(s.booking?.bookingConfirmSlaDueAt && s.booking.bookingConfirmSlaDueAt.getTime() < Date.now());
  const bookingPipeline = bookingStatus === "DRAFT" || bookingStatus === "SENT";
  const bookingAction = deriveBookingNextAction(s);
  const routeNext = deriveRouteNextAction(s);
  const nextAction = bookingPipeline && bookingAction ? bookingAction : routeNext;

  const internal = "_count" in s ? s : null;
  const ctOpenRows = internal
    ? internal.ctTrackingMilestones.map((m) => ({
        code: m.code,
        label: m.label,
        plannedAt: m.plannedAt?.toISOString() ?? null,
        predictedAt: m.predictedAt?.toISOString() ?? null,
        actualAt: m.actualAt?.toISOString() ?? null,
      }))
    : [];
  const trackingMilestoneSummary = internal ? computeCtMilestoneSummary(ctOpenRows) : null;
  const dispatchOwner = internal
    ? (internal.ctAlerts.find((a) => a.owner)?.owner ??
        internal.ctExceptions.find((e) => e.owner)?.owner ??
        null)
    : null;
  const openQueueCounts = internal
    ? {
        openAlerts: internal._count.ctAlerts,
        openExceptions: internal._count.ctExceptions,
      }
    : { openAlerts: 0, openExceptions: 0 };

  return {
    id: s.id,
    shipmentNo: s.shipmentNo,
    status: s.status,
    transportMode: s.transportMode ?? s.booking?.mode ?? firstLeg?.transportMode ?? null,
    trackingNo: s.trackingNo,
    carrier: s.carrier,
    carrierSupplierId: s.carrierSupplierId,
    shippedAt: s.shippedAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    customerCrmAccountId: s.customerCrmAccountId,
    customerCrmAccountName: s.customerCrmAccount?.name ?? null,
    orderId: s.order.id,
    orderNumber: s.order.orderNumber,
    supplierId: s.order.supplier?.id ?? null,
    supplierName: s.order.supplier?.name ?? null,
    externalOrderRef: s.order.buyerReference ?? null,
    shipmentSource:
      !s.order.supplier?.name && (s.order.title || "").startsWith("Ad-hoc export shipment")
        ? ("UNLINKED" as const)
        : ("PO" as const),
    originCode: s.booking?.originCode ?? firstLeg?.originCode ?? null,
    destinationCode: s.booking?.destinationCode ?? lastLeg?.destinationCode ?? null,
    etd: s.booking?.etd?.toISOString() ?? null,
    eta:
      (s.booking?.eta ?? s.expectedReceiveAt)?.toISOString() ??
      lastLeg?.plannedEta?.toISOString() ??
      null,
    latestEta:
      (s.booking?.latestEta ?? s.booking?.eta ?? s.expectedReceiveAt)?.toISOString() ?? null,
    routeProgressPct,
    nextAction,
    bookingStatus,
    bookingSlaBreached,
    bookingSentAt: s.booking?.bookingSentAt?.toISOString() ?? null,
    bookingConfirmSlaDueAt: s.booking?.bookingConfirmSlaDueAt?.toISOString() ?? null,
    latestMilestone: s.milestones[0]
      ? {
          code: s.milestones[0].code,
          hasActual: Boolean(s.milestones[0].actualAt),
        }
      : null,
    trackingMilestoneSummary,
    dispatchOwner,
    openQueueCounts,
    quantityRef:
      s.ctReferences.find((r) => r.refType === "QTY")?.refValue ??
      (s.items[0] ? String(Number(s.items[0].quantityShipped)) : null),
    weightKgRef:
      s.ctReferences.find((r) => r.refType === "WEIGHT_KG")?.refValue ??
      decDisplay(s.estimatedWeightKg, 1),
    cbmRef:
      s.ctReferences.find((r) => r.refType === "CBM")?.refValue ?? decDisplay(s.estimatedVolumeCbm, 3),
    receivedAt: s.receivedAt?.toISOString() ?? null,
  };
}

export type ControlTowerShipmentListRow = ReturnType<typeof mapShipmentListRow>;

export type ListControlTowerShipmentsResult = {
  rows: ControlTowerShipmentListRow[];
  /** Max rows returned after route-action / progress post-filters (`query.take` clamped 1–200, default 80). */
  listLimit: number;
  /** True when the list is full at `listLimit` and more rows may exist. */
  truncated: boolean;
};

export async function listControlTowerShipments(params: {
  tenantId: string;
  ctx: ControlTowerPortalContext;
  query: ListShipmentsQuery;
}): Promise<ListControlTowerShipmentsResult> {
  const { tenantId, ctx, query } = params;
  const rawTake = query.take;
  const requestedTake =
    typeof rawTake === "number" && Number.isFinite(rawTake)
      ? Math.min(Math.max(Math.floor(rawTake), 1), 200)
      : 80;
  const routePrefix =
    query.routeActionPrefix &&
    ROUTE_ACTION_PREFIXES.includes(query.routeActionPrefix as (typeof ROUTE_ACTION_PREFIXES)[number])
      ? query.routeActionPrefix
      : "";
  const dbTake = routePrefix ? Math.min(600, Math.max(requestedTake * 5, 120)) : requestedTake;
  const scope = controlTowerShipmentScopeWhere(tenantId, ctx);
  const now = new Date();

  const where: Prisma.ShipmentWhereInput = {
    ...scope,
    ...(query.status ? { status: query.status } : {}),
  };

  const ands: Prisma.ShipmentWhereInput[] = [];
  if (query.mode) {
    ands.push({
      OR: [
        { transportMode: query.mode },
        { booking: { is: { mode: query.mode } } },
      ],
    });
  }
  const q = query.q?.trim();
  if (q) {
    const contains = { contains: q, mode: "insensitive" as const };
    const idOr: Prisma.ShipmentWhereInput[] = isProbableControlTowerShipmentCuid(q) ? [{ id: q }] : [];
    const qLower = q.toLowerCase();
    const milestoneCodesMatching = (Object.values(ShipmentMilestoneCode) as ShipmentMilestoneCode[]).filter((code) =>
      code.toLowerCase().includes(qLower),
    );
    const milestoneMatch: Prisma.ShipmentWhereInput | null =
      milestoneCodesMatching.length > 0
        ? { milestones: { some: { code: { in: milestoneCodesMatching } } } }
        : null;
    const shipmentStatusEnumMatch = (Object.values(ShipmentStatus) as ShipmentStatus[]).filter(
      (s) => s.toLowerCase() === qLower,
    );
    const transportModeEnumMatch = (Object.values(TransportMode) as TransportMode[]).filter(
      (m) => m.toLowerCase() === qLower,
    );
    const bookingStatusEnumMatch = (Object.values(ShipmentBookingStatus) as ShipmentBookingStatus[]).filter(
      (s) => s.toLowerCase() === qLower,
    );
    const invoiceAuditOutcomeEnumMatch = (
      Object.values(InvoiceAuditLineOutcome) as InvoiceAuditLineOutcome[]
    ).filter((o) => o.toLowerCase() === qLower);
    const ctAlertSeverityEnumMatch = (Object.values(CtAlertSeverity) as CtAlertSeverity[]).filter(
      (s) => s.toLowerCase() === qLower,
    );
    const ctAlertStatusEnumMatch = (Object.values(CtAlertStatus) as CtAlertStatus[]).filter(
      (s) => s.toLowerCase() === qLower,
    );
    const ctExceptionStatusEnumMatch = (Object.values(CtExceptionStatus) as CtExceptionStatus[]).filter(
      (s) => s.toLowerCase() === qLower,
    );
    const invoiceIntakeStatusEnumMatch = (Object.values(InvoiceIntakeStatus) as InvoiceIntakeStatus[]).filter(
      (s) => s.toLowerCase() === qLower,
    );
    const invoiceReviewDecisionEnumMatch = (
      Object.values(InvoiceReviewDecision) as InvoiceReviewDecision[]
    ).filter((s) => s.toLowerCase() === qLower);
    const invoiceRollupOutcomeEnumMatch = (
      Object.values(InvoiceAuditRollupOutcome) as InvoiceAuditRollupOutcome[]
    ).filter((s) => s.toLowerCase() === qLower);
    const loadPlanStatusEnumMatch = (Object.values(LoadPlanStatus) as LoadPlanStatus[]).filter(
      (s) => s.toLowerCase() === qLower,
    );
    const containerSizeEnumMatch = (Object.values(ContainerSize) as ContainerSize[]).filter(
      (s) => s.toLowerCase() === qLower,
    );
    const wmsTaskStatusEnumMatch = (Object.values(WmsTaskStatus) as WmsTaskStatus[]).filter(
      (s) => s.toLowerCase() === qLower,
    );
    const wmsTaskTypeEnumMatch = (Object.values(WmsTaskType) as WmsTaskType[]).filter(
      (s) => s.toLowerCase() === qLower,
    );
    const wmsWaveStatusEnumMatch = (Object.values(WmsWaveStatus) as WmsWaveStatus[]).filter(
      (s) => s.toLowerCase() === qLower,
    );
    const salesOrderStatusEnumMatch = (Object.values(SalesOrderStatus) as SalesOrderStatus[]).filter(
      (s) => s.toLowerCase() === qLower,
    );
    const shipmentMilestoneSourceEnumMatch = (
      Object.values(ShipmentMilestoneSource) as ShipmentMilestoneSource[]
    ).filter((s) => s.toLowerCase() === qLower);
    const ctDocVisibilityEnumMatch = (Object.values(CtDocVisibility) as CtDocVisibility[]).filter(
      (s) => s.toLowerCase() === qLower,
    );
    const ctShipmentDocumentSourceEnumMatch = (
      Object.values(CtShipmentDocumentSource) as CtShipmentDocumentSource[]
    ).filter((s) => s.toLowerCase() === qLower);
    const ctNoteVisibilityEnumMatch = (Object.values(CtNoteVisibility) as CtNoteVisibility[]).filter(
      (s) => s.toLowerCase() === qLower,
    );
    const srmSupplierCategoryEnumMatch = (Object.values(SrmSupplierCategory) as SrmSupplierCategory[]).filter(
      (s) => s.toLowerCase() === qLower,
    );
    const supplierApprovalStatusEnumMatch = (
      Object.values(SupplierApprovalStatus) as SupplierApprovalStatus[]
    ).filter((s) => s.toLowerCase() === qLower);
    const enumTokenOr: Prisma.ShipmentWhereInput[] = [
      ...shipmentStatusEnumMatch.map((status) => ({ status })),
      ...transportModeEnumMatch.flatMap((mode) => [
        { transportMode: mode },
        { booking: { is: { mode } } },
      ]),
      ...bookingStatusEnumMatch.map((status) => ({ booking: { is: { status } } })),
      ...invoiceAuditOutcomeEnumMatch.map((outcome) => ({
        booking: {
          is: {
            pricingSnapshots: {
              some: {
                OR: [
                  { invoiceAuditResults: { some: { outcome } } },
                  {
                    invoiceIntakes: {
                      some: {
                        lines: {
                          some: {
                            auditResult: {
                              is: { outcome },
                            },
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      })),
      ...ctAlertSeverityEnumMatch.map((severity) => ({
        ctAlerts: { some: { severity } },
      })),
      ...ctAlertStatusEnumMatch.map((status) => ({
        ctAlerts: { some: { status } },
      })),
      ...ctExceptionStatusEnumMatch.map((status) => ({
        ctExceptions: { some: { status } },
      })),
      ...invoiceIntakeStatusEnumMatch.map((status) => ({
        booking: {
          is: {
            pricingSnapshots: {
              some: {
                invoiceIntakes: { some: { status } },
              },
            },
          },
        },
      })),
      ...invoiceReviewDecisionEnumMatch.map((reviewDecision) => ({
        booking: {
          is: {
            pricingSnapshots: {
              some: {
                invoiceIntakes: { some: { reviewDecision } },
              },
            },
          },
        },
      })),
      ...invoiceRollupOutcomeEnumMatch.map((rollupOutcome) => ({
        booking: {
          is: {
            pricingSnapshots: {
              some: {
                invoiceIntakes: { some: { rollupOutcome } },
              },
            },
          },
        },
      })),
      ...loadPlanStatusEnumMatch.map((status) => ({
        loadPlanShipment: {
          is: {
            loadPlan: { is: { status } },
          },
        },
      })),
      ...containerSizeEnumMatch.map((containerSize) => ({
        loadPlanShipment: {
          is: {
            loadPlan: { is: { containerSize } },
          },
        },
      })),
      ...salesOrderStatusEnumMatch.map((status) => ({
        salesOrder: { is: { status } },
      })),
      ...shipmentMilestoneSourceEnumMatch.map((source) => ({
        milestones: { some: { source } },
      })),
      ...ctDocVisibilityEnumMatch.map((visibility) => ({
        ctDocuments: { some: { visibility } },
      })),
      ...ctShipmentDocumentSourceEnumMatch.map((source) => ({
        ctDocuments: { some: { source } },
      })),
      ...ctNoteVisibilityEnumMatch.map((visibility) => ({
        ctNotes: { some: { visibility } },
      })),
    ];
    const supplierPartyMatch: Prisma.SupplierWhereInput = {
      OR: [
        ...srmSupplierCategoryEnumMatch.map((srmCategory) => ({ srmCategory })),
        ...supplierApprovalStatusEnumMatch.map((approvalStatus) => ({ approvalStatus })),
        { name: contains },
        { code: contains },
        { legalName: contains },
        { email: contains },
        { phone: contains },
        { taxId: contains },
        { website: contains },
        { registeredAddressLine1: contains },
        { registeredAddressLine2: contains },
        { registeredCity: contains },
        { registeredRegion: contains },
        { registeredPostalCode: contains },
        { registeredCountryCode: contains },
        { internalNotes: contains },
        { paymentTermsLabel: contains },
        { defaultIncoterm: contains },
        { creditCurrency: contains },
      ],
    };
    const warehouseTextMatch: Prisma.WarehouseWhereInput = {
      OR: [
        { name: contains },
        { code: contains },
        { addressLine1: contains },
        { city: contains },
        { region: contains },
        { countryCode: contains },
      ],
    };
    const wmsTaskTextMatch: Prisma.WmsTaskWhereInput = {
      OR: [
        { note: contains },
        { referenceType: contains },
        { referenceId: contains },
        {
          createdBy: {
            is: {
              OR: [{ name: contains }, { email: contains }],
            },
          },
        },
        {
          completedBy: {
            is: {
              OR: [{ name: contains }, { email: contains }],
            },
          },
        },
        {
          warehouse: {
            is: warehouseTextMatch,
          },
        },
        {
          product: {
            is: {
              OR: [
                { sku: contains },
                { productCode: contains },
                { name: contains },
                { description: contains },
                { ean: contains },
                { customerName: contains },
              ],
            },
          },
        },
        {
          wave: {
            is: {
              OR: [
                { waveNo: contains },
                { note: contains },
                ...wmsWaveStatusEnumMatch.map((status) => ({ status })),
                {
                  warehouse: {
                    is: warehouseTextMatch,
                  },
                },
                {
                  createdBy: {
                    is: {
                      OR: [{ name: contains }, { email: contains }],
                    },
                  },
                },
              ],
            },
          },
        },
        {
          bin: {
            is: {
              OR: [
                { code: contains },
                { name: contains },
                { rackCode: contains },
                { aisle: contains },
                { bay: contains },
                {
                  zone: {
                    is: {
                      OR: [{ code: contains }, { name: contains }],
                    },
                  },
                },
                {
                  warehouse: {
                    is: warehouseTextMatch,
                  },
                },
              ],
            },
          },
        },
      ],
    };
    ands.push({
      OR: [
        ...idOr,
        ...enumTokenOr,
        { shipmentNo: contains },
        { trackingNo: contains },
        { carrier: contains },
        {
          carrierSupplier: {
            is: supplierPartyMatch,
          },
        },
        { asnReference: contains },
        { notes: contains },
        { cargoCommoditySummary: contains },
        { cargoDimensionsText: contains },
        {
          salesOrder: {
            is: {
              OR: [
                { soNumber: contains },
                { externalRef: contains },
                { customerName: contains },
                { currency: contains },
                { notes: contains },
                {
                  createdBy: {
                    is: {
                      OR: [{ name: contains }, { email: contains }],
                    },
                  },
                },
                {
                  customerCrmAccount: {
                    is: {
                      OR: [
                        { name: contains },
                        { legalName: contains },
                        { website: contains },
                        { industry: contains },
                        { segment: contains },
                        {
                          owner: {
                            is: {
                              OR: [{ name: contains }, { email: contains }],
                            },
                          },
                        },
                        {
                          contacts: {
                            some: {
                              OR: [
                                { firstName: contains },
                                { lastName: contains },
                                { email: contains },
                                { phone: contains },
                                { title: contains },
                                { department: contains },
                                { decisionRole: contains },
                                {
                                  owner: {
                                    is: {
                                      OR: [{ name: contains }, { email: contains }],
                                    },
                                  },
                                },
                              ],
                            },
                          },
                        },
                        {
                          parent: {
                            is: {
                              OR: [{ name: contains }, { legalName: contains }],
                            },
                          },
                        },
                        {
                          children: {
                            some: {
                              OR: [{ name: contains }, { legalName: contains }],
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
        { order: { orderNumber: contains } },
        { order: { title: contains } },
        { order: { buyerReference: contains } },
        { order: { supplierReference: contains } },
        { order: { paymentTermsLabel: contains } },
        { order: { incoterm: contains } },
        { order: { internalNotes: contains } },
        { order: { notesToSupplier: contains } },
        { order: { shipToName: contains } },
        { order: { shipToLine1: contains } },
        { order: { shipToLine2: contains } },
        { order: { shipToCity: contains } },
        { order: { shipToRegion: contains } },
        { order: { shipToPostalCode: contains } },
        { order: { shipToCountryCode: contains } },
        { order: { currency: contains } },
        {
          order: {
            requester: {
              is: {
                OR: [{ name: contains }, { email: contains }],
              },
            },
          },
        },
        {
          order: {
            items: {
              some: {
                OR: [
                  { description: contains },
                  {
                    product: {
                      is: {
                        OR: [
                          { sku: contains },
                          { productCode: contains },
                          { name: contains },
                          { description: contains },
                          { ean: contains },
                          { customerName: contains },
                          { hsCode: contains },
                          { properShippingName: contains },
                          { unNumber: contains },
                          { dangerousGoodsClass: contains },
                          { packagingNotes: contains },
                          { unit: contains },
                          { temperatureRangeText: contains },
                          { temperatureUnit: contains },
                          { coolingType: contains },
                          { humidityRequirements: contains },
                          { storageDescription: contains },
                          {
                            category: {
                              is: {
                                OR: [{ name: contains }, { code: contains }, { description: contains }],
                              },
                            },
                          },
                          {
                            division: {
                              is: {
                                OR: [{ name: contains }, { code: contains }],
                              },
                            },
                          },
                          {
                            supplierOffice: {
                              is: {
                                OR: [
                                  { name: contains },
                                  { addressLine1: contains },
                                  { addressLine2: contains },
                                  { city: contains },
                                  { region: contains },
                                  { postalCode: contains },
                                  { countryCode: contains },
                                ],
                              },
                            },
                          },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        {
          order: {
            splitProposal: {
              is: {
                OR: [
                  { comment: contains },
                  {
                    proposedBy: {
                      is: {
                        OR: [{ name: contains }, { email: contains }],
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        {
          order: {
            splitProposalsAsParent: {
              some: {
                OR: [
                  { comment: contains },
                  {
                    proposedBy: {
                      is: {
                        OR: [{ name: contains }, { email: contains }],
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        {
          order: {
            chats: {
              some: {
                OR: [
                  { body: contains },
                  {
                    author: {
                      is: {
                        OR: [{ name: contains }, { email: contains }],
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        {
          order: {
            transitions: {
              some: {
                OR: [
                  { comment: contains },
                  { actionCode: contains },
                  {
                    actor: {
                      is: {
                        OR: [{ name: contains }, { email: contains }],
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        {
          order: {
            workflow: {
              is: {
                OR: [{ name: contains }, { code: contains }],
              },
            },
          },
        },
        {
          order: {
            status: {
              is: {
                OR: [{ label: contains }, { code: contains }, { category: contains }],
              },
            },
          },
        },
        {
          order: {
            splitParent: {
              is: {
                OR: [
                  { orderNumber: contains },
                  { title: contains },
                  { buyerReference: contains },
                ],
              },
            },
          },
        },
        {
          order: {
            splitChildren: {
              some: {
                OR: [
                  { orderNumber: contains },
                  { title: contains },
                  { buyerReference: contains },
                ],
              },
            },
          },
        },
        {
          order: {
            wmsTasks: {
              some: wmsTaskTextMatch,
            },
          },
        },
        {
          items: {
            some: {
              OR: [
                { cargoDimensionsText: contains },
                { orderItem: { is: { description: contains } } },
                { containerCargoLines: { some: { notes: contains } } },
              ],
            },
          },
        },
        {
          order: {
            supplier: {
              is: supplierPartyMatch,
            },
          },
        },
        {
          customerCrmAccount: {
            is: {
              OR: [
                { name: contains },
                { legalName: contains },
                { website: contains },
                { industry: contains },
                { segment: contains },
                {
                  owner: {
                    is: {
                      OR: [{ name: contains }, { email: contains }],
                    },
                  },
                },
                {
                  contacts: {
                    some: {
                      OR: [
                        { firstName: contains },
                        { lastName: contains },
                        { email: contains },
                        { phone: contains },
                        { title: contains },
                        { department: contains },
                        { decisionRole: contains },
                        {
                          owner: {
                            is: {
                              OR: [{ name: contains }, { email: contains }],
                            },
                          },
                        },
                      ],
                    },
                  },
                },
                {
                  parent: {
                    is: {
                      OR: [{ name: contains }, { legalName: contains }],
                    },
                  },
                },
                {
                  children: {
                    some: {
                      OR: [{ name: contains }, { legalName: contains }],
                    },
                  },
                },
              ],
            },
          },
        },
        { ctReferences: { some: { OR: [{ refValue: contains }, { refType: contains }] } } },
        {
          ctDocuments: {
            some: {
              OR: [
                { fileName: contains },
                { docType: contains },
                { externalRef: contains },
                { integrationProvider: contains },
                {
                  uploadedBy: {
                    is: {
                      OR: [{ name: contains }, { email: contains }],
                    },
                  },
                },
              ],
            },
          },
        },
        {
          opsAssignee: {
            is: {
              OR: [{ name: contains }, { email: contains }],
            },
          },
        },
        {
          createdBy: {
            is: {
              OR: [{ name: contains }, { email: contains }],
            },
          },
        },
        {
          ctNotes: {
            some: {
              OR: [
                { body: contains },
                {
                  createdBy: {
                    is: {
                      OR: [{ name: contains }, { email: contains }],
                    },
                  },
                },
              ],
            },
          },
        },
        {
          ctAlerts: {
            some: {
              OR: [
                { type: contains },
                { title: contains },
                { body: contains },
                {
                  owner: {
                    is: {
                      OR: [{ name: contains }, { email: contains }],
                    },
                  },
                },
                {
                  acknowledgedBy: {
                    is: {
                      OR: [{ name: contains }, { email: contains }],
                    },
                  },
                },
              ],
            },
          },
        },
        {
          ctExceptions: {
            some: {
              OR: [
                { type: contains },
                { rootCause: contains },
                {
                  owner: {
                    is: {
                      OR: [{ name: contains }, { email: contains }],
                    },
                  },
                },
              ],
            },
          },
        },
        {
          ctTrackingMilestones: {
            some: {
              OR: [
                { code: contains },
                { label: contains },
                { notes: contains },
                { sourceRef: contains },
                { sourceType: contains },
                {
                  updatedBy: {
                    is: {
                      OR: [{ name: contains }, { email: contains }],
                    },
                  },
                },
              ],
            },
          },
        },
        {
          ctLegs: {
            some: {
              OR: [
                { originCode: contains },
                { destinationCode: contains },
                { carrier: contains },
                { notes: contains },
                {
                  carrierSupplier: {
                    is: supplierPartyMatch,
                  },
                },
              ],
            },
          },
        },
        {
          ctCostLines: {
            some: {
              OR: [
                { category: contains },
                { description: contains },
                { vendor: contains },
                { invoiceNo: contains },
                { currency: contains },
                {
                  vendorSupplier: {
                    is: supplierPartyMatch,
                  },
                },
                {
                  createdBy: {
                    is: {
                      OR: [{ name: contains }, { email: contains }],
                    },
                  },
                },
              ],
            },
          },
        },
        {
          ctContainers: {
            some: {
              OR: [
                { containerNumber: contains },
                { seal: contains },
                { containerType: contains },
                { status: contains },
                { notes: contains },
                { cargoLines: { some: { notes: contains } } },
              ],
            },
          },
        },
        {
          ctFinancialSnapshots: {
            some: {
              OR: [
                { currency: contains },
                {
                  createdBy: {
                    is: {
                      OR: [{ name: contains }, { email: contains }],
                    },
                  },
                },
              ],
            },
          },
        },
        {
          wmsTasks: {
            some: wmsTaskTextMatch,
          },
        },
        {
          tariffShipmentApplications: {
            some: {
              OR: [
                { source: contains },
                { polCode: contains },
                { podCode: contains },
                { equipmentType: contains },
                { appliedNotes: contains },
                {
                  createdBy: {
                    is: {
                      OR: [{ name: contains }, { email: contains }],
                    },
                  },
                },
                {
                  contractVersion: {
                    is: {
                      OR: [
                        { sourceReference: contains },
                        { comments: contains },
                        {
                          contractHeader: {
                            is: {
                              OR: [
                                { contractNumber: contains },
                                { title: contains },
                                { tradeScope: contains },
                                { notes: contains },
                                {
                                  provider: {
                                    is: {
                                      OR: [
                                        { legalName: contains },
                                        { tradingName: contains },
                                        { status: contains },
                                        { countryCode: contains },
                                      ],
                                    },
                                  },
                                },
                                {
                                  legalEntity: {
                                    is: {
                                      OR: [
                                        { name: contains },
                                        { code: contains },
                                        { countryCode: contains },
                                        { status: contains },
                                        { baseCurrency: contains },
                                      ],
                                    },
                                  },
                                },
                                {
                                  owner: {
                                    is: {
                                      OR: [{ name: contains }, { email: contains }],
                                    },
                                  },
                                },
                              ],
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
        {
          loadPlanShipment: {
            is: {
              loadPlan: {
                is: {
                  OR: [
                    { reference: contains },
                    { notes: contains },
                    {
                      warehouse: {
                        is: warehouseTextMatch,
                      },
                    },
                    {
                      createdBy: {
                        is: {
                          OR: [{ name: contains }, { email: contains }],
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
        {
          milestones: {
            some: {
              OR: [
                { note: contains },
                {
                  updatedBy: {
                    is: {
                      OR: [{ name: contains }, { email: contains }],
                    },
                  },
                },
              ],
            },
          },
        },
        {
          ctAuditLogs: {
            some: {
              OR: [
                { action: contains },
                { entityType: contains },
                {
                  actor: {
                    is: {
                      OR: [{ name: contains }, { email: contains }],
                    },
                  },
                },
              ],
            },
          },
        },
        ...(milestoneMatch ? [milestoneMatch] : []),
        {
          booking: {
            is: {
              OR: [
                { bookingNo: contains },
                { serviceLevel: contains },
                { notes: contains },
                { originCode: contains },
                { destinationCode: contains },
                {
                  forwarderSupplier: {
                    is: supplierPartyMatch,
                  },
                },
                {
                  createdBy: {
                    is: {
                      OR: [{ name: contains }, { email: contains }],
                    },
                  },
                },
                {
                  updatedBy: {
                    is: {
                      OR: [{ name: contains }, { email: contains }],
                    },
                  },
                },
                {
                  forwarderOffice: {
                    is: {
                      OR: [
                        { name: contains },
                        { addressLine1: contains },
                        { addressLine2: contains },
                        { city: contains },
                        { region: contains },
                        { postalCode: contains },
                        { countryCode: contains },
                      ],
                    },
                  },
                },
                {
                  forwarderContact: {
                    is: {
                      OR: [
                        { name: contains },
                        { title: contains },
                        { role: contains },
                        { email: contains },
                        { phone: contains },
                        { notes: contains },
                      ],
                    },
                  },
                },
                {
                  pricingSnapshots: {
                    some: {
                      OR: [
                        { sourceRecordId: contains },
                        { sourceSummary: contains },
                        { currency: contains },
                        { incoterm: contains },
                        { basisSide: contains },
                        { totalDerivation: contains },
                        {
                          creator: {
                            is: {
                              OR: [{ name: contains }, { email: contains }],
                            },
                          },
                        },
                        {
                          invoiceIntakes: {
                            some: {
                              OR: [
                                { externalInvoiceNo: contains },
                                { vendorLabel: contains },
                                { currency: contains },
                                { polCode: contains },
                                { podCode: contains },
                                { rawSourceNotes: contains },
                                { parseError: contains },
                                { auditRunError: contains },
                                { reviewNote: contains },
                                { accountingApprovalNote: contains },
                                {
                                  reviewer: {
                                    is: {
                                      OR: [{ name: contains }, { email: contains }],
                                    },
                                  },
                                },
                                {
                                  accountingApprover: {
                                    is: {
                                      OR: [{ name: contains }, { email: contains }],
                                    },
                                  },
                                },
                                {
                                  creator: {
                                    is: {
                                      OR: [{ name: contains }, { email: contains }],
                                    },
                                  },
                                },
                                {
                                  lines: {
                                    some: {
                                      OR: [
                                        { rawDescription: contains },
                                        { normalizedLabel: contains },
                                        { currency: contains },
                                        { unitBasis: contains },
                                        { equipmentType: contains },
                                        { chargeStructureHint: contains },
                                        { parseConfidence: contains },
                                        {
                                          auditResult: {
                                            is: {
                                              OR: [
                                                { explanation: contains },
                                                {
                                                  toleranceRule: {
                                                    is: {
                                                      OR: [
                                                        { name: contains },
                                                        { currencyScope: contains },
                                                      ],
                                                    },
                                                  },
                                                },
                                              ],
                                            },
                                          },
                                        },
                                      ],
                                    },
                                  },
                                },
                              ],
                            },
                          },
                        },
                        {
                          invoiceAuditResults: {
                            some: {
                              OR: [
                                { explanation: contains },
                                {
                                  toleranceRule: {
                                    is: {
                                      OR: [
                                        { name: contains },
                                        { currencyScope: contains },
                                      ],
                                    },
                                  },
                                },
                              ],
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    });
  }
  const lane = query.lane?.trim();
  if (lane) {
    ands.push({
      OR: [
        { booking: { is: { originCode: { contains: lane, mode: "insensitive" } } } },
        { booking: { is: { destinationCode: { contains: lane, mode: "insensitive" } } } },
        { ctLegs: { some: { originCode: { contains: lane, mode: "insensitive" } } } },
        { ctLegs: { some: { destinationCode: { contains: lane, mode: "insensitive" } } } },
      ],
    });
  }
  const carrierSupplierId = query.carrierSupplierId?.trim();
  if (carrierSupplierId) {
    ands.push({ carrierSupplierId });
  }
  const supplierId = query.supplierId?.trim();
  if (supplierId) {
    ands.push({
      order: { supplierId },
    });
  }
  const customerCrmAccountId = query.customerCrmAccountId?.trim();
  if (customerCrmAccountId) {
    ands.push({
      customerCrmAccountId,
    });
  }
  const originCode = query.originCode?.trim();
  if (originCode) {
    ands.push({
      OR: [
        { booking: { is: { originCode: { contains: originCode, mode: "insensitive" } } } },
        { ctLegs: { some: { originCode: { contains: originCode, mode: "insensitive" } } } },
      ],
    });
  }
  const destinationCode = query.destinationCode?.trim();
  if (destinationCode) {
    ands.push({
      OR: [
        { booking: { is: { destinationCode: { contains: destinationCode, mode: "insensitive" } } } },
        { ctLegs: { some: { destinationCode: { contains: destinationCode, mode: "insensitive" } } } },
      ],
    });
  }
  if (query.onlyOverdueEta) {
    ands.push({
      status: { notIn: [...TERMINAL_SHIPMENT] },
      OR: [
        { booking: { is: { eta: { lt: now } } } },
        { booking: { is: { latestEta: { lt: now } } } },
      ],
    });
  }
  if (query.shipmentSource === "UNLINKED") {
    ands.push({
      order: {
        supplierId: null,
        title: { startsWith: "Ad-hoc export shipment" },
      },
    });
  } else if (query.shipmentSource === "PO") {
    ands.push({
      NOT: {
        order: {
          supplierId: null,
          title: { startsWith: "Ad-hoc export shipment" },
        },
      },
    });
  }

  const ownerId = query.dispatchOwnerUserId?.trim();
  if (ownerId && !ctx.isRestrictedView) {
    ands.push({
      OR: [
        {
          ctAlerts: {
            some: {
              status: { in: ["OPEN", "ACKNOWLEDGED"] },
              ownerUserId: ownerId,
            },
          },
        },
        {
          ctExceptions: {
            some: {
              status: { in: ["OPEN", "IN_PROGRESS"] },
              ownerUserId: ownerId,
            },
          },
        },
      ],
    });
  }

  const exceptionCode = parseControlTowerTokenFilter(query.exceptionCode);
  if (exceptionCode) {
    ands.push({
      ctExceptions: {
        some: {
          status: { in: ["OPEN", "IN_PROGRESS"] },
          type: { equals: exceptionCode, mode: "insensitive" },
        },
      },
    });
  }

  const alertType = parseControlTowerTokenFilter(query.alertType);
  if (alertType) {
    ands.push({
      ctAlerts: {
        some: {
          status: { in: ["OPEN", "ACKNOWLEDGED"] },
          type: { equals: alertType, mode: "insensitive" },
        },
      },
    });
  }

  if (ands.length) {
    where.AND = ands;
  }

  const orderBy = { updatedAt: "desc" as const };

  const postFilter = (
    rows: Array<ReturnType<typeof mapShipmentListRow>>,
  ): Array<ReturnType<typeof mapShipmentListRow>> => {
    let out = rows;
    if (routePrefix) {
      out = out.filter((r) => (r.nextAction ?? "").startsWith(routePrefix));
    }
    if (typeof query.minRouteProgressPct === "number") {
      out = out.filter((r) => (r.routeProgressPct ?? -1) >= query.minRouteProgressPct!);
    }
    if (typeof query.maxRouteProgressPct === "number") {
      out = out.filter((r) => (r.routeProgressPct ?? 101) <= query.maxRouteProgressPct!);
    }
    return out.slice(0, requestedTake);
  };

  if (ctx.isRestrictedView) {
    const rows = await prisma.shipment.findMany({
      where,
      take: dbTake,
      orderBy,
      select: listSelectCore,
    });
    const mapped = postFilter(rows.map(mapShipmentListRow));
    return {
      rows: mapped,
      listLimit: requestedTake,
      truncated: mapped.length >= requestedTake,
    };
  }

  const rows = await prisma.shipment.findMany({
    where,
    take: dbTake,
    orderBy,
    select: listSelectInternal,
  });

  await ensureBookingConfirmationSlaAlerts({
    tenantId,
    shipmentIds: rows.map((r) => r.id),
  });

  const mapped = postFilter(rows.map(mapShipmentListRow));
  return {
    rows: mapped,
    listLimit: requestedTake,
    truncated: mapped.length >= requestedTake,
  };
}
