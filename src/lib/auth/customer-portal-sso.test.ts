import { describe, expect, it, vi } from "vitest";

import {
  customerPortalSsoCanonicalPayload,
  signCustomerPortalSsoPayload,
  verifyCustomerPortalSsoPayload,
} from "@/lib/auth/customer-portal-sso";

describe("customer-portal-sso", () => {
  it("canonical payload is stable", () => {
    expect(customerPortalSsoCanonicalPayload("sub1", "A@b.com", 1700000000000)).toBe(
      "sub1\na@b.com\n1700000000000",
    );
  });

  it("accepts valid HMAC assertion", () => {
    const secret = "test-secret";
    const ts = Date.now();
    const sig = signCustomerPortalSsoPayload(secret, "idp-sub", "user@example.com", ts);
    expect(verifyCustomerPortalSsoPayload(secret, "idp-sub", "user@example.com", ts, sig)).toBe(true);
  });

  it("rejects skewed timestamp", () => {
    const secret = "test-secret";
    const ts = Date.now() - 400_000;
    const sig = signCustomerPortalSsoPayload(secret, "idp-sub", "user@example.com", ts);
    expect(verifyCustomerPortalSsoPayload(secret, "idp-sub", "user@example.com", ts, sig)).toBe(false);
  });

  it("rejects wrong signature", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    try {
      const secret = "test-secret";
      const ts = Date.now();
      const sig = signCustomerPortalSsoPayload(secret, "idp-sub", "user@example.com", ts);
      expect(verifyCustomerPortalSsoPayload(secret, "other", "user@example.com", ts, sig)).toBe(false);
    } finally {
      vi.restoreAllMocks();
    }
  });
});
