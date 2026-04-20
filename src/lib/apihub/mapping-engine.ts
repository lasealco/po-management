export type ApiHubMappingTransform =
  | "identity"
  | "trim"
  | "upper"
  | "lower"
  | "number"
  | "iso_date";

export type ApiHubMappingRule = {
  targetField: string;
  sourcePath: string;
  required?: boolean;
  transform?: ApiHubMappingTransform;
};

export type ApiHubMappingIssue = {
  field: string;
  code: "MISSING_REQUIRED" | "INVALID_NUMBER" | "INVALID_DATE" | "UNSUPPORTED_VALUE";
  message: string;
};

export type ApiHubMappingRecordResult = {
  mapped: Record<string, unknown>;
  issues: ApiHubMappingIssue[];
};

function tokenizePath(path: string): string[] {
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function getPathValue(input: unknown, sourcePath: string): unknown {
  const tokens = tokenizePath(sourcePath);
  let current: unknown = input;
  for (const token of tokens) {
    if (current == null) {
      return undefined;
    }
    if (Array.isArray(current)) {
      const idx = Number(token);
      current = Number.isInteger(idx) ? current[idx] : undefined;
      continue;
    }
    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[token];
      continue;
    }
    return undefined;
  }
  return current;
}

function applyTransform(value: unknown, transform: ApiHubMappingTransform): { value: unknown; issue?: ApiHubMappingIssue } {
  if (value == null) {
    return { value: null };
  }
  switch (transform) {
    case "identity":
      return { value };
    case "trim":
      return { value: typeof value === "string" ? value.trim() : value };
    case "upper":
      return { value: typeof value === "string" ? value.toUpperCase() : value };
    case "lower":
      return { value: typeof value === "string" ? value.toLowerCase() : value };
    case "number": {
      if (typeof value === "number") {
        return { value };
      }
      if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value.trim());
        if (Number.isFinite(parsed)) {
          return { value: parsed };
        }
      }
      return {
        value: null,
        issue: {
          field: "",
          code: "INVALID_NUMBER",
          message: "Value cannot be converted to number.",
        },
      };
    }
    case "iso_date": {
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return { value: value.toISOString() };
      }
      if (typeof value === "string" && value.trim().length > 0) {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
          return { value: parsed.toISOString() };
        }
      }
      return {
        value: null,
        issue: {
          field: "",
          code: "INVALID_DATE",
          message: "Value cannot be converted to ISO date.",
        },
      };
    }
    default:
      return {
        value: null,
        issue: {
          field: "",
          code: "UNSUPPORTED_VALUE",
          message: "Unsupported transform.",
        },
      };
  }
}

export function applyApiHubMappingRules(
  input: unknown,
  rules: ApiHubMappingRule[],
): ApiHubMappingRecordResult {
  const mapped: Record<string, unknown> = {};
  const issues: ApiHubMappingIssue[] = [];

  for (const rule of rules) {
    const raw = getPathValue(input, rule.sourcePath);
    const missing = raw === undefined || raw === null || (typeof raw === "string" && raw.trim().length === 0);
    if (missing && rule.required) {
      issues.push({
        field: rule.targetField,
        code: "MISSING_REQUIRED",
        message: `Required source value missing at path '${rule.sourcePath}'.`,
      });
      mapped[rule.targetField] = null;
      continue;
    }

    const transform = rule.transform ?? "identity";
    const transformed = applyTransform(raw, transform);
    if (transformed.issue) {
      issues.push({ ...transformed.issue, field: rule.targetField });
    }
    mapped[rule.targetField] = transformed.value;
  }

  return { mapped, issues };
}

export function applyApiHubMappingRulesBatch(
  records: unknown[],
  rules: ApiHubMappingRule[],
): ApiHubMappingRecordResult[] {
  return records.map((record) => applyApiHubMappingRules(record, rules));
}
