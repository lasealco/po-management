import { describe, expect, it } from "vitest";

import {
  normalizeIngestionApplyRowsFromBody,
  parseIngestionRunApplyRowsFromResultSummary,
  resolveIngestionApplyMappedRows,
} from "./ingestion-apply-rows";

describe("ingestion-apply-rows", () => {
  it("parses rows from resultSummary JSON", () => {
    const rows = parseIngestionRunApplyRowsFromResultSummary(
      JSON.stringify({
        rows: [{ rowIndex: 1, mappedRecord: { customerCrmAccountId: "crm-1" } }],
      }),
    );
    expect(rows).toEqual([{ rowIndex: 1, mappedRecord: { customerCrmAccountId: "crm-1" } }]);
  });

  it("accepts applyRows alias", () => {
    const rows = parseIngestionRunApplyRowsFromResultSummary(
      JSON.stringify({
        applyRows: [{ mappedRecord: { a: 1 } }],
      }),
    );
    expect(rows).toEqual([{ rowIndex: 0, mappedRecord: { a: 1 } }]);
  });

  it("resolveIngestionApplyMappedRows prefers body over resultSummary", () => {
    const r = resolveIngestionApplyMappedRows({
      bodyRows: [{ mappedRecord: { x: 1 } }],
      resultSummary: JSON.stringify({ rows: [{ mappedRecord: { y: 2 } }] }),
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.source).toBe("body");
      expect(r.rows).toEqual([{ rowIndex: 0, mappedRecord: { x: 1 } }]);
    }
  });

  it("normalizeIngestionApplyRowsFromBody rejects non-array", () => {
    const r = normalizeIngestionApplyRowsFromBody({});
    expect(r.ok).toBe(false);
  });
});
