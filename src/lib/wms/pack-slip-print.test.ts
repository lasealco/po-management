import { describe, expect, it } from "vitest";

import { escapeHtmlForPackSlip } from "./pack-slip-print";

describe("escapeHtmlForPackSlip", () => {
  it("escapes angle brackets and ampersands", () => {
    expect(escapeHtmlForPackSlip(`a & b < c > "x"`)).toBe(`a &amp; b &lt; c &gt; &quot;x&quot;`);
  });
});
