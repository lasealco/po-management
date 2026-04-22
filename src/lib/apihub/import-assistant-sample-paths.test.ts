import { describe, expect, it } from "vitest";

import { collectImportAssistantSamplePaths } from "./import-assistant-sample-paths";

describe("collectImportAssistantSamplePaths", () => {
  it("walks nested objects and array head", () => {
    const paths = collectImportAssistantSamplePaths(
      { shipment: { id: "1" }, items: [{ sku: "a", qty: 1 }] },
      20,
    );
    expect(paths).toContain("shipment.id");
    expect(paths).toContain("items[0].sku");
    expect(paths).toContain("items[0].qty");
  });

  it("respects maxPaths", () => {
    const paths = collectImportAssistantSamplePaths({ a: 1, b: 2, c: 3 }, 2);
    expect(paths.length).toBeLessThanOrEqual(2);
  });
});
