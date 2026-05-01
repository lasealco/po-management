import { describe, expect, it } from "vitest";

import {
  customerReturnApplyQuarantineHold,
  customerReturnPutawayBlockedReason,
} from "./customer-return-policy";

describe("customer-return-policy", () => {
  it("blocks putaway only for SCRAP customer returns", () => {
    expect(customerReturnPutawayBlockedReason("STANDARD", null)).toBeNull();
    expect(customerReturnPutawayBlockedReason("STANDARD", "RESTOCK")).toBeNull();
    expect(customerReturnPutawayBlockedReason("CUSTOMER_RETURN", "RESTOCK")).toBeNull();
    expect(customerReturnPutawayBlockedReason("CUSTOMER_RETURN", "QUARANTINE")).toBeNull();
    expect(customerReturnPutawayBlockedReason("CUSTOMER_RETURN", "SCRAP")).toContain("SCRAP");
  });

  it("requests hold after putaway only for QUARANTINE customer returns", () => {
    expect(customerReturnApplyQuarantineHold("STANDARD", "QUARANTINE")).toBe(false);
    expect(customerReturnApplyQuarantineHold("CUSTOMER_RETURN", "RESTOCK")).toBe(false);
    expect(customerReturnApplyQuarantineHold("CUSTOMER_RETURN", "QUARANTINE")).toBe(true);
  });
});
