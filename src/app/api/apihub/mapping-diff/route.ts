import {
  apiHubDemoActorMissing,
  apiHubDemoTenantMissing,
  apiHubJson,
  apiHubValidationError,
  type ApiHubValidationIssue,
} from "@/lib/apihub/api-error";
import { APIHUB_MAPPING_TEMPLATE_RULES_MAX_COUNT } from "@/lib/apihub/constants";
import { validateApiHubMappingRulesInput } from "@/lib/apihub/mapping-engine";
import { diffApiHubMappingRules } from "@/lib/apihub/mapping-rules-diff";
import { normalizeApiHubMappingRulesBody } from "@/lib/apihub/mapping-rules-body";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { getActorUserId } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

type PostBody = {
  baselineRules?: unknown;
  compareRules?: unknown;
};

function prefixRuleIssues(issues: ApiHubValidationIssue[], prefix: "baselineRules" | "compareRules"): ApiHubValidationIssue[] {
  return issues.map((i) => ({
    ...i,
    field: i.field.replace(/^rules(\[|$)/, `${prefix}$1`),
  }));
}

function arrayShapeIssues(field: "baselineRules" | "compareRules", raw: unknown): ApiHubValidationIssue[] {
  if (!Array.isArray(raw)) {
    return [
      {
        field,
        code: "INVALID_TYPE",
        message: `${field} must be an array.`,
        severity: "error",
      },
    ];
  }
  if (raw.length > APIHUB_MAPPING_TEMPLATE_RULES_MAX_COUNT) {
    return [
      {
        field,
        code: "MAX_ITEMS",
        message: `${field} must contain at most ${APIHUB_MAPPING_TEMPLATE_RULES_MAX_COUNT} rules.`,
        severity: "error",
      },
    ];
  }
  return [];
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

  const shapeIssues = [...arrayShapeIssues("baselineRules", body.baselineRules), ...arrayShapeIssues("compareRules", body.compareRules)];
  if (shapeIssues.length > 0) {
    return apiHubValidationError(400, "VALIDATION_ERROR", "Mapping diff payload validation failed.", shapeIssues, requestId);
  }

  const baselineArr = body.baselineRules as unknown[];
  const compareArr = body.compareRules as unknown[];

  const bNorm = normalizeApiHubMappingRulesBody(baselineArr);
  const cNorm = normalizeApiHubMappingRulesBody(compareArr);
  const bStruct = validateApiHubMappingRulesInput(baselineArr);
  const cStruct = validateApiHubMappingRulesInput(compareArr);

  const issues = [
    ...prefixRuleIssues(bNorm.issues, "baselineRules"),
    ...prefixRuleIssues(cNorm.issues, "compareRules"),
    ...prefixRuleIssues(bStruct, "baselineRules"),
    ...prefixRuleIssues(cStruct, "compareRules"),
  ];

  if (issues.length > 0) {
    return apiHubValidationError(400, "VALIDATION_ERROR", "Mapping diff payload validation failed.", issues, requestId);
  }

  const diff = diffApiHubMappingRules(bNorm.rules, cNorm.rules);
  return apiHubJson({ diff }, requestId);
}
