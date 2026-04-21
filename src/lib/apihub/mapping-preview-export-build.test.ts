import { describe, expect, it } from "vitest";

import { buildMappingPreviewIssuesCsv, escapeCsvCell } from "./mapping-preview-export-build";

describe("escapeCsvCell", () => {
  it("quotes fields that contain commas or quotes", () => {
    expect(escapeCsvCell("ok")).toBe("ok");
    expect(escapeCsvCell('say "hi"')).toBe(`"say ""hi"""`);
    expect(escapeCsvCell("a,b")).toBe(`"a,b"`);
  });
});

describe("buildMappingPreviewIssuesCsv", () => {
  it("emits a marker row when there are no issues", () => {
    const csv = buildMappingPreviewIssuesCsv([{ recordIndex: 0, mapped: {}, issues: [] }]);
    expect(csv).toContain("No mapping issues");
    expect(csv.split("\n")[0]).toBe("recordIndex,field,code,severity,message");
  });

  it("emits one row per issue", () => {
    const csv = buildMappingPreviewIssuesCsv([
      {
        recordIndex: 0,
        mapped: {},
        issues: [
          { field: "x", code: "MISSING_REQUIRED", message: "m", severity: "warn" },
          { field: "y", code: "INVALID_NUMBER", message: "comma,here", severity: "error" },
        ],
      },
    ]);
    const lines = csv.trimEnd().split("\n");
    expect(lines.length).toBe(3);
    expect(csv).toContain("comma,here");
  });
});
