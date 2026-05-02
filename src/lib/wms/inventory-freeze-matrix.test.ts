import { describe, expect, it } from "vitest";

import {
  normalizeHoldReleaseGrantInput,
  normalizeInventoryFreezeReasonCode,
} from "./inventory-freeze-matrix";

describe("inventory-freeze-matrix (BF-58)", () => {
  it("normalizes reason codes", () => {
    expect(normalizeInventoryFreezeReasonCode("qc_hold")).toEqual({
      ok: true,
      code: "QC_HOLD",
    });
    expect(normalizeInventoryFreezeReasonCode("").ok).toBe(false);
    expect(normalizeInventoryFreezeReasonCode("BAD").ok).toBe(false);
  });

  it("normalizes release grant input", () => {
    expect(normalizeHoldReleaseGrantInput("")).toEqual({ ok: true, grant: null });
    expect(normalizeHoldReleaseGrantInput(undefined)).toEqual({ ok: true, grant: null });
    expect(normalizeHoldReleaseGrantInput("org.wms.inventory.hold.release_quality")).toEqual({
      ok: true,
      grant: "org.wms.inventory.hold.release_quality",
    });
    expect(normalizeHoldReleaseGrantInput("nope").ok).toBe(false);
  });
});
