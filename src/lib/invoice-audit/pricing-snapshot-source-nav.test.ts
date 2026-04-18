import { describe, expect, it } from "vitest";

import { formatPricingSnapshotSourceType } from "@/lib/invoice-audit/pricing-snapshot-source-nav";

describe("formatPricingSnapshotSourceType", () => {
  it("labels known snapshot source enums", () => {
    expect(formatPricingSnapshotSourceType("TARIFF_CONTRACT_VERSION")).toBe("Tariff contract version");
    expect(formatPricingSnapshotSourceType("QUOTE_RESPONSE")).toBe("RFQ quote response");
  });

  it("falls back to raw value for unexpected types", () => {
    expect(formatPricingSnapshotSourceType("CUSTOM")).toBe("CUSTOM");
  });

  it("handles empty string", () => {
    expect(formatPricingSnapshotSourceType("")).toBe("Unknown source");
    expect(formatPricingSnapshotSourceType("   ")).toBe("Unknown source");
  });
});
