import { describe, expect, it } from "vitest";

import { supplierDocumentExpiryBadge } from "./supplier-document-expiry";

describe("supplierDocumentExpiryBadge", () => {
  it("returns null when no expiry", () => {
    expect(supplierDocumentExpiryBadge(null)).toBeNull();
  });

  it("returns expired when past", () => {
    expect(supplierDocumentExpiryBadge("2020-01-01T00:00:00.000Z", Date.UTC(2021, 0, 1))).toBe("expired");
  });

  it("returns expires_soon within window", () => {
    const now = Date.UTC(2026, 0, 1);
    const in20d = new Date(now + 20 * 86400000).toISOString();
    expect(supplierDocumentExpiryBadge(in20d, now)).toBe("expires_soon");
  });

  it("returns null when beyond soon window", () => {
    const now = Date.UTC(2026, 0, 1);
    const in60d = new Date(now + 60 * 86400000).toISOString();
    expect(supplierDocumentExpiryBadge(in60d, now)).toBeNull();
  });
});
