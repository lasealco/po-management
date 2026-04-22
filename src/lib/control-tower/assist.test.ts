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

  it("accepts flow: as an alias for shipmentSource", () => {
    expect(assistControlTowerQuery("flow:po").suggestedFilters.shipmentSource).toBe("PO");
    expect(assistControlTowerQuery("flow:unlinked").suggestedFilters.shipmentSource).toBe("UNLINKED");
  });

  it("maps extra route: slugs to workbench routeAction prefixes", () => {
    expect(assistControlTowerQuery("route:escalate_booking").suggestedFilters.routeAction).toBe("Escalate booking");
    expect(assistControlTowerQuery("route:await_booking").suggestedFilters.routeAction).toBe("Await booking");
    expect(assistControlTowerQuery("route:record_arrival").suggestedFilters.routeAction).toBe("Record arrival");
    expect(assistControlTowerQuery("route:route_complete").suggestedFilters.routeAction).toBe("Route complete");
  });

  it("parses from / to UNLOCODE tokens as lane filters", () => {
    expect(assistControlTowerQuery("from USNYC").suggestedFilters.lane).toBe("USNYC");
    expect(assistControlTowerQuery("to DEHAM").suggestedFilters.lane).toBe("DEHAM");
  });

  it("parses trace:, sku:, and product: into productTraceQ", () => {
    expect(assistControlTowerQuery("trace:SKU-1.a").suggestedFilters.productTraceQ).toBe("SKU-1.a");
    expect(assistControlTowerQuery("sku:BUYER-2").suggestedFilters.productTraceQ).toBe("BUYER-2");
    expect(assistControlTowerQuery("product:Widget-X").suggestedFilters.productTraceQ).toBe("Widget-X");
  });

  it("does not treat trace: value as productTraceQ when it is a shipment cuid", () => {
    const cuid = `c${"0".repeat(19)}`;
    const { suggestedFilters, hints } = assistControlTowerQuery(`trace:${cuid}`);
    expect(suggestedFilters.productTraceQ).toBeUndefined();
    expect(hints.some((h) => h.includes("not a shipment id"))).toBe(true);
  });

  it("copies productTraceQ to q when no other free text remains", () => {
    const { suggestedFilters } = assistControlTowerQuery("trace:ONLYCODE");
    expect(suggestedFilters.productTraceQ).toBe("ONLYCODE");
    expect(suggestedFilters.q).toBe("ONLYCODE");
  });

  it("keeps remaining words in q alongside trace token", () => {
    const { suggestedFilters } = assistControlTowerQuery("trace:ABC hello");
    expect(suggestedFilters.productTraceQ).toBe("ABC");
    expect(suggestedFilters.q).toBe("hello");
  });

  it("adds default search hint when no structured tokens match", () => {
    const { hints } = assistControlTowerQuery("random freetext only");
    expect(hints.some((h) => h.includes("Searching bookings"))).toBe(true);
  });
});
