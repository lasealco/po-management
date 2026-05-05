import { describe, expect, it } from "vitest";

import {
  ageDaysBetween,
  agingBucketForAgeDays,
  firstInboundKey,
  summarizeBf91RowsByBucket,
  type Bf91Row,
} from "@/lib/wms/inventory-aging-export-bf91";

describe("agingBucketForAgeDays", () => {
  it("maps boundary days into buckets", () => {
    expect(agingBucketForAgeDays(null)).toBe("UNKNOWN");
    expect(agingBucketForAgeDays(0)).toBe("0-30d");
    expect(agingBucketForAgeDays(30)).toBe("0-30d");
    expect(agingBucketForAgeDays(31)).toBe("31-90d");
    expect(agingBucketForAgeDays(90)).toBe("31-90d");
    expect(agingBucketForAgeDays(91)).toBe("91-180d");
    expect(agingBucketForAgeDays(180)).toBe("91-180d");
    expect(agingBucketForAgeDays(181)).toBe("181-365d");
    expect(agingBucketForAgeDays(365)).toBe("181-365d");
    expect(agingBucketForAgeDays(366)).toBe("366d+");
  });
});

describe("ageDaysBetween", () => {
  it("floors whole days", () => {
    const a = new Date("2026-01-01T12:00:00.000Z");
    const b = new Date("2026-01-03T11:59:59.000Z");
    expect(ageDaysBetween(a, b)).toBe(1);
  });
});

describe("firstInboundKey", () => {
  it("joins ids", () => {
    expect(firstInboundKey("w", "b", "p")).toBe("w\tb\tp");
  });
});

describe("summarizeBf91RowsByBucket", () => {
  it("aggregates qty per bucket", () => {
    const mk = (bucket: string, qty: string): Bf91Row => ({
      balanceId: "x",
      warehouseId: "w",
      warehouseCode: "WH",
      binId: "b",
      binCode: "BIN",
      productId: "p",
      sku: null,
      productCode: null,
      productName: "N",
      lotCode: "",
      onHandQty: qty,
      allocatedQty: "0",
      onHold: false,
      inventoryOwnershipSupplierIdBf79: null,
      firstInboundAt: null,
      ageDays: null,
      agingBucket: bucket,
    });
    const summary = summarizeBf91RowsByBucket([
      mk("0-30d", "10"),
      mk("0-30d", "5"),
      mk("UNKNOWN", "2"),
    ]);
    expect(summary.find((s) => s.bucket === "0-30d")?.onHandQty).toBe("15");
    expect(summary.find((s) => s.bucket === "UNKNOWN")?.rowCount).toBe(1);
  });
});
