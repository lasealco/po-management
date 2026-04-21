import { describe, expect, it } from "vitest";

import { TWIN_INGEST_MAX_PAYLOAD_BYTES } from "@/lib/supply-chain-twin/ingest-writer";
import { parseTwinIngestEventAppendBody } from "@/lib/supply-chain-twin/schemas/twin-ingest-event-append";

describe("parseTwinIngestEventAppendBody", () => {
  it("accepts minimal valid body", () => {
    const r = parseTwinIngestEventAppendBody({ type: "  demo.event  ", payload: { a: 1 } });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.body.type).toBe("demo.event");
      expect(r.body.payload).toEqual({ a: 1 });
    }
  });

  it("rejects missing type", () => {
    const r = parseTwinIngestEventAppendBody({ payload: {} });
    expect(r.ok).toBe(false);
  });

  it("rejects oversize payload with flag", () => {
    const pad = "y".repeat(TWIN_INGEST_MAX_PAYLOAD_BYTES + 50);
    const r = parseTwinIngestEventAppendBody({ type: "x", payload: { pad } });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.payloadTooLarge).toBe(true);
    }
  });
});
