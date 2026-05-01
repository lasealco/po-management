import { describe, expect, it } from "vitest";

import { normalizeQuoteInventorySku } from "./explode-crm-quote-to-outbound";

describe("normalizeQuoteInventorySku", () => {
  it("trims and rejects empty", () => {
    expect(normalizeQuoteInventorySku("  abc  ")).toBe("abc");
    expect(normalizeQuoteInventorySku("")).toBe(null);
    expect(normalizeQuoteInventorySku(null)).toBe(null);
    expect(normalizeQuoteInventorySku(undefined)).toBe(null);
  });
});
