import { describe, expect, it } from "vitest";

import { extractRequestedDate, parseSalesOrderIntent } from "./sales-order-intent";

describe("extractRequestedDate", () => {
  it("resolves next week tuesday with bump", () => {
    const now = new Date("2026-04-23T12:00:00.000Z"); // Thursday
    const d = extractRequestedDate("next week tuesday he will pick up", now);
    expect(d).toBeTruthy();
    // next Tuesday from Thu = Apr 28; next week +7 = May 5
    expect(d).toBe("2026-05-05");
  });
});

describe("parseSalesOrderIntent", () => {
  const accounts = [
    { id: "a1", name: "ABC Plastics (Delaware)", legalName: "ABC Plastics Inc" },
    { id: "a2", name: "ABC Corp New York", legalName: null },
  ];
  const products = [
    { id: "p1", name: "Corrugated roll 1200mm", productCode: "CORR-1200" },
    { id: "p2", name: "Steel sheet", productCode: "STL-1" },
  ];
  const warehouses = [{ id: "w1", name: "WH-DEMO-DC1", code: "WH-DEMO-DC1" }];
  const orgUnits = [{ id: "o1", name: "DEMO-ORG", code: "D01" }];

  const text =
    "John from ABC called and wants 100 corr-roll for 100 usd a piece. Pickup at our demo warehouse next week tuesday.";

  it("returns clarify_account when two ABC customers match", () => {
    const r = parseSalesOrderIntent(
      text,
      { accounts, products, warehouses, orgUnits },
      { accountId: null, productId: null },
    );
    expect(r.kind).toBe("clarify_account");
    if (r.kind === "clarify_account") {
      expect(r.options.length).toBe(2);
    }
  });

  it("returns ready when account and product are resolved", () => {
    const r = parseSalesOrderIntent(
      text,
      { accounts, products, warehouses, orgUnits },
      { accountId: "a1", productId: "p1" },
    );
    expect(r.kind).toBe("ready");
    if (r.kind === "ready") {
      expect(r.createPayload.customerCrmAccountId).toBe("a1");
      expect(r.summary.quantity).toBe(100);
      expect(r.summary.unitPrice).toBe(100);
      expect(r.createPayload.notes).toContain("Sales Assistant");
    }
  });
});
