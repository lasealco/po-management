import { describe, expect, it } from "vitest";
import { z } from "zod";

import { firstZodFieldError } from "./first-zod-error";

describe("firstZodFieldError", () => {
  it("prefers first matching field key message", () => {
    const schema = z.object({
      one: z.string().min(2),
      two: z.number().int(),
    });
    const parsed = schema.safeParse({ one: "", two: 1.2 });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    expect(firstZodFieldError(parsed.error, ["two", "one"])).toMatch(/expected int/i);
    expect(firstZodFieldError(parsed.error, ["one", "two"])).toMatch(/>=2 characters/i);
  });

  it("falls back to generic zod message when keys are absent", () => {
    const schema = z.object({ value: z.string() });
    const parsed = schema.safeParse(null);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const msg = firstZodFieldError(parsed.error, ["missing"]);
    expect(typeof msg).toBe("string");
    expect(msg.length).toBeGreaterThan(0);
  });
});
