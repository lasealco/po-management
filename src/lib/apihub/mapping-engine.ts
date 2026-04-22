import type { ApiHubValidationIssue } from "@/lib/apihub/api-error";

export type ApiHubMappingTransform =
  | "identity"
  | "trim"
  | "upper"
  | "lower"
  | "number"
  | "iso_date"
  | "boolean"
  | "currency";

export type ApiHubMappingRule = {
  targetField: string;
  sourcePath: string;
  required?: boolean;
  transform?: ApiHubMappingTransform;
};

export type ApiHubMappingIssueSeverity = "error" | "warn" | "info";

export type ApiHubMappingIssue = {
  field: string;
  code:
    | "MISSING_REQUIRED"
    | "INVALID_NUMBER"
    | "INVALID_DATE"
    | "UNSUPPORTED_VALUE"
    | "INVALID_BOOLEAN"
    | "INVALID_CURRENCY"
    | "COERCION_NON_STRING";
  message: string;
  severity: ApiHubMappingIssueSeverity;
};

export type ApiHubMappingRecordResult = {
  mapped: Record<string, unknown>;
  issues: ApiHubMappingIssue[];
};

/**
 * Returns `null` when the path is safe for {@link getApiHubMappingPathValue}; otherwise a short human message.
 * Bracket indices must be numeric (`[0]`). Segments are dot-separated identifiers or array indices.
 */
export function validateApiHubMappingSourcePathSyntax(sourcePath: string): string | null {
  const t = sourcePath.trim();
  if (!t) {
    return "sourcePath cannot be empty.";
  }
  if (/\s/.test(t)) {
    return "sourcePath cannot contain whitespace.";
  }
  if (t.includes("..")) {
    return "sourcePath cannot contain empty segments ('..').";
  }
  if (t.startsWith(".") || t.endsWith(".")) {
    return "sourcePath cannot start or end with a dot.";
  }
  const normalized = t.replace(/\[(\d+)\]/g, ".$1");
  if (normalized.includes("..")) {
    return "sourcePath cannot contain consecutive dots.";
  }
  const parts = normalized.split(".").map((s) => s.trim());
  if (parts.some((p) => !p)) {
    return "sourcePath has an empty segment.";
  }
  for (const p of parts) {
    if (/^\d+$/.test(p)) {
      continue;
    }
    if (/^[A-Za-z_][A-Za-z0-9_-]*$/.test(p)) {
      continue;
    }
    return `Invalid path segment '${p}' (use letters, numbers, underscore, hyphen, or numeric indices).`;
  }
  return null;
}

/**
 * Cross-rule checks on the raw `rules` array: duplicate `targetField` and invalid `sourcePath` shapes.
 */
export function validateApiHubMappingRulesInput(rows: unknown[]): ApiHubValidationIssue[] {
  const issues: ApiHubValidationIssue[] = [];
  if (!Array.isArray(rows)) {
    return issues;
  }

  const targetFirstIndex = new Map<string, number>();

  rows.forEach((row, idx) => {
    if (!row || typeof row !== "object") {
      return;
    }
    const record = row as Record<string, unknown>;
    const sourcePath = typeof record.sourcePath === "string" ? record.sourcePath : "";
    const targetField = typeof record.targetField === "string" ? record.targetField.trim() : "";

    if (sourcePath.trim().length > 0) {
      const pathMsg = validateApiHubMappingSourcePathSyntax(sourcePath);
      if (pathMsg) {
        issues.push({
          field: `rules[${idx}].sourcePath`,
          code: "INVALID_SOURCE_PATH",
          message: pathMsg,
          severity: "error",
        });
      }
    }

    if (targetField.length > 0) {
      const prev = targetFirstIndex.get(targetField);
      if (prev !== undefined) {
        issues.push({
          field: `rules[${idx}].targetField`,
          code: "DUPLICATE_TARGET",
          message: `targetField duplicates rules[${prev}].targetField.`,
          severity: "error",
        });
      } else {
        targetFirstIndex.set(targetField, idx);
      }
    }
  });

  return issues;
}

