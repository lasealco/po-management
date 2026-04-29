import { describe, expect, it } from "vitest";

import { allowedNextWmsReceiveStatuses, canTransitionWmsReceive } from "./wms-receive-status";

describe("wms-receive-status", () => {
  it("defines allowed forward transitions", () => {
    expect(canTransitionWmsReceive("NOT_TRACKED", "EXPECTED")).toBe(true);
    expect(canTransitionWmsReceive("EXPECTED", "AT_DOCK")).toBe(true);
    expect(canTransitionWmsReceive("AT_DOCK", "RECEIVING")).toBe(true);
    expect(canTransitionWmsReceive("RECEIVING", "RECEIPT_COMPLETE")).toBe(true);
    expect(canTransitionWmsReceive("RECEIPT_COMPLETE", "CLOSED")).toBe(true);
  });

  it("allows discrepancy branches", () => {
    expect(canTransitionWmsReceive("EXPECTED", "DISCREPANCY")).toBe(true);
    expect(canTransitionWmsReceive("DISCREPANCY", "RECEIVING")).toBe(true);
    expect(canTransitionWmsReceive("DISCREPANCY", "RECEIPT_COMPLETE")).toBe(true);
  });

  it("rejects same-state and backwards hops", () => {
    expect(canTransitionWmsReceive("EXPECTED", "EXPECTED")).toBe(false);
    expect(canTransitionWmsReceive("AT_DOCK", "EXPECTED")).toBe(false);
    expect(canTransitionWmsReceive("CLOSED", "RECEIVING")).toBe(false);
  });

  it("lists next actions per state", () => {
    expect(allowedNextWmsReceiveStatuses("NOT_TRACKED")).toEqual(["EXPECTED"]);
    expect(allowedNextWmsReceiveStatuses("CLOSED")).toEqual([]);
  });
});
