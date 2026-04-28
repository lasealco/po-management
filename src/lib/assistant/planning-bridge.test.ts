import { describe, expect, it } from "vitest";

import {
  buildDemandSupplyGaps,
  buildPlanningBridgePacket,
  scorePlanningRisk,
  summarizePlanningDemand,
  summarizePlanningSupply,
  type PlanningBridgeInputs,
} from "./planning-bridge";

const baseInput: PlanningBridgeInputs = {
  horizonDays: 30,
  demand: [
    {
      id: "demand-1",
      orderNo: "SO-1",
      productId: "product-1",
      productLabel: "Blue Widget",
      customerLabel: "Acme",
      quantity: 120,
      requestedDate: "2026-05-01T00:00:00.000Z",
      status: "OPEN",
    },
  ],
  supply: [
    {
      id: "supply-1",
      productId: "product-1",
      productLabel: "Blue Widget",
      quantity: 30,
      expectedDate: "2026-05-15T00:00:00.000Z",
      supplierLabel: "Supplier A",
      status: "OPEN",
    },
  ],
  inventory: [
    {
      productId: "product-1",
      productLabel: "Blue Widget",
      warehouseLabel: "WH1",
      onHandQty: 50,
      allocatedQty: 10,
      onHold: false,
    },
  ],
  constraints: [
    {
      id: "task-1",
      source: "WMS",
      label: "Open picking backlog",
      severity: "HIGH",
      detail: "Backlog blocks release.",
      objectType: "wms_task",
      objectId: "task-1",
    },
  ],
};

describe("AMP22 planning bridge helpers", () => {
  it("summarizes demand by product and customer/order evidence", () => {
    const summary = summarizePlanningDemand(baseInput.demand);

    expect(summary.totalDemandUnits).toBe(120);
    expect(summary.products[0]).toMatchObject({ productId: "product-1", quantity: 120, orders: ["SO-1"], customers: ["Acme"] });
  });

  it("summarizes available, held, and inbound supply", () => {
    const summary = summarizePlanningSupply(baseInput.supply, [
      ...baseInput.inventory,
      { productId: "product-1", productLabel: "Blue Widget", warehouseLabel: "WH2", onHandQty: 20, allocatedQty: 0, onHold: true },
    ]);

    expect(summary.availableUnits).toBe(40);
    expect(summary.onHoldUnits).toBe(20);
    expect(summary.inboundUnits).toBe(30);
  });

  it("builds shortage gaps from demand and supply coverage", () => {
    const demand = summarizePlanningDemand(baseInput.demand);
    const supply = summarizePlanningSupply(baseInput.supply, baseInput.inventory);
    const gaps = buildDemandSupplyGaps(demand, supply);

    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ productLabel: "Blue Widget", shortageUnits: 50 });
  });

  it("scores planning risk from shortage and constraints", () => {
    const risk = scorePlanningRisk({ totalDemandUnits: 100, shortageUnits: 50, constraintCount: 2, criticalConstraintCount: 1 });

    expect(risk).toBeGreaterThan(40);
  });

  it("creates an approval-safe planning packet and scenario assumptions", () => {
    const packet = buildPlanningBridgePacket(baseInput);

    expect(packet.planningScore).toBeLessThan(100);
    expect(packet.shortageUnits).toBe(50);
    expect(packet.scenario.assumptions.join(" ")).toContain("advisory only");
    expect(packet.recommendations.steps.map((step) => step.step)).toContain("Approve S&OP packet");
    expect(packet.leadershipSummary).toContain("no SO, PO, inventory, WMS, or shipment record is changed automatically");
  });
});
