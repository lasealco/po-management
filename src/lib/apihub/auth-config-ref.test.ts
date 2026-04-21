import { describe, expect, it } from "vitest";

import { isApiHubAuthConfigRefFormatAllowed, validateApiHubAuthConfigRefForWrite } from "./auth-config-ref";
import { APIHUB_AUTH_CONFIG_REF_MAX_LEN } from "./constants";

describe("isApiHubAuthConfigRefFormatAllowed", () => {
  it("accepts vault and gsm prefixes", () => {
    expect(isApiHubAuthConfigRefFormatAllowed("vault://mount/kv/foo")).toBe(true);
    expect(isApiHubAuthConfigRefFormatAllowed("gsm://projects/p/secrets/s/versions/1")).toBe(true);
  });

  it("accepts AWS Secrets Manager and SSM parameter ARNs", () => {
    expect(
      isApiHubAuthConfigRefFormatAllowed(
        "arn:aws:secretsmanager:eu-west-1:123456789012:secret:demo/api/key-AbCdEf",
      ),
    ).toBe(true);
    expect(
      isApiHubAuthConfigRefFormatAllowed("arn:aws:ssm:eu-west-1:123456789012:parameter/my/app/TOKEN"),
    ).toBe(true);
  });

  it("rejects bare paths and http URLs", () => {
    expect(isApiHubAuthConfigRefFormatAllowed("/etc/passwd")).toBe(false);
    expect(isApiHubAuthConfigRefFormatAllowed("https://example.com/secret")).toBe(false);
    expect(isApiHubAuthConfigRefFormatAllowed("vault://")).toBe(false);
    expect(isApiHubAuthConfigRefFormatAllowed("gsm://")).toBe(false);
  });
});

describe("validateApiHubAuthConfigRefForWrite", () => {
  it("clears with null or blank string", () => {
    expect(validateApiHubAuthConfigRefForWrite(null)).toEqual({ ok: true, value: null });
    expect(validateApiHubAuthConfigRefForWrite("  \t  ")).toEqual({ ok: true, value: null });
  });

  it("rejects wrong types", () => {
    const r = validateApiHubAuthConfigRefForWrite(123);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("INVALID_TYPE");
    }
    expect(validateApiHubAuthConfigRefForWrite(undefined).ok).toBe(false);
  });

  it("rejects overlong values", () => {
    const r = validateApiHubAuthConfigRefForWrite(`vault://x/${"a".repeat(APIHUB_AUTH_CONFIG_REF_MAX_LEN)}`);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("MAX_LENGTH");
    }
  });

  it("trims and accepts valid refs", () => {
    expect(validateApiHubAuthConfigRefForWrite("  vault://mount/secret  ")).toEqual({
      ok: true,
      value: "vault://mount/secret",
    });
  });

  it("rejects control characters inside strings", () => {
    const r = validateApiHubAuthConfigRefForWrite("vault://mount/\nsecret");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("INVALID_CHAR");
    }
  });
});
