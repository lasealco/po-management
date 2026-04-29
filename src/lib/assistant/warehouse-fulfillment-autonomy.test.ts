import { describe, expect, it } from "vitest";

import { buildWarehouseFulfillmentPacket, type WarehouseFulfillmentInputs } from "./warehouse-fulfillment-autonomy";

const inputs: WarehouseFulfillmentInputs = {
  warehouses: [{ id: "wh-1", code: "WH1", name: "Main DC", isActive: true }],
  tasks: [
    { id: "task-1", warehouseId: "wh-1", warehouseName: "Main DC", taskType: "PICK", status: "OPEN", quantity: 10, ageHours: 30, productName: "Widget", shipmentNo: "SHP-1", orderNumber: "PO-1", waveNo: "WAVE-1" },
    { id: "task-2", warehouseId: "wh-1", warehouseName: "Main DC", taskType: "PUTAWAY", status: "OPEN", quantity: 8, ageHours: 10, productName: "Gadget", shipmentNo: "SHP-2", orderNumber: null, waveNo: null },
  ],
  waves: [{ id: "wave-1", warehouseId: "wh-1", warehouseName: "Main DC", waveNo: "WAVE-1", status: "RELEASED", taskCount: 3, openTaskCount: 2, ageHours: 28 }],
  outboundOrders: [{ id: "out-1", warehouseId: "wh-1", warehouseName: "Main DC", outboundNo: "OUT-1", status: "RELEASED", requestedShipDate: "2020-01-01T00:00:00.000Z", lineCount: 1, pickedQty: 0, packedQty: 0, shippedQty: 0, totalQty: 10 }],
  inventory: [{ id: "bal-1", warehouseId: "wh-1", warehouseName: "Main DC", onHandQty: 100, allocatedQty: 92, onHold: true, holdReason: "QC hold" }],
  shipments: [{ id: "shipment-1", shipmentNo: "SHP-1", status: "IN_TRANSIT", expectedReceiveAt: "2020-01-01T00:00:00.000Z", receivedAt: null, exceptionCount: 2 }],
  capacityPlans: [{ id: "cap-1", title: "Capacity plan", status: "RECOVERY_NEEDED", capacityScore: 48, warehouseId: "wh-1" }],
  networkPackets: [{ id: "net-1", title: "Network twin", status: "DRAFT", twinScore: 61, bottleneckCount: 2, disruptionRiskCount: 1, recoveryActionCount: 2 }],
  actionQueue: [{ id: "aq-1", actionKind: "warehouse_capacity_recovery", status: "PENDING", priority: "HIGH", objectType: "warehouse" }],
};

describe("buildWarehouseFulfillmentPacket", () => {
  it("aggregates capacity, tasks, waves, outbound, exceptions, and supervisor actions", () => {
    const packet = buildWarehouseFulfillmentPacket(inputs);

    expect(packet.capacityPosture.warehouseCount).toBe(1);
    expect(packet.taskRecovery.openTaskCount).toBe(2);
    expect(packet.taskRecovery.agedTaskCount).toBe(1);
    expect(packet.waveHealth.waveRiskCount).toBe(1);
    expect(packet.outboundFulfillment.outboundRiskCount).toBe(1);
    expect(packet.exceptionEvidence.exceptionCount).toBe(3);
    expect(packet.supervisorAction.recoveryActionCount).toBeGreaterThanOrEqual(5);
    expect(packet.mobileWork.mobileCandidateCount).toBeGreaterThan(0);
    expect(packet.leadershipSummary).toContain("Sprint 8 Warehouse & Fulfillment Autonomy score");
  });

  it("keeps WMS and fulfillment execution review-gated", () => {
    const packet = buildWarehouseFulfillmentPacket(inputs);

    expect(packet.capacityPosture.guardrail).toContain("does not assign labor");
    expect(packet.taskRecovery.guardrail).toContain("do not complete");
    expect(packet.waveHealth.guardrail).toContain("does not release");
    expect(packet.outboundFulfillment.guardrail).toContain("does not pick");
    expect(packet.exceptionEvidence.guardrail).toContain("does not resolve exceptions");
    expect(packet.supervisorAction.guardrail).toContain("do not mutate WMS tasks");
    expect(packet.mobileWork.guardrail).toContain("does not dispatch");
    expect(packet.rollbackPlan.steps.join(" ")).toContain("mobile work assignments unchanged");
  });
});
