import { describe, expect, it } from "vitest";

import {
  activeDocumentNeedsComplianceAttention,
  listComplianceDocumentFindings,
  summarizeComplianceDocumentSignals,
} from "./supplier-compliance-document-signals";

describe("summarizeComplianceDocumentSignals", () => {
  const now = Date.UTC(2026, 5, 1);

  it("counts expired and soon", () => {
    const past = new Date(now - 86400000).toISOString();
    const in10d = new Date(now + 10 * 86400000).toISOString();
    const s = summarizeComplianceDocumentSignals(
      [
        { category: "insurance", expiresAt: past, archivedAt: null },
        { category: "commercial_other", expiresAt: in10d, archivedAt: null },
      ],
      now,
    );
    expect(s.expired).toBe(1);
    expect(s.expiresSoon).toBe(1);
    expect(s.missingExpiryControlled).toBe(0);
    expect(s.activeTotal).toBe(2);
    expect(s.archivedTotal).toBe(0);
  });

  it("flags controlled categories missing expiry", () => {
    const s = summarizeComplianceDocumentSignals(
      [{ category: "license", expiresAt: null, archivedAt: null }],
      now,
    );
    expect(s.missingExpiryControlled).toBe(1);
    expect(s.expired).toBe(0);
  });

  it("ignores archived rows for readiness counts", () => {
    const past = new Date(now - 86400000).toISOString();
    const s = summarizeComplianceDocumentSignals(
      [
        { category: "insurance", expiresAt: past, archivedAt: "2026-01-01T00:00:00.000Z" },
        { category: "insurance", expiresAt: past, archivedAt: null },
      ],
      now,
    );
    expect(s.archivedTotal).toBe(1);
    expect(s.activeTotal).toBe(1);
    expect(s.expired).toBe(1);
  });
});

describe("listComplianceDocumentFindings", () => {
  const now = Date.UTC(2026, 5, 1);

  it("lists expired and missing expiry separately", () => {
    const past = new Date(now - 86400000).toISOString();
    const f = listComplianceDocumentFindings(
      [
        {
          id: "1",
          title: "COI",
          category: "insurance",
          expiresAt: past,
          archivedAt: null,
        },
        {
          id: "2",
          title: "Permit",
          category: "license",
          expiresAt: null,
          archivedAt: null,
        },
      ],
      now,
    );
    expect(f.map((x) => x.kind)).toEqual(["expired", "missing_expiry"]);
    expect(f[0].title).toBe("COI");
    expect(f[1].title).toBe("Permit");
  });

  it("ignores archived rows", () => {
    const f = listComplianceDocumentFindings(
      [
        {
          id: "1",
          title: "X",
          category: "license",
          expiresAt: null,
          archivedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      now,
    );
    expect(f).toEqual([]);
  });
});

describe("activeDocumentNeedsComplianceAttention", () => {
  const now = Date.UTC(2026, 5, 1);

  it("returns false for archived", () => {
    expect(
      activeDocumentNeedsComplianceAttention(
        { category: "license", expiresAt: null, archivedAt: "2026-01-01T00:00:00.000Z" },
        now,
      ),
    ).toBe(false);
  });

  it("returns true for controlled category without expiry", () => {
    expect(
      activeDocumentNeedsComplianceAttention(
        { category: "certificate", expiresAt: null, archivedAt: null },
        now,
      ),
    ).toBe(true);
  });
});
