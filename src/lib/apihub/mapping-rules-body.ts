import type { ApiHubValidationIssue } from "@/lib/apihub/api-error";
import type { ApiHubMappingRule } from "@/lib/apihub/mapping-engine";

/** Normalize `rules` from a JSON body (mapping preview, templates, etc.). */
export function normalizeApiHubMappingRulesBody(input: unknown): {
  rules: ApiHubMappingRule[];
  issues: ApiHubValidationIssue[];
} {
  const issues: ApiHubValidationIssue[] = [];
  if (!Array.isArray(input)) {
    return {
      rules: [],
      issues: [{ field: "rules", code: "INVALID_TYPE", message: "rules must be an array.", severity: "error" }],
    };
  }

  const rules: ApiHubMappingRule[] = [];
  input.forEach((row, idx) => {
    if (!row || typeof row !== "object") {
      issues.push({
        field: `rules[${idx}]`,
        code: "INVALID_TYPE",
        message: "rule must be an object.",
        severity: "error",
      });
      return;
    }
    const record = row as Record<string, unknown>;
    const sourcePath = typeof record.sourcePath === "string" ? record.sourcePath.trim() : "";
    const targetField = typeof record.targetField === "string" ? record.targetField.trim() : "";
    const transformRaw = record.transform;
    const transform =
      typeof transformRaw === "string" && transformRaw.trim().length > 0 ? transformRaw.trim().toLowerCase() : undefined;
    const required = record.required === true;

    if (!sourcePath) {
      issues.push({
        field: `rules[${idx}].sourcePath`,
        code: "REQUIRED",
        message: "sourcePath is required.",
        severity: "error",
      });
    }
    if (!targetField) {
      issues.push({
        field: `rules[${idx}].targetField`,
        code: "REQUIRED",
        message: "targetField is required.",
        severity: "error",
      });
    }
    if (
      transform &&
      !["identity", "trim", "upper", "lower", "number", "iso_date", "boolean", "currency"].includes(transform)
    ) {
      issues.push({
        field: `rules[${idx}].transform`,
        code: "INVALID_ENUM",
        message:
          "transform must be one of: identity, trim, upper, lower, number, iso_date, boolean, currency.",
        severity: "error",
      });
    }
    if (sourcePath && targetField) {
      rules.push({
        sourcePath,
        targetField,
        required,
        transform: transform as ApiHubMappingRule["transform"],
      });
    }
  });
  return { rules, issues };
}
