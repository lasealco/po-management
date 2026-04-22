import { describe, expect, it } from "vitest";

import { APIHUB_MAPPING_ANALYSIS_MAX_RECORDS, APIHUB_MAPPING_ANALYSIS_NOTE_MAX } from "@/lib/apihub/constants";
import { parseApiHubMappingAnalysisJobCreateBody } from "@/lib/apihub/mapping-analysis-job-create-body";

describe("parseApiHubMappingAnalysisJobCreateBody", () => {
  it("accepts valid body", () => {
    const p = parseApiHubMappingAnalysisJobCreateBody({
      records: [{ x: 1 }],
      targetFields: ["alpha"],
      note: "hello",
    });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.value.records).toEqual([{ x: 1 }]);
    expect(p.value.targetFields).toEqual(["alpha"]);
    expect(p.value.note).toBe("hello");
  });

  it("rejects too many records", () => {
    const records = Array.from({ length: APIHUB_MAPPING_ANALYSIS_MAX_RECORDS + 1 }, () => ({}));
    const p = parseApiHubMappingAnalysisJobCreateBody({ records });
    expect(p.ok).toBe(false);
  });

  it("rejects note over cap", () => {
    const p = parseApiHubMappingAnalysisJobCreateBody({
      records: [{ x: 1 }],
      note: "n".repeat(APIHUB_MAPPING_ANALYSIS_NOTE_MAX + 1),
    });
    expect(p.ok).toBe(false);
  });
});
