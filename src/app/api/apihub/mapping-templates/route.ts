import {
  apiHubDemoActorMissing,
  apiHubDemoTenantMissing,
  apiHubJson,
  apiHubValidationError,
  type ApiHubValidationIssue,
} from "@/lib/apihub/api-error";
import {
  APIHUB_MAPPING_TEMPLATE_RULES_MAX_COUNT,
} from "@/lib/apihub/constants";
import type { ApiHubMappingRule } from "@/lib/apihub/mapping-engine";
import { toApiHubMappingTemplateDto } from "@/lib/apihub/mapping-template-dto";
import { validateApiHubMappingRulesInput } from "@/lib/apihub/mapping-engine";
import { normalizeApiHubMappingRulesBody } from "@/lib/apihub/mapping-rules-body";
import { collectMappingTemplateCreateMetaIssues } from "@/lib/apihub/mapping-templates-payload";
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

  const metaIssues = collectMappingTemplateCreateMetaIssues(body);
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
