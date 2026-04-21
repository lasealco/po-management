import { describe, expect, it } from "vitest";

import { redactTwinSensitivePayload, TWIN_SENSITIVE_REDACTED_VALUE } from "@/lib/supply-chain-twin/redact-sensitive-payload";

describe("redactTwinSensitivePayload", () => {
  it("redacts sensitive key names recursively", () => {
    const input = {
      token: "abc123",
      nested: {
        apiKey: "key",
        keep: 42,
        arr: [{ password: "x" }, { safe: "ok" }],
      },
      safe: "value",
    };

    expect(redactTwinSensitivePayload(input)).toEqual({
      token: TWIN_SENSITIVE_REDACTED_VALUE,
      nested: {
        apiKey: TWIN_SENSITIVE_REDACTED_VALUE,
        keep: 42,
        arr: [{ password: TWIN_SENSITIVE_REDACTED_VALUE }, { safe: "ok" }],
      },
      safe: "value",
    });
  });

  it("preserves non-object values", () => {
    expect(redactTwinSensitivePayload("plain")).toBe("plain");
    expect(redactTwinSensitivePayload(17)).toBe(17);
    expect(redactTwinSensitivePayload(null)).toBe(null);
  });
});
