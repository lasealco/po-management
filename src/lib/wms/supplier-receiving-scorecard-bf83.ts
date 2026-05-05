/**
 * BF-83 — supplier / carrier / CRM-customer receiving scorecard rollup for SRM-style CSV export.
 * See docs/wms/WMS_SUPPLIER_RECEIVING_SCORECARD_BF83.md.
 */
import { Prisma, type PrismaClient, type WmsShipmentItemVarianceDisposition } from "@prisma/client";

import type { WmsViewReadScope } from "@/lib/wms/wms-read-scope";

export const BF83_SCHEMA_VERSION = "bf83.v1" as const;

export type Bf83GroupBy = "supplier" | "carrier" | "customer";

export type ParsedBf83ScorecardQuery = {
  since: Date;
  until: Date;
  groupBy: Bf83GroupBy;
};

export type ParseBf83ScorecardQueryResult =
  | { ok: true; query: ParsedBf83ScorecardQuery }
  | { ok: false; error: string };

const GROUP_BY_VALUES: Bf83GroupBy[] = ["supplier", "carrier", "customer"];

const MAX_WINDOW_MS = 366 * 86400 * 1000;

export function parseBf83ScorecardQuery(url: URLSearchParams): ParseBf83ScorecardQueryResult {
  const sinceRaw = url.get("since")?.trim();
  const untilRaw = url.get("until")?.trim();
  const until = untilRaw ? new Date(untilRaw) : new Date();
  const since = sinceRaw ? new Date(sinceRaw) : new Date(until.getTime() - 90 * 86400000 * 1000);
  if (Number.isNaN(since.getTime()) || Number.isNaN(until.getTime())) {
    return { ok: false, error: "Invalid since or until (ISO-8601 expected)." };
  }
  if (until.getTime() < since.getTime()) {
    return { ok: false, error: "until must be on or after since." };
  }
  if (until.getTime() - since.getTime() > MAX_WINDOW_MS) {
    return { ok: false, error: "Receipt window cannot exceed 366 days." };
  }
  const rawGb = url.get("groupBy")?.trim().toLowerCase() ?? "supplier";
  const groupBy = (GROUP_BY_VALUES as string[]).includes(rawGb) ? (rawGb as Bf83GroupBy) : null;
  if (!groupBy) {
    return { ok: false, error: `groupBy must be one of: ${GROUP_BY_VALUES.join(", ")}.` };
  }
  return { ok: true, query: { since, until, groupBy } };
}

function csvEscapeCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export type Bf83ShipmentFact = {
  shipmentId: string;
  receivedAt: Date;
  expectedReceiveAt: Date | null;
  groupBy: Bf83GroupBy;
  groupId: string;
  groupName: string;
  lines: Array<{
    quantityShipped: Prisma.Decimal;
    quantityReceived: Prisma.Decimal;
    disposition: WmsShipmentItemVarianceDisposition;
  }>;
};

export function resolveBf83Group(
  groupBy: Bf83GroupBy,
  row: {
    poSupplierId: string | null;
    poSupplierCode: string | null;
    poSupplierName: string | null;
    carrierSupplierId: string | null;
    carrierSupplierCode: string | null;
    carrierSupplierName: string | null;
    carrierFreeText: string | null;
    customerCrmAccountId: string | null;
    customerCrmName: string | null;
  },
): { groupId: string; groupName: string } {
  if (groupBy === "supplier") {
    const id = row.poSupplierId ?? "__UNKNOWN_SUPPLIER__";
    const name =
      row.poSupplierName?.trim() ||
      row.poSupplierCode?.trim() ||
      (row.poSupplierId ? `Supplier ${row.poSupplierId.slice(0, 8)}…` : "Unknown supplier (no PO supplier)");
    return { groupId: id, groupName: name };
  }
  if (groupBy === "carrier") {
    if (row.carrierSupplierId) {
      const name =
        row.carrierSupplierName?.trim() ||
        row.carrierSupplierCode?.trim() ||
        `Carrier supplier ${row.carrierSupplierId.slice(0, 8)}…`;
      return { groupId: row.carrierSupplierId, groupName: name };
    }
    const ft = row.carrierFreeText?.trim();
    if (ft) return { groupId: `freetext:${ft}`, groupName: ft };
    return { groupId: "__UNKNOWN_CARRIER__", groupName: "Unknown carrier" };
  }
  const id = row.customerCrmAccountId ?? "__UNKNOWN_CUSTOMER__";
  const name =
    row.customerCrmName?.trim() ||
    (row.customerCrmAccountId ? `CRM ${row.customerCrmAccountId.slice(0, 8)}…` : "Unknown CRM account");
  return { groupId: id, groupName: name };
}

