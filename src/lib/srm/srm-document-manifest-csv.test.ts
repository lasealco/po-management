import { describe, expect, it } from "vitest";

import { buildSrmDocumentManifestCsv, escapeSrmManifestCsvCell } from "./srm-document-manifest-csv";

describe("escapeSrmManifestCsvCell", () => {
  it("quotes and escapes embedded quotes", () => {
    expect(escapeSrmManifestCsvCell('a,b')).toBe('"a,b"');
    expect(escapeSrmManifestCsvCell('say "hi"')).toBe('"say ""hi"""');
  });
});

describe("buildSrmDocumentManifestCsv", () => {
  it("outputs header and rows without fileUrl column", () => {
    const csv = buildSrmDocumentManifestCsv(
      { name: "N", code: "C" },
      [
        {
          id: "d1",
          documentType: "other",
          status: "active",
          title: null,
          fileName: "f.pdf",
          fileSize: 5,
          revisionGroupId: "rg1",
          revisionNumber: 1,
          supersedesDocumentId: null,
          expiresAt: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-02T00:00:00.000Z"),
          uploadedBy: { id: "u1", name: "U", email: "u@x.com" },
          lastModifiedBy: { id: "u2", name: "V", email: "v@x.com" },
        },
      ],
    );
    const lines = csv.split("\n");
    expect(lines[0]).toContain("supplierName");
    expect(lines[0]).toContain("uploadedByEmail");
    expect(lines[0]).toContain("uploadedByName");
    expect(lines[0]).toContain("lastModifiedByName");
    expect(lines[0]).not.toContain("fileUrl");
    expect(lines[1]).toContain("N,C,d1");
    expect(lines[1]).toContain("u@x.com,U,");
    expect(lines[1]).toContain("v@x.com,V");
  });
});
