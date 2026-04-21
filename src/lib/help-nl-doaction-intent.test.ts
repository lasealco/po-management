import { describe, expect, it } from "vitest";

import {
  extractOrdersQueueIntentFromUserMessage,
  extractPurchaseOrderNumberFromUserMessage,
  extractReportingHubFocusFromUserMessage,
  isValidOrdersQueueValue,
} from "@/lib/help-nl-doaction-intent";

describe("extractPurchaseOrderNumberFromUserMessage", () => {
  it("parses PO- style tokens", () => {
    expect(extractPurchaseOrderNumberFromUserMessage("open PO-1004 now")).toBe("PO-1004");
    expect(extractPurchaseOrderNumberFromUserMessage("po 2040 status")).toBe("PO-2040");
  });

  it("parses purchase order phrasing", () => {
    expect(extractPurchaseOrderNumberFromUserMessage("purchase order #5001")).toBe("PO-5001");
  });

  it("returns undefined when absent", () => {
    expect(extractPurchaseOrderNumberFromUserMessage("hello")).toBeUndefined();
  });
});

describe("extractOrdersQueueIntentFromUserMessage", () => {
  it("maps common queue phrases", () => {
    expect(extractOrdersQueueIntentFromUserMessage("show overdue orders")).toBe("overdue");
    expect(extractOrdersQueueIntentFromUserMessage("needs my action queue")).toBe("needs_my_action");
    expect(extractOrdersQueueIntentFromUserMessage("waiting on me")).toBe("waiting_on_me");
    expect(extractOrdersQueueIntentFromUserMessage("awaiting supplier")).toBe("awaiting_supplier");
    expect(extractOrdersQueueIntentFromUserMessage("split pending buyer")).toBe("split_pending_buyer");
    expect(extractOrdersQueueIntentFromUserMessage("full orders list")).toBe("all");
  });
});

describe("isValidOrdersQueueValue", () => {
  it("accepts known queue keys", () => {
    expect(isValidOrdersQueueValue("needs_my_action")).toBe(true);
    expect(isValidOrdersQueueValue("bogus")).toBe(false);
  });
});

describe("extractReportingHubFocusFromUserMessage", () => {
  it("returns undefined without reporting context", () => {
    expect(extractReportingHubFocusFromUserMessage("open CRM")).toBeUndefined();
  });

  it("infers focus when reporting hub is mentioned", () => {
    expect(
      extractReportingHubFocusFromUserMessage("reporting hub CRM section"),
    ).toBe("crm");
    expect(
      extractReportingHubFocusFromUserMessage("reporting hub po metrics"),
    ).toBe("po");
    expect(
      extractReportingHubFocusFromUserMessage("wms on the reporting hub"),
    ).toBe("wms");
    expect(
      extractReportingHubFocusFromUserMessage("control tower reporting hub"),
    ).toBe("control-tower");
  });
});