function lineQtyShort(shipped: Prisma.Decimal, received: Prisma.Decimal): boolean {
  return received.lessThan(shipped);
}

function shipmentInFull(lines: Bf83ShipmentFact["lines"]): boolean {
  for (const ln of lines) {
    if (ln.disposition === "SHORT" || ln.disposition === "DAMAGED") return false;
    if (lineQtyShort(ln.quantityShipped, ln.quantityReceived)) return false;
  }
  return lines.length > 0;
}

function shipmentOnTime(receivedAt: Date, expectedReceiveAt: Date | null): boolean {
  if (!expectedReceiveAt) return false;
  return receivedAt.getTime() <= expectedReceiveAt.getTime();
}

function shipmentOtif(fact: Bf83ShipmentFact): boolean {
  if (!fact.expectedReceiveAt) return false;
  return shipmentOnTime(fact.receivedAt, fact.expectedReceiveAt) && shipmentInFull(fact.lines);
}

export type Bf83ScorecardAggRow = {
  groupBy: Bf83GroupBy;
  groupId: string;
  groupName: string;
  shipmentsReceived: number;
  shipmentsWithExpectedArrival: number;
  shipmentsOnTime: number;
  shipmentsOtif: number;
  linesTotal: number;
  linesShortDisposition: number;
  linesDamagedDisposition: number;
  linesOverDisposition: number;
  linesOtherVarianceDisposition: number;
  linesUnsetVarianceDisposition: number;
  linesMatchDisposition: number;
  sumQtyShipped: Prisma.Decimal;
  sumQtyReceived: Prisma.Decimal;
};

export function aggregateBf83Scorecard(facts: Bf83ShipmentFact[]): Bf83ScorecardAggRow[] {
  const map = new Map<string, Bf83ScorecardAggRow>();

  for (const fact of facts) {
    const key = `${fact.groupBy}:${fact.groupId}`;
    let agg = map.get(key);
    if (!agg) {
      agg = {
        groupBy: fact.groupBy,
        groupId: fact.groupId,
        groupName: fact.groupName,
        shipmentsReceived: 0,
        shipmentsWithExpectedArrival: 0,
        shipmentsOnTime: 0,
        shipmentsOtif: 0,
        linesTotal: 0,
        linesShortDisposition: 0,
        linesDamagedDisposition: 0,
        linesOverDisposition: 0,
        linesOtherVarianceDisposition: 0,
        linesUnsetVarianceDisposition: 0,
        linesMatchDisposition: 0,
        sumQtyShipped: new Prisma.Decimal(0),
        sumQtyReceived: new Prisma.Decimal(0),
      };
      map.set(key, agg);
    }

    agg.shipmentsReceived += 1;
    if (fact.expectedReceiveAt) {
      agg.shipmentsWithExpectedArrival += 1;
      if (shipmentOnTime(fact.receivedAt, fact.expectedReceiveAt)) agg.shipmentsOnTime += 1;
    }
    if (shipmentOtif(fact)) agg.shipmentsOtif += 1;

    for (const ln of fact.lines) {
      agg.linesTotal += 1;
      agg.sumQtyShipped = agg.sumQtyShipped.add(ln.quantityShipped);
      agg.sumQtyReceived = agg.sumQtyReceived.add(ln.quantityReceived);
      switch (ln.disposition) {
        case "SHORT":
          agg.linesShortDisposition += 1;
          break;
        case "DAMAGED":
          agg.linesDamagedDisposition += 1;
          break;
        case "OVER":
          agg.linesOverDisposition += 1;
          break;
        case "MATCH":
          agg.linesMatchDisposition += 1;
          break;
        case "OTHER":
          agg.linesOtherVarianceDisposition += 1;
          break;
        default:
          agg.linesUnsetVarianceDisposition += 1;
      }
    }
  }

  return [...map.values()].sort((a, b) => a.groupName.localeCompare(b.groupName));
}

