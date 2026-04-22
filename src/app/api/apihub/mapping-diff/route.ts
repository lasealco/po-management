import {
  apiHubJson,
  apiHubValidationError,
  type ApiHubValidationIssue,
} from "@/lib/apihub/api-error";
import { APIHUB_MAPPING_TEMPLATE_RULES_MAX_COUNT } from "@/lib/apihub/constants";
import { validateApiHubMappingRulesInput } from "@/lib/apihub/mapping-engine";
import { diffApiHubMappingRules } from "@/lib/apihub/mapping-rules-diff";
import { normalizeApiHubMappingRulesBody } from "@/lib/apihub/mapping-rules-body";
import { parseApiHubPostJsonForRouteWithBudget } from "@/lib/apihub/request-budget";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { apiHubEnsureTenantActorGrants } from "@/lib/apihub/route-guards";

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
  const gate = await apiHubEnsureTenantActorGrants(requestId, "view");
  if (!gate.ok) {
    return gate.response;
  }

  let body: PostBody = {};
  const parsedBody = await parseApiHubPostJsonForRouteWithBudget(request, requestId, "large", {
    emptyOnInvalid: true,
  });
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  body = parsedBody.value as PostBody;

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
