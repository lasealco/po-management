import { describe, expect, it } from "vitest";

import { buildDeterministicScriRecommendations } from "@/lib/scri/recommendations/build-deterministic-recommendations";

describe("buildDeterministicScriRecommendations", () => {
  it("adds executive + logistics partner for CRITICAL severity", () => {
    const rows = buildDeterministicScriRecommendations({
      event: {
        eventType: "OTHER_SUPPLY_CHAIN_RISK",
        severity: "CRITICAL",
        title: "Test",
        shortSummary: null,
      },
      candidateShipmentCount: 0,
      affectedMatchCount: 2,
      affectedByType: { SHIPMENT: 2 },
      firstObjectIdByType: {},
    });
    const types = rows.map((r) => r.recommendationType);
    expect(types).toContain("EXEC_ESCALATION");
    expect(types).toContain("CONTACT_LOGISTICS_PARTNER");
  });

  it("adds narrow-candidates when many indexed shipments", () => {
    const rows = buildDeterministicScriRecommendations({
      event: {
        eventType: "PORT_CONGESTION",
        severity: "MEDIUM",
        title: "Congestion",
        shortSummary: null,
      },
      candidateShipmentCount: 5,
      affectedMatchCount: 1,
      affectedByType: { SHIPMENT: 1 },
      firstObjectIdByType: {},
    });
    expect(rows.some((r) => r.recommendationType === "NARROW_SHIPMENT_CANDIDATES")).toBe(true);
  });

  it("adds trade desk for tariff events", () => {
    const rows = buildDeterministicScriRecommendations({
      event: {
        eventType: "TARIFF_CHANGE",
        severity: "LOW",
        title: "Duty change",
        shortSummary: null,
      },
      candidateShipmentCount: 0,
      affectedMatchCount: 0,
      affectedByType: {},
      firstObjectIdByType: {},
    });
    expect(rows.some((r) => r.recommendationType === "TRADE_COMPLIANCE_DESK")).toBe(true);
    expect(rows.some((r) => r.recommendationType === "CONFIRM_GEO_COVERAGE")).toBe(true);
  });

  it("targets warehouse and inventory when present", () => {
    const rows = buildDeterministicScriRecommendations({
      event: {
        eventType: "FLOOD",
        severity: "MEDIUM",
        title: "Flood",
        shortSummary: null,
      },
      candidateShipmentCount: 1,
      affectedMatchCount: 2,
      affectedByType: { WAREHOUSE: 1, INVENTORY_BALANCE: 1 },
      firstObjectIdByType: { WAREHOUSE: "wh-1", INVENTORY_BALANCE: "bal-1" },
    });
    const site = rows.find((r) => r.recommendationType === "ALERT_AFFECTED_SITE");
    const stock = rows.find((r) => r.recommendationType === "VERIFY_STOCK_POSITION");
    expect(site?.targetObjectId).toBe("wh-1");
    expect(stock?.targetObjectId).toBe("bal-1");
  });
});
