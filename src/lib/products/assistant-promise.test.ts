import { describe, expect, it } from "vitest";

import {
  buildProductPromiseSummary,
  buildProductRecoveryProposal,
  computeProductAtp,
  parseProductPromiseStatus,
} from "./assistant-promise";

describe("parseProductPromiseStatus", () => {
  it("normalizes valid statuses", () => {
    expect(parseProductPromiseStatus("reviewed")).toBe("REVIEWED");
    expect(parseProductPromiseStatus("PROMISE_READY")).toBe("PROMISE_READY");
  });

  it("rejects invalid statuses", () => {
    expect(parseProductPromiseStatus("APPROVED")).toBeNull();
  });
});

describe("computeProductAtp", () => {
  it("subtracts holds and allocations before demand", () => {
    expect(
      computeProductAtp({
        onHandQty: 100,
        allocatedQty: 30,
        onHoldQty: 20,
        openSalesDemandQty: 60,
        inboundQty: 10,
        openWmsTaskQty: 5,
      }),
    ).toMatchObject({ usableOnHand: 80, availableNow: 50, shortageQty: 10, blockedQty: 25, status: "RECOVERY_NEEDED" });
  });

  it("marks promise ready when available covers demand", () => {
    expect(
      computeProductAtp({
        onHandQty: 100,
        allocatedQty: 20,
        onHoldQty: 0,
        openSalesDemandQty: 50,
        inboundQty: 0,
        openWmsTaskQty: 0,
      }).status,
    ).toBe("PROMISE_READY");
  });
});

describe("product promise drafts", () => {
  it("builds promise summary and recovery proposal", () => {
    const inputs = {
      onHandQty: 10,
      allocatedQty: 5,
      onHoldQty: 3,
      openSalesDemandQty: 9,
      inboundQty: 20,
      openWmsTaskQty: 2,
    };
    expect(buildProductPromiseSummary({ productName: "Corr roll", inputs })).toContain("available-to-promise");
    expect(buildProductRecoveryProposal({ productName: "Corr roll", inputs, hasHold: true, hasWmsBlocker: true })).toContain(
      "human-approved action",
    );
  });
});
