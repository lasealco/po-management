import { describe, expect, it } from "vitest";

import { scriIngestBodySchema } from "@/lib/scri/schemas/ingest-body";
import { scriIngestSourcesHavePublicHttpsUrls } from "@/lib/scri/scri-ingest-ai-llm";

describe("scriIngestSourcesHavePublicHttpsUrls", () => {
  it("is false without https URL", () => {
    const body = scriIngestBodySchema.parse({
      ingestKey: "k",
      eventType: "PORT_CONGESTION",
      title: "T",
      severity: "LOW",
      sources: [{ sourceType: "news", headline: "H" }],
    });
    expect(scriIngestSourcesHavePublicHttpsUrls(body)).toBe(false);
  });

  it("is true when any source has https URL", () => {
    const body = scriIngestBodySchema.parse({
      ingestKey: "k2",
      eventType: "PORT_CONGESTION",
      title: "T",
      severity: "LOW",
      sources: [
        { sourceType: "news", headline: "H" },
        { sourceType: "wire", url: "https://example.com/article" },
      ],
    });
    expect(scriIngestSourcesHavePublicHttpsUrls(body)).toBe(true);
  });

  it("rejects http-only (require https)", () => {
    const body = scriIngestBodySchema.parse({
      ingestKey: "k3",
      eventType: "PORT_CONGESTION",
      title: "T",
      severity: "LOW",
      sources: [{ sourceType: "news", url: "http://example.com/a" }],
    });
    expect(scriIngestSourcesHavePublicHttpsUrls(body)).toBe(false);
  });
});
