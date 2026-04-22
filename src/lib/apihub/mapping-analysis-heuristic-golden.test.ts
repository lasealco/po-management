import { describe, expect, it } from "vitest";

import { APIHUB_MAPPING_ANALYSIS_ENGINE_HEURISTIC } from "@/lib/apihub/constants";
import { inferApiHubMappingAnalysisProposal } from "@/lib/apihub/mapping-analysis-heuristic";

/** Golden regression cases for P2 — deterministic heuristic only (no LLM). */
describe("inferApiHubMappingAnalysisProposal (golden fixtures)", () => {
  it("uses engine constant v2+", () => {
    const r = inferApiHubMappingAnalysisProposal([{ a: 1 }], null);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.proposal.engine).toBe(APIHUB_MAPPING_ANALYSIS_ENGINE_HEURISTIC);
    expect(r.proposal.engine).toMatch(/^deterministic_heuristic_v/);
  });

  it("currency when amounts use symbols or thousands commas", () => {
    const r = inferApiHubMappingAnalysisProposal(
      [
        { price: "$12.50", qty: "1,000.00" },
        { price: "€ 3.25", qty: 2000 },
      ],
      null,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const byPath = new Map(r.proposal.rules.map((x) => [x.sourcePath, x]));
    expect(byPath.get("price")?.transform).toBe("currency");
    expect(byPath.get("qty")?.transform).toBe("currency");
  });

  it("number for plain decimals without currency decoration", () => {
    const r = inferApiHubMappingAnalysisProposal([{ x: "12.5" }, { x: "13" }], null);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.proposal.rules.find((rule) => rule.sourcePath === "x")?.transform).toBe("number");
  });

  it("iso_date for ISO-like date strings", () => {
    const r = inferApiHubMappingAnalysisProposal(
      [{ d: "2026-04-22" }, { d: "2026-04-23T12:00:00Z" }],
      null,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.proposal.rules.find((rule) => rule.sourcePath === "d")?.transform).toBe("iso_date");
  });

  it("boolean for yes/no style strings", () => {
    const r = inferApiHubMappingAnalysisProposal([{ ok: "yes" }, { ok: "NO" }], null);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.proposal.rules.find((rule) => rule.sourcePath === "ok")?.transform).toBe("boolean");
  });

  it("marks required when field present in every record", () => {
    const r = inferApiHubMappingAnalysisProposal([{ a: 1, b: 2 }, { a: 3, b: 4 }], null);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const a = r.proposal.rules.find((rule) => rule.sourcePath === "a");
    const b = r.proposal.rules.find((rule) => rule.sourcePath === "b");
    expect(a?.required).toBe(true);
    expect(b?.required).toBe(true);
  });

  it("marks required false when optional field missing in some rows", () => {
    const r = inferApiHubMappingAnalysisProposal([{ a: 1, b: 2 }, { a: 3 }], null);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.proposal.rules.find((rule) => rule.sourcePath === "a")?.required).toBe(true);
    expect(r.proposal.rules.find((rule) => rule.sourcePath === "b")?.required).toBe(false);
  });

  it("expands first row of array to [0] paths", () => {
    const r = inferApiHubMappingAnalysisProposal(
      [{ items: [{ sku: "A", qty: 1 }, { sku: "B", qty: 2 }] }],
      null,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = r.proposal.rules.map((x) => x.sourcePath).sort();
    expect(paths).toContain("items[0].sku");
    expect(paths).toContain("items[0].qty");
  });

  it("stable targetField from path when no hints", () => {
    const r = inferApiHubMappingAnalysisProposal([{ "order-meta": { ref_id: "x" } }], null);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const rule = r.proposal.rules.find((x) => x.sourcePath === "order-meta.ref_id");
    expect(rule?.targetField).toBe("order_meta_ref_id");
  });
});

describe("LLM prompt version (P2 traceability)", () => {
  it("exports a non-empty version token", async () => {
    const { APIHUB_MAPPING_ANALYSIS_LLM_PROMPT_VERSION } = await import("./mapping-analysis-llm");
    expect(typeof APIHUB_MAPPING_ANALYSIS_LLM_PROMPT_VERSION).toBe("string");
    expect(APIHUB_MAPPING_ANALYSIS_LLM_PROMPT_VERSION.length).toBeGreaterThan(4);
  });
});
