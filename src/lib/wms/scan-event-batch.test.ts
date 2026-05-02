import { describe, expect, it } from "vitest";

import { parseScanEventBatchPayload } from "./scan-event-batch";

describe("parseScanEventBatchPayload (BF-60)", () => {
  it("accepts minimal valid batch", () => {
    const r = parseScanEventBatchPayload({
      clientBatchId: "batch-1",
      deviceClock: "2026-04-30T12:00:00.000Z",
      events: [
        {
          seq: 1,
          deviceClock: "2026-04-30T12:00:01.000Z",
          type: "VALIDATE_PACK_SCAN",
          payload: { outboundOrderId: "out-1", packScanTokens: ["A"] },
        },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.events).toHaveLength(1);
      expect(r.value.events[0].payload.packScanTokens).toEqual(["A"]);
    }
  });

  it("rejects non-contiguous seq", () => {
    const r = parseScanEventBatchPayload({
      clientBatchId: "b",
      deviceClock: "2026-04-30T12:00:00.000Z",
      events: [
        {
          seq: 1,
          deviceClock: "t",
          type: "VALIDATE_PACK_SCAN",
          payload: { outboundOrderId: "o1" },
        },
        {
          seq: 3,
          deviceClock: "t",
          type: "VALIDATE_PACK_SCAN",
          payload: { outboundOrderId: "o1" },
        },
      ],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects unknown event type", () => {
    const r = parseScanEventBatchPayload({
      clientBatchId: "b",
      deviceClock: "2026-04-30T12:00:00.000Z",
      events: [
        {
          seq: 1,
          deviceClock: "t",
          type: "FOO",
          payload: { outboundOrderId: "o1" },
        },
      ],
    });
    expect(r.ok).toBe(false);
  });
});