function pct(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((10000 * num) / den) / 100;
}

export type Bf83ScorecardDoc = {
  schemaVersion: typeof BF83_SCHEMA_VERSION;
  exportedAt: string;
  groupBy: Bf83GroupBy;
  window: { since: string; until: string };
  shipmentFactsConsidered: number;
  rows: Array<
    Bf83ScorecardAggRow & {
      pctOnTime: number | null;
      pctOtif: number | null;
      fillRatePct: number | null;
    }
  >;
};

export function bf83ScorecardDocFromAggs(
  groupBy: Bf83GroupBy,
  since: Date,
  until: Date,
  facts: Bf83ShipmentFact[],
  aggs: Bf83ScorecardAggRow[],
): Bf83ScorecardDoc {
  const rows = aggs.map((r) => {
    const shipped = r.sumQtyShipped;
    const received = r.sumQtyReceived;
    const fillRatePct =
      shipped.gt(0) && received.gte(0)
        ? Math.round(received.div(shipped).mul(10000).toNumber()) / 100
        : null;
    return {
      ...r,
      pctOnTime: pct(r.shipmentsOnTime, r.shipmentsWithExpectedArrival),
      pctOtif: pct(r.shipmentsOtif, r.shipmentsWithExpectedArrival),
      fillRatePct,
    };
  });

  return {
    schemaVersion: BF83_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    groupBy,
    window: { since: since.toISOString(), until: until.toISOString() },
    shipmentFactsConsidered: facts.length,
    rows,
  };
}

/** JSON serialization replaces Decimal with strings for stable API output. */
export function bf83ScorecardDocToJson(doc: Bf83ScorecardDoc): Record<string, unknown> {
  return {
    schemaVersion: doc.schemaVersion,
    exportedAt: doc.exportedAt,
    groupBy: doc.groupBy,
    window: doc.window,
    shipmentFactsConsidered: doc.shipmentFactsConsidered,
    rows: doc.rows.map((r) => ({
      groupBy: r.groupBy,
      groupId: r.groupId,
      groupName: r.groupName,
      shipmentsReceived: r.shipmentsReceived,
      shipmentsWithExpectedArrival: r.shipmentsWithExpectedArrival,
      shipmentsOnTime: r.shipmentsOnTime,
      pctOnTime: r.pctOnTime,
      shipmentsOtif: r.shipmentsOtif,
      pctOtif: r.pctOtif,
      linesTotal: r.linesTotal,
      linesShortDisposition: r.linesShortDisposition,
      linesDamagedDisposition: r.linesDamagedDisposition,
      linesOverDisposition: r.linesOverDisposition,
      linesOtherVarianceDisposition: r.linesOtherVarianceDisposition,
      linesUnsetVarianceDisposition: r.linesUnsetVarianceDisposition,
      linesMatchDisposition: r.linesMatchDisposition,
      sumQtyShipped: r.sumQtyShipped.toString(),
      sumQtyReceived: r.sumQtyReceived.toString(),
      fillRatePct: r.fillRatePct,
    })),
  };
}

