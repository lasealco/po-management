import {
  apiHubDemoActorMissing,
  apiHubDemoTenantMissing,
  apiHubJson,
  apiHubValidationError,
  type ApiHubValidationIssue,
} from "@/lib/apihub/api-error";
import {
  APIHUB_MAPPING_TEMPLATE_DESCRIPTION_MAX,
  APIHUB_MAPPING_TEMPLATE_NAME_MAX,
  APIHUB_MAPPING_TEMPLATE_RULES_MAX_COUNT,
} from "@/lib/apihub/constants";
import type { ApiHubMappingRule } from "@/lib/apihub/mapping-engine";
import { toApiHubMappingTemplateDto } from "@/lib/apihub/mapping-template-dto";
import { validateApiHubMappingRulesInput } from "@/lib/apihub/mapping-engine";
import { normalizeApiHubMappingRulesBody } from "@/lib/apihub/mapping-rules-body";
import {
  createApiHubMappingTemplate,
  listApiHubMappingTemplates,
} from "@/lib/apihub/mapping-templates-repo";
import {
  APIHUB_LIST_LIMIT_MAX,
  APIHUB_LIST_LIMIT_MIN,
  parseApiHubListLimitFromUrl,
} from "@/lib/apihub/query-limit";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { getActorUserId } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

type PostBody = {
  name?: unknown;
  description?: unknown;
  rules?: unknown;
};

function collectTemplateMetaIssues(body: PostBody): ApiHubValidationIssue[] {
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

export async function GET(request: Request) {
  const requestId = resolveApiHubRequestId(request);
  const tenant = await getDemoTenant();
  if (!tenant) {
    return apiHubDemoTenantMissing(requestId);
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return apiHubDemoActorMissing(requestId);
  }

  const limitParsed = parseApiHubListLimitFromUrl(new URL(request.url));
  if (!limitParsed.ok) {
    return apiHubValidationError(400, "VALIDATION_ERROR", "Mapping template list query validation failed.", [
      {
        field: "limit",
        code: "INVALID_NUMBER",
        message: `limit must be a finite number between ${APIHUB_LIST_LIMIT_MIN} and ${APIHUB_LIST_LIMIT_MAX}.`,
        severity: "error",
      },
    ], requestId);
  }

  const rows = await listApiHubMappingTemplates(tenant.id, limitParsed.limit);
  return apiHubJson({ templates: rows.map(toApiHubMappingTemplateDto) }, requestId);
}

export async function POST(request: Request) {
  const requestId = resolveApiHubRequestId(request);
  const tenant = await getDemoTenant();
  if (!tenant) {
    return apiHubDemoTenantMissing(requestId);
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return apiHubDemoActorMissing(requestId);
  }

  let body: PostBody = {};
  try {
    body = (await request.json()) as PostBody;
  } catch {
    body = {};
  }

  const metaIssues = collectTemplateMetaIssues(body);
  const rulesArray = Array.isArray(body.rules) ? body.rules : [];
  const normalizedRules =
    rulesArray.length > 0 && rulesArray.length <= APIHUB_MAPPING_TEMPLATE_RULES_MAX_COUNT
      ? normalizeApiHubMappingRulesBody(rulesArray)
      : { rules: [] as ApiHubMappingRule[], issues: [] as ApiHubValidationIssue[] };
  const structuralIssues =
    rulesArray.length > 0 && rulesArray.length <= APIHUB_MAPPING_TEMPLATE_RULES_MAX_COUNT
      ? validateApiHubMappingRulesInput(rulesArray)
      : [];

  const issues = [...metaIssues, ...normalizedRules.issues, ...structuralIssues];
  if (issues.length > 0) {
    return apiHubValidationError(
      400,
      "VALIDATION_ERROR",
      "Mapping template create validation failed.",
      issues,
      requestId,
    );
  }

  const name = (body.name as string).trim();
  let description: string | null = null;
  if (typeof body.description === "string") {
    const t = body.description.trim();
    description = t.length > 0 ? t : null;
  }

  const row = await createApiHubMappingTemplate({
    tenantId: tenant.id,
    createdByUserId: actorId,
    name,
    description,
    rules: normalizedRules.rules,
  });

  return apiHubJson({ template: toApiHubMappingTemplateDto(row) }, requestId, 201);
}
