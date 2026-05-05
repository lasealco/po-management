import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  aggregateBf83Scorecard,
  bf83ScorecardDocFromAggs,
  bf83ScorecardToCsv,
  parseBf83ScorecardQuery,
  resolveBf83Group,
  type Bf83ShipmentFact,
} from "@/lib/wms/supplier-receiving-scorecard-bf83";

describe("supplier-receiving-scorecard-bf83", () => {
  it("parses groupBy and window bounds", () => {
    const ok = parseBf83ScorecardQuery(
      new URLSearchParams("since=2026-01-01T00:00:00.000Z&until=2026-06-01T00:00:00.000Z&groupBy=carrier"),
    );
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.query.groupBy).toBe("carrier");

    const badGb = parseBf83ScorecardQuery(new URLSearchParams("groupBy=milk"));
    expect(badGb.ok).toBe(false);

    const big = parseBf83ScorecardQuery(
      new URLSearchParams(
        "since=2020-01-01T00:00:00.000Z&until=2026-01-01T00:00:00.000Z&groupBy=supplier",
      ),
    );
    expect(big.ok).toBe(false);
  });

  it("resolveBf83Group carrier prefers supplier FK", () => {
    const r = resolveBf83Group("carrier", {
      poSupplierId: null,
      poSupplierCode: null,
      poSupplierName: null,
      carrierSupplierId: "c1",
      carrierSupplierCode: "FX",
      carrierSupplierName: "Fast Freight",
      carrierFreeText: null,
      customerCrmAccountId: null,
      customerCrmName: null,
    });
    expect(r.groupId).toBe("c1");
    expect(r.groupName).toBe("Fast Freight");
  });

  it("aggregates OTIF and disposition counts", () => {
    const eta = new Date("2026-03-10T12:00:00.000Z");
    const recvOk = new Date("2026-03-09T12:00:00.000Z");
    const facts: Bf83ShipmentFact[] = [
      {
        shipmentId: "s1",
        receivedAt: recvOk,
        expectedReceiveAt: eta,
        groupBy: "supplier",
        groupId: "sup-a",
        groupName: "Supplier A",
        lines: [
          {
            quantityShipped: new Prisma.Decimal(10),
            quantityReceived: new Prisma.Decimal(10),
            disposition: "MATCH",
          },
        ],
      },
      {
        shipmentId: "s2",
        receivedAt: new Date("2026-03-15T12:00:00.000Z"),
        expectedReceiveAt: eta,
        groupBy: "supplier",
        groupId: "sup-a",
        groupName: "Supplier A",
        lines: [
          {
            quantityShipped: new Prisma.Decimal(5),
            quantityReceived: new Prisma.Decimal(3),
            disposition: "SHORT",
          },
        ],
      },
    ];
    const aggs = aggregateBf83Scorecard(facts);
    expect(aggs).toHaveLength(1);
    const row = aggs[0]!;
    expect(row.shipmentsReceived).toBe(2);
    expect(row.shipmentsWithExpectedArrival).toBe(2);
    expect(row.shipmentsOnTime).toBe(1);
    expect(row.shipmentsOtif).toBe(1);
    expect(row.linesShortDisposition).toBe(1);
    expect(row.linesMatchDisposition).toBe(1);

    const doc = bf83ScorecardDocFromAggs("supplier", recvOk, eta, facts, aggs);
    expect(doc.rows[0]?.pctOnTime).toBe(50);
    expect(doc.rows[0]?.pctOtif).toBe(50);
    const csv = bf83ScorecardToCsv(doc);
    expect(csv).toContain("bf83.v1");
    expect(csv).toContain("Supplier A");
  });
});
