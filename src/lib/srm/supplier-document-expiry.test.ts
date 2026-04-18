import { describe, expect, it } from "vitest";

import {
  DOCUMENT_EXPIRY_CRITICAL_DAYS,
  DOCUMENT_EXPIRY_SOON_DAYS,
  supplierDocumentDaysUntilExpiry,
  supplierDocumentExpiryBadge,
  supplierDocumentExpirySummaryPhrase,
} from "./supplier-document-expiry";

describe("supplierDocumentExpiryBadge", () => {
  it("returns null when no expiry", () => {
    expect(supplierDocumentExpiryBadge(null)).toBeNull();
  });

  it("returns expired when past", () => {
    expect(supplierDocumentExpiryBadge("2020-01-01T00:00:00.000Z", Date.UTC(2021, 0, 1))).toBe(
      "expired",
    );
  });

  it("returns expires_critical within critical window", () => {
    const now = Date.UTC(2026, 0, 1);
    const in10d = new Date(now + 10 * 86400000).toISOString();
    expect(supplierDocumentExpiryBadge(in10d, now)).toBe("expires_critical");
  });

  it("returns expires_soon when beyond critical but within soon window", () => {
    const now = Date.UTC(2026, 0, 1);
    const in20d = new Date(now + 20 * 86400000).toISOString();
    expect(supplierDocumentExpiryBadge(in20d, now)).toBe("expires_soon");
  });

  it("returns null when beyond soon window", () => {
    const now = Date.UTC(2026, 0, 1);
    const in60d = new Date(now + 60 * 86400000).toISOString();
    expect(supplierDocumentExpiryBadge(in60d, now)).toBeNull();
  });

  it("respects custom windows", () => {
    const now = Date.UTC(2026, 0, 1);
    const in2d = new Date(now + 2 * 86400000).toISOString();
    expect(supplierDocumentExpiryBadge(in2d, now, { soonDays: 7, criticalDays: 3 })).toBe(
      "expires_critical",
    );
    const in5d = new Date(now + 5 * 86400000).toISOString();
    expect(supplierDocumentExpiryBadge(in5d, now, { soonDays: 7, criticalDays: 3 })).toBe(
      "expires_soon",
    );
  });
});

describe("supplierDocumentDaysUntilExpiry", () => {
  it("returns negative when expired", () => {
    const now = Date.UTC(2026, 0, 10);
    const past = new Date(now - 3 * 86400000).toISOString();
    expect(supplierDocumentDaysUntilExpiry(past, now)).toBe(-3);
  });
});

describe("supplierDocumentExpirySummaryPhrase", () => {
  it("describes critical window", () => {
    const now = Date.UTC(2026, 0, 1);
    const in7d = new Date(now + 7 * 86400000).toISOString();
    const p = supplierDocumentExpirySummaryPhrase(in7d, now);
    expect(p).toContain("7");
    expect(p).toContain(String(DOCUMENT_EXPIRY_CRITICAL_DAYS));
  });

  it("describes soon window", () => {
    const now = Date.UTC(2026, 0, 1);
    const in20d = new Date(now + 20 * 86400000).toISOString();
    const p = supplierDocumentExpirySummaryPhrase(in20d, now);
    expect(p).toContain("20");
    expect(p).toContain(String(DOCUMENT_EXPIRY_SOON_DAYS));
  });
});