export function bf83ScorecardToCsv(doc: Bf83ScorecardDoc): string {
  const header = [
    "schemaVersion",
    "groupBy",
    "groupId",
    "groupName",
    "shipmentsReceived",
    "shipmentsWithExpectedArrival",
    "shipmentsOnTime",
    "pctOnTime",
    "shipmentsOtif",
    "pctOtif",
    "linesTotal",
    "linesShortDisposition",
    "linesDamagedDisposition",
    "linesOverDisposition",
    "linesOtherVarianceDisposition",
    "linesUnsetVarianceDisposition",
    "linesMatchDisposition",
    "sumQtyShipped",
    "sumQtyReceived",
    "fillRatePct",
    "windowSince",
    "windowUntil",
    "exportedAt",
  ];
  const lines = [header.join(",")];
  for (const r of doc.rows) {
    lines.push(
      [
        csvEscapeCell(doc.schemaVersion),
        csvEscapeCell(r.groupBy),
        csvEscapeCell(r.groupId),
        csvEscapeCell(r.groupName),
        String(r.shipmentsReceived),
        String(r.shipmentsWithExpectedArrival),
        String(r.shipmentsOnTime),
        r.pctOnTime == null ? "" : String(r.pctOnTime),
        String(r.shipmentsOtif),
        r.pctOtif == null ? "" : String(r.pctOtif),
        String(r.linesTotal),
        String(r.linesShortDisposition),
        String(r.linesDamagedDisposition),
        String(r.linesOverDisposition),
        String(r.linesOtherVarianceDisposition),
        String(r.linesUnsetVarianceDisposition),
        String(r.linesMatchDisposition),
        csvEscapeCell(r.sumQtyShipped.toString()),
        csvEscapeCell(r.sumQtyReceived.toString()),
        r.fillRatePct == null ? "" : String(r.fillRatePct),
        csvEscapeCell(doc.window.since),
        csvEscapeCell(doc.window.until),
        csvEscapeCell(doc.exportedAt),
      ].join(","),
    );
  }
  return lines.join("\n") + "\n";
}

export async function loadSupplierReceivingScorecardBf83(
  prisma: PrismaClient,
  _tenantId: string,
  viewScope: WmsViewReadScope,
  q: ParsedBf83ScorecardQuery,
): Promise<Bf83ScorecardDoc> {
  const where: Prisma.ShipmentWhereInput = {
    AND: [
      viewScope.shipment,
      { receivedAt: { not: null } },
      { receivedAt: { gte: q.since, lte: q.until } },
      { wmsInboundSubtype: "STANDARD" },
    ],
  };

  const shipments = await prisma.shipment.findMany({
    where,
    select: {
      id: true,
      receivedAt: true,
      expectedReceiveAt: true,
      carrier: true,
      carrierSupplierId: true,
      carrierSupplier: { select: { id: true, name: true, code: true } },
      customerCrmAccountId: true,
      customerCrmAccount: { select: { id: true, name: true } },
      order: {
        select: {
          supplierId: true,
          supplier: { select: { id: true, name: true, code: true } },
        },
      },
      items: {
        select: {
          quantityShipped: true,
          quantityReceived: true,
          wmsVarianceDisposition: true,
        },
      },
    },
  });

  const facts: Bf83ShipmentFact[] = [];
  for (const s of shipments) {
    if (!s.receivedAt) continue;
    const { groupId, groupName } = resolveBf83Group(q.groupBy, {
      poSupplierId: s.order.supplierId,
      poSupplierCode: s.order.supplier?.code ?? null,
      poSupplierName: s.order.supplier?.name ?? null,
      carrierSupplierId: s.carrierSupplierId,
      carrierSupplierCode: s.carrierSupplier?.code ?? null,
      carrierSupplierName: s.carrierSupplier?.name ?? null,
      carrierFreeText: s.carrier,
      customerCrmAccountId: s.customerCrmAccountId,
      customerCrmName: s.customerCrmAccount?.name ?? null,
    });
    facts.push({
      shipmentId: s.id,
      receivedAt: s.receivedAt,
      expectedReceiveAt: s.expectedReceiveAt,
      groupBy: q.groupBy,
      groupId,
      groupName,
      lines: s.items.map((it) => ({
        quantityShipped: it.quantityShipped,
        quantityReceived: it.quantityReceived,
        disposition: it.wmsVarianceDisposition,
      })),
    });
  }

  const aggs = aggregateBf83Scorecard(facts);
  return bf83ScorecardDocFromAggs(q.groupBy, q.since, q.until, facts, aggs);
}
