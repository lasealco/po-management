import { describe, expect, it } from "vitest";

import { isValidHelpEventId } from "@/lib/help-event-id";

describe("isValidHelpEventId", () => {
  it("accepts UUID v4 strings", () => {
    expect(isValidHelpEventId("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isValidHelpEventId("6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(false); // v1
  });

  it("rejects garbage", () => {
    expect(isValidHelpEventId("")).toBe(false);
    expect(isValidHelpEventId("not-a-uuid")).toBe(false);
  });
});
