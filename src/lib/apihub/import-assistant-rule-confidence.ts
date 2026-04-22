import type { ApiHubMappingRule } from "@/lib/apihub/mapping-engine";

export type ImportAssistantRuleConfidence = "high" | "medium" | "needs_confirmation";

function noteForPath(notes: string[], sourcePath: string): string {
  const prefix = `${sourcePath}:`;
  const hit = notes.find((n) => n.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : "";
}

/**
 * Heuristic confidence for operators — favors explicit transforms; flags identity as needing human confirmation.
 */
export function importAssistantConfidenceForRule(
  rule: ApiHubMappingRule,
  proposalNotes: string[],
): ImportAssistantRuleConfidence {
  const pathNote = noteForPath(proposalNotes, rule.sourcePath);
  const t = rule.transform ?? "identity";

  if (t === "trim" || t === "number" || t === "currency" || t === "iso_date" || t === "boolean") {
    if (pathNote.includes("Inferred") || pathNote.includes("currency") || pathNote.includes("number")) {
      return "high";
    }
    return t === "number" || t === "currency" || t === "iso_date" || t === "boolean" ? "high" : "medium";
  }

  if (t === "identity") {
    if (pathNote.length > 0 && !pathNote.includes("Inferred")) {
      return "medium";
    }
    return "needs_confirmation";
  }

  return "medium";
}
