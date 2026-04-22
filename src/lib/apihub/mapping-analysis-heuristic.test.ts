import { describe, expect, it } from "vitest";

import { APIHUB_MAPPING_ANALYSIS_ENGINE_HEURISTIC } from "@/lib/apihub/constants";
import { inferApiHubMappingAnalysisProposal } from "@/lib/apihub/mapping-analysis-heuristic";

describe("inferApiHubMappingAnalysisProposal", () => {
  it("rejects empty records", () => {
    const r = inferApiHubMappingAnalysisProposal([], null);
    expect(r.ok).toBe(false);
  });

  it("proposes rules for nested sample records", () => {
    const r = inferApiHubMappingAnalysisProposal(
      [
        { shipment: { id: " sh-1 " }, totals: { amount: "42.5" } },
        { shipment: { id: "sh-2" }, totals: { amount: 10 } },
      ],
      null,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.proposal.engine).toBe(APIHUB_MAPPING_ANALYSIS_ENGINE_HEURISTIC);
    const byPath = new Map(r.proposal.rules.map((x) => [x.sourcePath, x]));
    expect(byPath.get("shipment.id")?.transform).toBe("trim");
    expect(byPath.get("totals.amount")?.transform).toBe("number");
  });

  it("applies target field hints in order", () => {
    const r = inferApiHubMappingAnalysisProposal([{ a: 1, b: 2 }], ["alpha", "beta"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.proposal.rules.map((x) => x.targetField)).toEqual(["alpha", "beta"]);
  });
});
