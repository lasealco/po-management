import { describe, expect, it } from "vitest";

import { scriEventTriagePatchSchema } from "@/lib/scri/schemas/event-triage-patch";

describe("scriEventTriagePatchSchema", () => {
  it("accepts reviewState only", () => {
    const r = scriEventTriagePatchSchema.safeParse({ reviewState: "WATCH" });
    expect(r.success).toBe(true);
  });

  it("accepts note only", () => {
    const r = scriEventTriagePatchSchema.safeParse({ note: "Escalated to ops." });
    expect(r.success).toBe(true);
  });

  it("rejects empty patch", () => {
    const r = scriEventTriagePatchSchema.safeParse({});
    expect(r.success).toBe(false);
  });
});
