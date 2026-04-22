import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const shipmentFindMany = vi.hoisted(() => vi.fn());
const ensureBookingConfirmationSlaAlerts = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shipment: { findMany: shipmentFindMany },
  },
}));

vi.mock("./booking-sla", () => ({
  ensureBookingConfirmationSlaAlerts,
}));

import { listControlTowerShipments } from "./list-shipments";

const ctxInternal = {
  isRestrictedView: false,
  isSupplierPortal: false,
  customerCrmAccountId: null as string | null,
};

const ctxRestricted = {
  isRestrictedView: true,
  isSupplierPortal: false,
  customerCrmAccountId: "crm-1" as string | null,
};

function draftLeg(legNo: number) {
  return {
    legNo,
    originCode: "AAA",
    destinationCode: "BBB",
    transportMode: "OCEAN" as const,
    plannedEtd: null as Date | null,
    plannedEta: null as Date | null,
    actualAtd: null as Date | null,
    actualAta: null as Date | null,
  };
}

/** Minimal `listSelectInternal` payload for mapping tests. */
function internalListRow(
  pick: {
    id?: string;
    booking?: {
      status: "DRAFT" | "SENT" | "CONFIRMED" | null;
      bookingConfirmSlaDueAt?: Date | null;
    } | null;
    ctLegs?: ReturnType<typeof draftLeg>[];
  } = {},
) {
  const id = pick.id ?? "sh1";
  const ctLegs = pick.ctLegs ?? [draftLeg(1)];
  const booking =
    pick.booking === undefined
      ? null
      : pick.booking && {
          status: pick.booking.status,
          mode: "OCEAN" as const,
          originCode: "CNSHA",
          destinationCode: "USLAX",
          etd: null as Date | null,
          eta: null as Date | null,
          latestEta: null as Date | null,
          bookingSentAt: null as Date | null,
          bookingConfirmSlaDueAt: pick.booking.bookingConfirmSlaDueAt ?? null,
        };
  return {
    id,
    shipmentNo: "SN-1",
    status: "IN_TRANSIT" as const,
    transportMode: "OCEAN" as const,
    trackingNo: null,
    carrier: null,
    carrierSupplierId: null,
    shippedAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    receivedAt: null,
    expectedReceiveAt: null,
    estimatedVolumeCbm: null,
    estimatedWeightKg: null,
    customerCrmAccountId: null,
    customerCrmAccount: null,
    order: {
      id: "o1",
      orderNumber: "PO-1",
      title: "PO order",
      buyerReference: null,
      supplierId: "sup1",
      supplier: { id: "sup1", name: "Acme Supply" },
    },
    items: [{ quantityShipped: new Prisma.Decimal(10) }],
    ctReferences: [],
    booking,
    milestones: [],
    ctLegs,
    _count: { ctAlerts: 0, ctExceptions: 0 },
    ctAlerts: [],
    ctExceptions: [],
    ctTrackingMilestones: [],
  };
}

/** `listSelectCore` payload (customer / supplier portal lists). */
function coreListRow(pick: Parameters<typeof internalListRow>[0] = {}) {
  const r = internalListRow(pick);
  return {
    id: r.id,
    shipmentNo: r.shipmentNo,
    status: r.status,
    transportMode: r.transportMode,
    trackingNo: r.trackingNo,
    carrier: r.carrier,
    carrierSupplierId: r.carrierSupplierId,
    shippedAt: r.shippedAt,
    updatedAt: r.updatedAt,
    receivedAt: r.receivedAt,
    expectedReceiveAt: r.expectedReceiveAt,
    estimatedVolumeCbm: r.estimatedVolumeCbm,
    estimatedWeightKg: r.estimatedWeightKg,
    customerCrmAccountId: r.customerCrmAccountId,
    customerCrmAccount: r.customerCrmAccount,
    order: r.order,
    items: r.items,
    ctReferences: r.ctReferences,
    booking: r.booking,
    milestones: r.milestones,
    ctLegs: r.ctLegs,
  };
}

