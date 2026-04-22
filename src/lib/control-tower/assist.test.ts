import { describe, expect, it } from "vitest";

import { assistControlTowerQuery } from "./assist";

describe("assistControlTowerQuery", () => {
  it("returns guidance when query is empty", () => {
    const { hints, suggestedFilters } = assistControlTowerQuery("   ");
    expect(suggestedFilters).toEqual({});
    expect(hints[0]).toContain("lane:");
  });

  it("parses lane:, origin:, dest:, route:, source:, overdue, status, and free-text q", () => {
    const { hints, suggestedFilters } = assistControlTowerQuery(
      "lane:CNSHA origin:deham dest:usnyc route:plan_leg source:po overdue IN_TRANSIT leftover text",
    );
    expect(suggestedFilters.lane).toBe("CNSHA");
    expect(suggestedFilters.originCode).toBe("DEHAM");
    expect(suggestedFilters.destinationCode).toBe("USNYC");
    expect(suggestedFilters.routeAction).toBe("Plan leg");
    expect(suggestedFilters.shipmentSource).toBe("PO");
    expect(suggestedFilters.onlyOverdueEta).toBe(true);
    expect(suggestedFilters.status).toBe("IN_TRANSIT");
    expect(suggestedFilters.q).toBe("leftover text");
    expect(hints.length).toBeGreaterThan(3);
  });

  it("accepts supplier:/customer:/carrier: when value looks like a cuid", () => {
    const id = "c" + "a".repeat(19);
    const { suggestedFilters, hints } = assistControlTowerQuery(
      `supplier:${id} customer:${id} carrier:${id}`,
    );
    expect(suggestedFilters.supplierId).toBe(id);
    expect(suggestedFilters.customerCrmAccountId).toBe(id);
    expect(suggestedFilters.carrierSupplierId).toBe(id);
    expect(hints.some((h) => h.includes("supplier id"))).toBe(true);
  });

  it("warns on supplier: when not a cuid", () => {
    const { suggestedFilters, hints } = assistControlTowerQuery("supplier:not-a-cuid");
    expect(suggestedFilters.supplierId).toBeUndefined();
    expect(hints.some((h) => h.includes("cuid"))).toBe(true);
  });

  it("parses exception:, alertType:, owner:, and mode hints", () => {
    const owner = "c" + "b".repeat(19);
    const { suggestedFilters } = assistControlTowerQuery(
      `exception:DELAY.v1 alertType:COLLAB_MENTION owner:${owner} FCL freight`,
    );
    expect(suggestedFilters.exceptionCode).toBe("DELAY.v1");
    expect(suggestedFilters.alertType).toBe("COLLAB_MENTION");
    expect(suggestedFilters.dispatchOwnerUserId).toBe(owner);
    expect(suggestedFilters.mode).toBe("OCEAN");
  });

  it("maps export source to UNLINKED shipment flow", () => {
    const { suggestedFilters } = assistControlTowerQuery("source:export");
    expect(suggestedFilters.shipmentSource).toBe("UNLINKED");
  });

  it("adds default search hint when no structured tokens match", () => {
    const { hints } = assistControlTowerQuery("random freetext only");
    expect(hints.some((h) => h.includes("Searching bookings"))).toBe(true);
  });
});
