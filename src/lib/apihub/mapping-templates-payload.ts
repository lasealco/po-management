import type { ApiHubValidationIssue } from "@/lib/apihub/api-error";
import {
  APIHUB_MAPPING_TEMPLATE_AUDIT_NOTE_MAX,
  APIHUB_MAPPING_TEMPLATE_DESCRIPTION_MAX,
  APIHUB_MAPPING_TEMPLATE_NAME_MAX,
  APIHUB_MAPPING_TEMPLATE_RULES_MAX_COUNT,
} from "@/lib/apihub/constants";

/** POST `/api/apihub/mapping-templates` body shape (validated fields). */
export type MappingTemplateCreateBody = {
  name?: unknown;
  description?: unknown;
  rules?: unknown;
  sourceMappingAnalysisJobId?: unknown;
};

/** Name + description only (e.g. when rules come from a mapping analysis job). */
export function collectMappingTemplateNameDescriptionIssues(
  body: Pick<MappingTemplateCreateBody, "name" | "description">,
): ApiHubValidationIssue[] {
  const issues: ApiHubValidationIssue[] = [];

  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    issues.push({
      field: "name",
      code: "REQUIRED",
      message: "name must be a non-empty string.",
      severity: "error",
    });
  } else if (body.name.trim().length > APIHUB_MAPPING_TEMPLATE_NAME_MAX) {
    issues.push({
      field: "name",
      code: "MAX_LENGTH",
      message: `name must be at most ${APIHUB_MAPPING_TEMPLATE_NAME_MAX} characters.`,
      severity: "error",
    });
  }

  const rawDesc = body.description;
  if (rawDesc !== undefined && rawDesc !== null) {
    if (typeof rawDesc !== "string") {
      issues.push({
        field: "description",
        code: "INVALID_TYPE",
        message: "description must be a string when provided.",
        severity: "error",
      });
    } else if (rawDesc.length > APIHUB_MAPPING_TEMPLATE_DESCRIPTION_MAX) {
      issues.push({
        field: "description",
        code: "MAX_LENGTH",
        message: `description must be at most ${APIHUB_MAPPING_TEMPLATE_DESCRIPTION_MAX} characters.`,
        severity: "error",
      });
    }
  }

  return issues;
}

export function collectMappingTemplateCreateMetaIssues(body: MappingTemplateCreateBody): ApiHubValidationIssue[] {
  const issues: ApiHubValidationIssue[] = collectMappingTemplateNameDescriptionIssues(body);

  if (!Array.isArray(body.rules)) {
    issues.push({
      field: "rules",
      code: "INVALID_TYPE",
      message: "rules must be an array.",
      severity: "error",
    });
    return issues;
  }
  if (body.rules.length === 0) {
    issues.push({
      field: "rules",
      code: "REQUIRED",
      message: "rules must contain at least one rule.",
      severity: "error",
    });
    return issues;
  }
  if (body.rules.length > APIHUB_MAPPING_TEMPLATE_RULES_MAX_COUNT) {
    issues.push({
      field: "rules",
      code: "MAX_ITEMS",
      message: `rules must contain at most ${APIHUB_MAPPING_TEMPLATE_RULES_MAX_COUNT} rules.`,
      severity: "error",
    });
    return issues;
  }

  return issues;
}

export type MappingTemplatePatchBody = {
  name?: unknown;
  description?: unknown;
  rules?: unknown;
  note?: unknown;
};

export function collectMappingTemplatePatchIssues(body: MappingTemplatePatchBody): ApiHubValidationIssue[] {
  const issues: ApiHubValidationIssue[] = [];
  const hasName = Object.prototype.hasOwnProperty.call(body, "name");
  const hasDescription = Object.prototype.hasOwnProperty.call(body, "description");
  const hasRules = Object.prototype.hasOwnProperty.call(body, "rules");
  const hasNote = Object.prototype.hasOwnProperty.call(body, "note");

  if (!hasName && !hasDescription && !hasRules) {
    issues.push({
      field: "body",
      code: "REQUIRED",
      message: "Provide at least one of: name, description, rules.",
      severity: "error",
    });
  }

  if (hasName) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      issues.push({
        field: "name",
        code: "REQUIRED",
        message: "name must be a non-empty string when provided.",
        severity: "error",
      });
    } else if (body.name.trim().length > APIHUB_MAPPING_TEMPLATE_NAME_MAX) {
      issues.push({
        field: "name",
        code: "MAX_LENGTH",
        message: `name must be at most ${APIHUB_MAPPING_TEMPLATE_NAME_MAX} characters.`,
        severity: "error",
      });
    }
  }

  if (hasDescription && body.description !== null) {
    if (typeof body.description !== "string") {
      issues.push({
        field: "description",
        code: "INVALID_TYPE",
        message: "description must be a string or null when provided.",
        severity: "error",
      });
    } else if (body.description.length > APIHUB_MAPPING_TEMPLATE_DESCRIPTION_MAX) {
      issues.push({
        field: "description",
        code: "MAX_LENGTH",
        message: `description must be at most ${APIHUB_MAPPING_TEMPLATE_DESCRIPTION_MAX} characters.`,
        severity: "error",
      });
    }
  }

  if (hasRules) {
    if (!Array.isArray(body.rules)) {
      issues.push({
        field: "rules",
        code: "INVALID_TYPE",
        message: "rules must be an array when provided.",
        severity: "error",
      });
    } else if (body.rules.length === 0) {
      issues.push({
        field: "rules",
        code: "REQUIRED",
        message: "rules must contain at least one rule when provided.",
        severity: "error",
      });
    } else if (body.rules.length > APIHUB_MAPPING_TEMPLATE_RULES_MAX_COUNT) {
      issues.push({
        field: "rules",
        code: "MAX_ITEMS",
        message: `rules must contain at most ${APIHUB_MAPPING_TEMPLATE_RULES_MAX_COUNT} rules.`,
        severity: "error",
      });
    }
  }

  if (hasNote) {
    if (body.note !== null && typeof body.note !== "string") {
      issues.push({
        field: "note",
        code: "INVALID_TYPE",
        message: "note must be a string or null when provided.",
        severity: "error",
      });
    } else if (typeof body.note === "string" && body.note.length > APIHUB_MAPPING_TEMPLATE_AUDIT_NOTE_MAX) {
      issues.push({
        field: "note",
        code: "MAX_LENGTH",
        message: `note must be at most ${APIHUB_MAPPING_TEMPLATE_AUDIT_NOTE_MAX} characters.`,
        severity: "error",
      });
    }
  }

  return issues;
}