describe("listControlTowerShipments", () => {
  beforeEach(() => {
    shipmentFindMany.mockReset();
    ensureBookingConfirmationSlaAlerts.mockReset();
    shipmentFindMany.mockResolvedValue([]);
    ensureBookingConfirmationSlaAlerts.mockResolvedValue(undefined);
  });

  it("uses default take 80 and runs booking SLA sweep for internal lists", async () => {
    const out = await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: {},
    });
    expect(out.rows).toEqual([]);
    expect(out.listLimit).toBe(80);
    expect(out.truncated).toBe(false);
    expect(shipmentFindMany.mock.calls[0]![0]).toMatchObject({
      take: 80,
      orderBy: { updatedAt: "desc" },
    });
    expect(ensureBookingConfirmationSlaAlerts).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      shipmentIds: [],
    });
  });

  it("clamps take to 200", async () => {
    const out = await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { take: 999 },
    });
    expect(out.listLimit).toBe(200);
    expect(shipmentFindMany.mock.calls[0]![0].take).toBe(200);
  });

  it("text q filter includes PO title, buyer ref, lines, and product sku/code", async () => {
    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "DEMO-SKU-1" },
    });
    const where = shipmentFindMany.mock.calls[0]![0].where as Prisma.ShipmentWhereInput;
    const dumped = JSON.stringify(where);
    expect(dumped).toContain("DEMO-SKU-1");
    expect(dumped).toContain("buyerReference");
    expect(dumped).toContain("supplierReference");
    expect(dumped).toContain("internalNotes");
    expect(dumped).toContain("shipToName");
    expect(dumped).toContain("requester");
    expect(dumped).toContain("carrierSupplier");
    expect(dumped).toContain("legalName");
    expect(dumped).toContain("items");
    expect(dumped).toContain("productCode");
    expect(dumped).toContain("sku");
    expect(dumped).toContain("ean");
    expect(dumped).toContain("customerName");
    expect(dumped).toContain("hsCode");
    expect(dumped).toContain("category");
    expect(dumped).toContain("division");
    expect(dumped).toContain("temperatureRangeText");
    expect(dumped).toContain("website");
    expect(dumped).toContain("acknowledgedBy");
    expect(dumped).toContain("updatedBy");
    expect(dumped).toContain("splitProposal");
    expect(dumped).toContain("sourceLine");
    expect(dumped).toContain("lineType");
    expect(dumped).toContain("originLabel");
    expect(dumped).toContain("reviewNotes");
    expect(dumped).toContain("displayName");
    expect(dumped).toContain("supplierOffice");
    expect(dumped).toContain("productSuppliers");
    expect(dumped).toContain("outboundOrderLines");
    expect(dumped).toContain("replenishmentRules");
    expect(dumped).toContain("serviceCapabilities");
    expect(dumped).toContain("offices");
    expect(dumped).toContain("vendorSupplier");
    expect(dumped).toContain("cargoLines");
    expect(dumped).toContain("wmsTasks");
    expect(dumped).toContain("tariffShipmentApplications");
    expect(dumped).toContain("contractHeader");
    expect(dumped).toContain("chats");
    expect(dumped).toContain("author");
    expect(dumped).toContain("transitions");
    expect(dumped).toContain("actionCode");
    expect(dumped).toContain("fromStatus");
    expect(dumped).toContain("toStatus");
    expect(dumped).toContain("workflow");
    expect(dumped).toContain("actions");
    expect(dumped).toContain("splitParent");
    expect(dumped).toContain("splitChildren");
    expect(dumped).toContain("waveNo");
    expect(dumped).toContain("rackCode");
    expect(dumped).toContain('"zone"');
    expect(dumped).toContain("ctFinancialSnapshots");
    expect(dumped).toContain("decisionRole");
    expect(dumped).toContain("containerCargoLines");
    expect(dumped).toContain("tradingName");
    expect(dumped).toContain("legalEntity");
    expect(dumped).toContain("loadPlan");
    expect(dumped).toContain("pricingSnapshots");
    expect(dumped).toContain("sourceSummary");
    expect(dumped).toContain("splitProposalsAsParent");
    expect(dumped).toContain("registeredCity");
    expect(dumped).toContain("forwarderOffice");
    expect(dumped).toContain("forwarderContact");
    expect(dumped).toContain("taxId");
    expect(dumped).toContain("defaultIncoterm");
    expect(dumped).toContain("baseCurrency");
    expect(dumped).toContain("cargoCommoditySummary");
    expect(dumped).toContain("cargoDimensionsText");
    expect(dumped).toContain("soNumber");
    expect(dumped).toContain("invoiceIntakes");
    expect(dumped).toContain("externalInvoiceNo");
    expect(dumped).toContain("rawDescription");
    expect(dumped).toContain("invoiceAuditResults");
    expect(dumped).toContain("toleranceRule");
    expect(dumped).toContain("currencyScope");
    expect(dumped).toContain('"parent":{"is"');
    expect(dumped).toContain('"children":{"some"');
    expect(dumped).toContain("externalRef");
    expect(dumped).toContain("orderItem");
    expect(dumped).toContain("refType");
    expect(dumped).toContain("sourceType");
    expect(dumped).toContain("milestones");
    expect(dumped).toContain("ctAuditLogs");
    expect(dumped).toContain("entityType");
    expect(dumped).toContain("ctNotes");
    expect(dumped).toContain("ctAlerts");
    expect(dumped).toMatch(/"owner"/);
    expect(dumped).toContain("ctExceptions");
    expect(dumped).toContain("ctTrackingMilestones");
    expect(dumped).toContain("ctLegs");
    expect(dumped).toContain("ctCostLines");
    expect(dumped).toContain("invoiceNo");
    expect(dumped).toContain("ctDocuments");
    expect(dumped).toContain("fileName");
    expect(dumped).toContain("uploadedBy");
    expect(dumped).toContain("opsAssignee");
    expect(dumped).toContain("createdBy");
  });

  it("text q matches exact enum tokens for status, transport mode, booking, and audit outcome", async () => {
    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "IN_TRANSIT" },
    });
    let where = shipmentFindMany.mock.calls[0]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("IN_TRANSIT");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "OCEAN" },
    });
    where = shipmentFindMany.mock.calls[1]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("OCEAN");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "CONFIRMED" },
    });
    where = shipmentFindMany.mock.calls[2]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("CONFIRMED");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "GREEN" },
    });
    where = shipmentFindMany.mock.calls[3]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("GREEN");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "PARSED" },
    });
    where = shipmentFindMany.mock.calls[4]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("PARSED");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "PICK" },
    });
    where = shipmentFindMany.mock.calls[5]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("PICK");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "FCL_40HC" },
    });
    where = shipmentFindMany.mock.calls[6]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("FCL_40HC");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "INTEGRATION" },
    });
    where = shipmentFindMany.mock.calls[7]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("INTEGRATION");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "SHARED" },
    });
    where = shipmentFindMany.mock.calls[8]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("SHARED");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "SUPPLIER" },
    });
    where = shipmentFindMany.mock.calls[9]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("SUPPLIER");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "logistics" },
    });
    where = shipmentFindMany.mock.calls[10]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("logistics");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "TARIFF_CONTRACT_VERSION" },
    });
    where = shipmentFindMany.mock.calls[11]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("TARIFF_CONTRACT_VERSION");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "PALLET" },
    });
    where = shipmentFindMany.mock.calls[12]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("PALLET");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "UNDER_REVIEW" },
    });
    where = shipmentFindMany.mock.calls[13]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("UNDER_REVIEW");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "WAREHOUSE" },
    });
    where = shipmentFindMany.mock.calls[14]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("WAREHOUSE");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "ACCEPTED" },
    });
    where = shipmentFindMany.mock.calls[15]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("ACCEPTED");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "NVOCC" },
    });
    where = shipmentFindMany.mock.calls[16]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("NVOCC");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "PROSPECT" },
    });
    where = shipmentFindMany.mock.calls[17]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("PROSPECT");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "DEMURRAGE" },
    });
    where = shipmentFindMany.mock.calls[18]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("DEMURRAGE");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "BASE_RATE" },
    });
    where = shipmentFindMany.mock.calls[19]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("BASE_RATE");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "MAIN_CARRIAGE" },
    });
    where = shipmentFindMany.mock.calls[20]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("MAIN_CARRIAGE");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "MSDS" },
    });
    where = shipmentFindMany.mock.calls[21]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("MSDS");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "PORT" },
    });
    where = shipmentFindMany.mock.calls[22]![0].where as Prisma.ShipmentWhereInput;
    const portDumped = JSON.stringify(where);
    expect(portDumped).toContain("PORT");
    expect(portDumped).toContain("memberType");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "NEGOTIATION" },
    });
    where = shipmentFindMany.mock.calls[23]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("NEGOTIATION");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "MEETING" },
    });
    where = shipmentFindMany.mock.calls[24]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("MEETING");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "EXPIRED" },
    });
    where = shipmentFindMany.mock.calls[25]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("EXPIRED");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "PACKED" },
    });
    where = shipmentFindMany.mock.calls[26]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("PACKED");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "RECEIPT" },
    });
    where = shipmentFindMany.mock.calls[27]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("RECEIPT");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "CRM_ACCOUNT" },
    });
    where = shipmentFindMany.mock.calls[28]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("CRM_ACCOUNT");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "POSTED" },
    });
    where = shipmentFindMany.mock.calls[29]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("POSTED");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "AWARDED" },
    });
    where = shipmentFindMany.mock.calls[30]![0].where as Prisma.ShipmentWhereInput;
    const awardedDumped = JSON.stringify(where);
    expect(awardedDumped).toContain("AWARDED");
    expect(awardedDumped).toContain("quoteRequestRecipients");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "INVITED" },
    });
    where = shipmentFindMany.mock.calls[31]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("INVITED");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "SUBMITTED" },
    });
    where = shipmentFindMany.mock.calls[32]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("SUBMITTED");

    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "RECIPIENTS" },
    });
    where = shipmentFindMany.mock.calls[33]![0].where as Prisma.ShipmentWhereInput;
    expect(JSON.stringify(where)).toContain("RECIPIENTS");
  });

  it("q enum token WARN matches severity on both ctAlerts and ctExceptions", async () => {
    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { q: "WARN" },
    });
    const dumped = JSON.stringify(shipmentFindMany.mock.calls[0]![0].where);
    expect(dumped).toContain("WARN");
    expect(dumped).toContain("ctAlerts");
    expect(dumped).toContain("ctExceptions");
  });

  it("overscans DB when routeActionPrefix is set", async () => {
    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { routeActionPrefix: "Plan leg", take: 10 },
    });
    expect(shipmentFindMany.mock.calls[0]![0].take).toBe(120);
  });

  it("does not call booking SLA sweep in restricted portal lists", async () => {
    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxRestricted,
      query: { take: 25 },
    });
    expect(ensureBookingConfirmationSlaAlerts).not.toHaveBeenCalled();
    expect(shipmentFindMany.mock.calls[0]![0].take).toBe(25);
  });

  it("uses core select for restricted lists and omits internal queue fields", async () => {
    shipmentFindMany.mockResolvedValueOnce([
      coreListRow({ booking: { status: "CONFIRMED" }, ctLegs: [draftLeg(1)] }),
    ]);
    const out = await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxRestricted,
      query: {},
    });
    const sel = shipmentFindMany.mock.calls[0]![0].select as Record<string, unknown>;
    expect(sel._count).toBeUndefined();
    expect(sel.ctAlerts).toBeUndefined();
    expect(out.rows[0]!.openQueueCounts).toEqual({ openAlerts: 0, openExceptions: 0 });
    expect(out.rows[0]!.trackingMilestoneSummary).toBeNull();
    expect(out.rows[0]!.dispatchOwner).toBeNull();
  });

  it("marks ad-hoc export shells as UNLINKED shipment source", async () => {
    const row = internalListRow({
      booking: { status: "CONFIRMED" },
      ctLegs: [draftLeg(1)],
    });
    row.order = {
      ...row.order,
      title: "Ad-hoc export shipment — demo",
      supplier: { id: "sup1", name: "" },
    };
    shipmentFindMany.mockResolvedValueOnce([row]);
    const out = await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: {},
    });
    expect(out.rows[0]!.shipmentSource).toBe("UNLINKED");
  });

  it("maps booking DRAFT nextAction ahead of route planning", async () => {
    shipmentFindMany.mockResolvedValueOnce([
      internalListRow({
        booking: { status: "DRAFT" },
        ctLegs: [draftLeg(1), draftLeg(2)],
      }),
    ]);
    const out = await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: {},
    });
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]!.nextAction).toBe("Send booking to forwarder");
    expect(out.rows[0]!.bookingStatus).toBe("DRAFT");
    expect(out.rows[0]!.routeProgressPct).toBe(0);
  });

  it("maps route Plan leg when booking is not in draft/sent pipeline", async () => {
    shipmentFindMany.mockResolvedValueOnce([
      internalListRow({
        booking: { status: "CONFIRMED" },
        ctLegs: [draftLeg(1)],
      }),
    ]);
    const out = await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: {},
    });
    expect(out.rows[0]!.nextAction).toBe("Plan leg 1");
    expect(out.rows[0]!.bookingSlaBreached).toBe(false);
  });

  it("post-filters by routeActionPrefix after mapping", async () => {
    shipmentFindMany.mockResolvedValueOnce([
      internalListRow({ id: "a", booking: { status: "CONFIRMED" }, ctLegs: [draftLeg(1)] }),
      internalListRow({
        id: "b",
        booking: null,
        ctLegs: [
          {
            legNo: 1,
            originCode: "X",
            destinationCode: "Y",
            transportMode: "OCEAN",
            plannedEtd: new Date("2026-02-01T00:00:00.000Z"),
            plannedEta: null,
            actualAtd: null,
            actualAta: null,
          },
        ],
      }),
    ]);
    const out = await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { routeActionPrefix: "Plan leg", take: 5 },
    });
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]!.id).toBe("a");
    expect(out.rows[0]!.nextAction?.startsWith("Plan leg")).toBe(true);
  });
});

describe("listControlTowerShipments booking SLA flag", () => {
  beforeEach(() => {
    shipmentFindMany.mockReset();
    ensureBookingConfirmationSlaAlerts.mockReset();
    shipmentFindMany.mockResolvedValue([]);
    ensureBookingConfirmationSlaAlerts.mockResolvedValue(undefined);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("surfaces escalate action and breached flag when confirmation SLA is past due", async () => {
    shipmentFindMany.mockResolvedValueOnce([
      internalListRow({
        booking: {
          status: "SENT",
          bookingConfirmSlaDueAt: new Date("2026-06-01T00:00:00.000Z"),
        },
        ctLegs: [draftLeg(1)],
      }),
    ]);
    const out = await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: {},
    });
    expect(out.rows[0]!.nextAction).toBe("Escalate booking SLA");
    expect(out.rows[0]!.bookingSlaBreached).toBe(true);
  });
});
