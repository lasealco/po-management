import { describe, expect, it } from "vitest";

import { WMS_API_ENDPOINT_ACCESS } from "./wms-api-grants";

describe("WE-08 WMS_API_ENDPOINT_ACCESS", () => {
  it("covers core dashboard and billing and saved views routes", () => {
    expect(WMS_API_ENDPOINT_ACCESS.map((r) => r.id)).toEqual([
      "api-wms",
      "api-wms-billing",
      "api-wms-saved-ledger-views",
      "api-wms-saved-ledger-views-id",
      "api-wms-receiving-accrual-staging",
    ]);
  });

  it("requires edit for all mutating methods", () => {
    for (const row of WMS_API_ENDPOINT_ACCESS) {
      const m = row.methods;
      if ("POST" in m) expect(m.POST).toBe("edit");
      if ("DELETE" in m) expect(m.DELETE).toBe("edit");
      if ("GET" in m) expect(m.GET).toBe("view");
    }
  });
});