function tokenizePath(path: string): string[] {
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

/**
 * Parses booleans deterministically: boolean passthrough; numbers 0/1; strings (trimmed, case-insensitive)
 * true: true, 1, yes, y, on — false: false, 0, no, n, off.
 */
function parseBooleanDeterministic(value: unknown): { value: boolean } | { issue: ApiHubMappingIssue } {
  if (typeof value === "boolean") {
    return { value };
  }
  if (typeof value === "number") {
    if (value === 1) return { value: true };
    if (value === 0) return { value: false };
  }
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes" || s === "y" || s === "on") {
      return { value: true };
    }
    if (s === "false" || s === "0" || s === "no" || s === "n" || s === "off") {
      return { value: false };
    }
  }
  return {
    issue: {
      field: "",
      code: "INVALID_BOOLEAN",
      message: "Value cannot be converted to boolean (use true/false, 0/1, yes/no, y/n, on/off).",
      severity: "error",
    },
  };
}

/**
 * Parses currency amounts to a finite number. US-style only: commas are thousands separators (removed),
 * dot is the decimal separator. Currency symbols ($ € £ ¥) and spaces are stripped. Plain finite numbers pass through.
 */
function parseCurrencyDeterministic(value: unknown): { value: number } | { issue: ApiHubMappingIssue } {
  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      return { value };
    }
    return {
      issue: {
        field: "",
        code: "INVALID_CURRENCY",
        message: "Numeric amount must be finite.",
        severity: "error",
      },
    };
  }
  if (typeof value !== "string") {
    return {
      issue: {
        field: "",
        code: "INVALID_CURRENCY",
        message: "Currency transform expects a string or number.",
        severity: "error",
      },
    };
  }
  const trimmed = value.trim();
  if (!trimmed.length) {
    return {
      issue: {
        field: "",
        code: "INVALID_CURRENCY",
        message: "Currency string is empty.",
        severity: "error",
      },
    };
  }
  const normalized = trimmed.replace(/[\s$€£¥\u00a0]/g, "").replace(/,/g, "");
  const n = Number(normalized);
  if (!Number.isFinite(n)) {
    return {
      issue: {
        field: "",
        code: "INVALID_CURRENCY",
        message: "Value cannot be parsed as a US-style currency amount (commas = thousands, dot = decimal).",
        severity: "error",
      },
    };
  }
  return { value: n };
}

export function getApiHubMappingPathValue(input: unknown, sourcePath: string): unknown {
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
    case "trim": {
      if (typeof value === "string") {
        return { value: value.trim() };
      }
      return {
        value,
        issue: {
          field: "",
          code: "COERCION_NON_STRING",
          message: "trim expected a string; value left unchanged.",
          severity: "warn",
        },
      };
    }
    case "upper": {
      if (typeof value === "string") {
        return { value: value.toUpperCase() };
      }
      return {
        value,
        issue: {
          field: "",
          code: "COERCION_NON_STRING",
          message: "upper expected a string; value left unchanged.",
          severity: "warn",
        },
      };
    }
    case "lower": {
      if (typeof value === "string") {
        return { value: value.toLowerCase() };
      }
      return {
        value,
        issue: {
          field: "",
          code: "COERCION_NON_STRING",
          message: "lower expected a string; value left unchanged.",
          severity: "warn",
        },
      };
    }
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
          severity: "error",
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
          severity: "error",
        },
      };
    }
    case "boolean": {
      const parsed = parseBooleanDeterministic(value);
      if ("issue" in parsed) {
        return { value: null, issue: parsed.issue };
      }
      return { value: parsed.value };
    }
    case "currency": {
      const parsed = parseCurrencyDeterministic(value);
      if ("issue" in parsed) {
        return { value: null, issue: parsed.issue };
      }
      return { value: parsed.value };
    }
    default:
      return {
        value: null,
        issue: {
          field: "",
          code: "UNSUPPORTED_VALUE",
          message: "Unsupported transform.",
          severity: "error",
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
    const raw = getApiHubMappingPathValue(input, rule.sourcePath);
    const missing = raw === undefined || raw === null || (typeof raw === "string" && raw.trim().length === 0);
    if (missing && rule.required) {
      issues.push({
        field: rule.targetField,
        code: "MISSING_REQUIRED",
        message: `Required source value missing at path '${rule.sourcePath}'.`,
        severity: "error",
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
