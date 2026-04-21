import { describe, expect, it } from "vitest";

import { getPageHintForPath } from "@/lib/page-hints";

describe("getPageHintForPath", () => {
  it("returns platform hint for /platform", () => {
    const h = getPageHintForPath("/platform");
    expect(h?.bullets.length).toBeGreaterThan(0);
    expect(h?.bullets[0]).toMatch(/workspace/i);
  });

  it("matches longest prefix for nested routes", () => {
    const ct = getPageHintForPath("/control-tower/workbench");
    expect(ct?.bullets[0]).toMatch(/shipment/i);
    const twin = getPageHintForPath("/supply-chain-twin/explorer");
    expect(twin?.bullets[0]).toMatch(/preview|twin/i);
  });

  it("returns null for unknown paths", () => {
    expect(getPageHintForPath("/unknown-route")).toBeNull();
  });
});
