import { describe, expect, it } from "vitest";

import { scriIngestBodySchema } from "@/lib/scri/schemas/ingest-body";

describe("scriIngestBodySchema", () => {
  it("accepts minimal valid ingest", () => {
    const parsed = scriIngestBodySchema.safeParse({
      ingestKey: "test-key-1",
      eventType: "PORT_CONGESTION",
      title: "Test event",
      severity: "HIGH",
      sources: [{ sourceType: "manual" }],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.confidence).toBe(50);
      expect(parsed.data.sources).toHaveLength(1);
    }
  });

  it("accepts runMatch flag", () => {
    const parsed = scriIngestBodySchema.safeParse({
      ingestKey: "k",
      eventType: "X",
      title: "T",
      severity: "LOW",
      sources: [{ sourceType: "manual" }],
      runMatch: true,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.runMatch).toBe(true);
  });

  it("rejects empty sources", () => {
    const parsed = scriIngestBodySchema.safeParse({
      ingestKey: "k",
      eventType: "X",
      title: "T",
      severity: "LOW",
      sources: [],
    });
    expect(parsed.success).toBe(false);
  });
});
