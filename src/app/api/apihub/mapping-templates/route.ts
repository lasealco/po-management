import {
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
import { getApiHubMappingAnalysisJob } from "@/lib/apihub/mapping-analysis-jobs-repo";
import { normalizeApiHubMappingRulesBody } from "@/lib/apihub/mapping-rules-body";
import {
  collectMappingTemplateCreateMetaIssues,
  collectMappingTemplateNameDescriptionIssues,
} from "@/lib/apihub/mapping-templates-payload";
import {
  createApiHubMappingTemplate,
  listApiHubMappingTemplates,
} from "@/lib/apihub/mapping-templates-repo";
import {
  APIHUB_LIST_LIMIT_MAX,
  APIHUB_LIST_LIMIT_MIN,
  parseApiHubListLimitFromUrl,
} from "@/lib/apihub/query-limit";
import { parseApiHubPostJsonForRouteWithBudget } from "@/lib/apihub/request-budget";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { apiHubEnsureTenantActorGrants } from "@/lib/apihub/route-guards";

export const dynamic = "force-dynamic";

type PostBody = {
  name?: unknown;
  description?: unknown;
  rules?: unknown;
  sourceMappingAnalysisJobId?: unknown;
};

export async function GET(request: Request) {
  const requestId = resolveApiHubRequestId(request);
  const gate = await apiHubEnsureTenantActorGrants(requestId, "view");
  if (!gate.ok) {
    return gate.response;
  }
  const { tenant } = gate.ctx;

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
  const gate = await apiHubEnsureTenantActorGrants(requestId, "edit");
  if (!gate.ok) {
    return gate.response;
  }
  const { tenant, actorId } = gate.ctx;

  let body: PostBody = {};
  const parsedBody = await parseApiHubPostJsonForRouteWithBudget(request, requestId, "large", {
    emptyOnInvalid: true,
  });
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  body = parsedBody.value as PostBody;

  const jobId =
    typeof body.sourceMappingAnalysisJobId === "string" ? body.sourceMappingAnalysisJobId.trim() : "";

  let rulesArray: unknown[] = [];

  if (jobId) {
    const ndIssues = collectMappingTemplateNameDescriptionIssues(body);
    if (Array.isArray(body.rules) && body.rules.length > 0) {
      ndIssues.push({
        field: "rules",
        code: "CONFLICT",
        message: "Omit rules when sourceMappingAnalysisJobId is set (rules are taken from the job).",
        severity: "error",
      });
    }
    if (ndIssues.length > 0) {
      return apiHubValidationError(400, "VALIDATION_ERROR", "Mapping template create validation failed.", ndIssues, requestId);
    }
    const job = await getApiHubMappingAnalysisJob({ tenantId: tenant.id, jobId });
    if (!job) {
      return apiHubValidationError(
        400,
        "VALIDATION_ERROR",
        "Mapping template create validation failed.",
        [
          {
            field: "sourceMappingAnalysisJobId",
            code: "NOT_FOUND",
            message: "Mapping analysis job not found for this tenant.",
            severity: "error",
          },
        ],
        requestId,
      );
    }
    if (job.status !== "succeeded") {
      return apiHubValidationError(
        400,
        "VALIDATION_ERROR",
        "Mapping template create validation failed.",
        [
          {
            field: "sourceMappingAnalysisJobId",
            code: "INVALID_STATE",
            message: `Job status must be succeeded (current: ${job.status}).`,
            severity: "error",
          },
        ],
        requestId,
      );
    }
    const proposal = job.outputProposal && typeof job.outputProposal === "object" ? (job.outputProposal as Record<string, unknown>) : null;
    const pr = proposal?.rules;
    if (!Array.isArray(pr) || pr.length === 0) {
      return apiHubValidationError(
        400,
        "VALIDATION_ERROR",
        "Mapping template create validation failed.",
        [
          {
            field: "sourceMappingAnalysisJobId",
            code: "NO_RULES",
            message: "Job has no proposed rules to import.",
            severity: "error",
          },
        ],
        requestId,
      );
    }
    if (pr.length > APIHUB_MAPPING_TEMPLATE_RULES_MAX_COUNT) {
      return apiHubValidationError(
        400,
        "VALIDATION_ERROR",
        "Mapping template create validation failed.",
        [
          {
            field: "sourceMappingAnalysisJobId",
            code: "MAX_ITEMS",
            message: `Job proposes more than ${APIHUB_MAPPING_TEMPLATE_RULES_MAX_COUNT} rules; narrow the analysis input or edit rules manually.`,
            severity: "error",
          },
        ],
        requestId,
      );
    }
    rulesArray = pr;
  } else {
    const metaIssues = collectMappingTemplateCreateMetaIssues(body);
    if (metaIssues.length > 0) {
      return apiHubValidationError(
        400,
        "VALIDATION_ERROR",
        "Mapping template create validation failed.",
        metaIssues,
        requestId,
      );
    }
    rulesArray = Array.isArray(body.rules) ? body.rules : [];
  }

  const normalizedRules =
    rulesArray.length > 0 && rulesArray.length <= APIHUB_MAPPING_TEMPLATE_RULES_MAX_COUNT
      ? normalizeApiHubMappingRulesBody(rulesArray)
      : { rules: [] as ApiHubMappingRule[], issues: [] as ApiHubValidationIssue[] };
  const structuralIssues =
    rulesArray.length > 0 && rulesArray.length <= APIHUB_MAPPING_TEMPLATE_RULES_MAX_COUNT
      ? validateApiHubMappingRulesInput(rulesArray)
      : [];

  const ruleIssues = [...normalizedRules.issues, ...structuralIssues];
  if (ruleIssues.length > 0) {
    return apiHubValidationError(
      400,
      "VALIDATION_ERROR",
      "Mapping template create validation failed.",
      ruleIssues,
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
