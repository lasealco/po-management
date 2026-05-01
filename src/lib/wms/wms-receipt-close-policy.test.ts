import { describe, expect, it } from "vitest";

import { canAdvanceReceiveStatusToReceiptComplete } from "./wms-receipt-close-policy";

describe("canAdvanceReceiveStatusToReceiptComplete", () => {
  it("allows RECEIVING → RECEIPT_COMPLETE path", () => {
    expect(canAdvanceReceiveStatusToReceiptComplete("RECEIVING")).toBe(true);
  });

  it("disallows when transition is not legal", () => {
    expect(canAdvanceReceiveStatusToReceiptComplete("EXPECTED")).toBe(false);
    expect(canAdvanceReceiveStatusToReceiptComplete("NOT_TRACKED")).toBe(false);
    expect(canAdvanceReceiveStatusToReceiptComplete("CLOSED")).toBe(false);
  });

  it("allows DISCREPANCY → RECEIPT_COMPLETE per state machine", () => {
    expect(canAdvanceReceiveStatusToReceiptComplete("DISCREPANCY")).toBe(true);
  });
});
