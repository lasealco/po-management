import { describe, expect, it } from "vitest";

import {
  activeDocumentNeedsComplianceAttention,
  complianceDocumentReadinessScore,
  listComplianceDocumentFindings,
  listMissingControlledDocumentTypes,
  summarizeComplianceDocumentSignals,
  supplierHasMissingControlledDocumentSlots,
} from "./supplier-compliance-document-signals";

describe("summarizeComplianceDocumentSignals", () => {
  const now = Date.UTC(2026, 5, 1);

  it("counts expired, critical, and soon", () => {
    const past = new Date(now - 86400000).toISOString();
    const in10d = new Date(now + 10 * 86400000).toISOString();
    const in20d = new Date(now + 20 * 86400000).toISOString();
    const s = summarizeComplianceDocumentSignals(
      [
        { category: "insurance", expiresAt: past, archivedAt: null },
        { category: "commercial_other", expiresAt: in10d, archivedAt: null },
        { category: "commercial_other", expiresAt: in20d, archivedAt: null },
      ],
      now,
    );
    expect(s.expired).toBe(1);
    expect(s.expiresCritical).toBe(1);
    expect(s.expiresSoon).toBe(1);
    expect(s.missingExpiryControlled).toBe(0);
    expect(s.missingControlledSlots).toBe(2);
    expect(s.activeTotal).toBe(3);
    expect(s.archivedTotal).toBe(0);
  });

  it("flags controlled categories missing expiry", () => {
    const s = summarizeComplianceDocumentSignals(
      [{ category: "license", expiresAt: null, archivedAt: null }],
      now,
    );
    expect(s.missingExpiryControlled).toBe(1);
    expect(s.missingControlledSlots).toBe(2);
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

describe("listMissingControlledDocumentTypes", () => {
  it("returns all three when no active controlled rows", () => {
    expect(
      listMissingControlledDocumentTypes([
        { category: "commercial_other", archivedAt: null },
      ]).length,
    ).toBe(3);
  });

  it("returns empty when all controlled categories present", () => {
    expect(
      listMissingControlledDocumentTypes([
        { category: "insurance", archivedAt: null },
        { category: "license", archivedAt: null },
        { category: "certificate", archivedAt: null },
      ]),
    ).toEqual([]);
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
    expect(f.map((x) => x.kind)).toEqual(["expired", "missing_expiry", "missing_document"]);
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
    expect(f.map((x) => x.kind)).toEqual([
      "missing_document",
      "missing_document",
      "missing_document",
    ]);
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

  it("returns true for expires_critical", () => {
    const in7d = new Date(now + 7 * 86400000).toISOString();
    expect(
      activeDocumentNeedsComplianceAttention(
        { category: "commercial_other", expiresAt: in7d, archivedAt: null },
        now,
      ),
    ).toBe(true);
  });
});

describe("supplierHasMissingControlledDocumentSlots", () => {
  it("detects gaps", () => {
    expect(
      supplierHasMissingControlledDocumentSlots([{ category: "commercial_other", archivedAt: null }]),
    ).toBe(true);
  });
});

describe("complianceDocumentReadinessScore", () => {
  it("returns 100 for clean summary", () => {
    expect(
      complianceDocumentReadinessScore({
        activeTotal: 2,
        archivedTotal: 0,
        expired: 0,
        expiresCritical: 0,
        expiresSoon: 0,
        missingExpiryControlled: 0,
        missingControlledSlots: 0,
      }),
    ).toBe(100);
  });

  it("drops with penalties", () => {
    const s = {
      activeTotal: 5,
      archivedTotal: 0,
      expired: 1,
      expiresCritical: 1,
      expiresSoon: 0,
      missingExpiryControlled: 0,
      missingControlledSlots: 0,
    };
    expect(complianceDocumentReadinessScore(s)).toBeLessThan(100);
  });
});
