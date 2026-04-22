import {
  apiHubError,
  apiHubJson,
  apiHubValidationError,
  type ApiHubValidationIssue,
} from "@/lib/apihub/api-error";
import {
  APIHUB_MAPPING_TEMPLATE_AUDIT_NOTE_MAX,
  APIHUB_MAPPING_TEMPLATE_RULES_MAX_COUNT,
} from "@/lib/apihub/constants";
import type { ApiHubMappingRule } from "@/lib/apihub/mapping-engine";
import { toApiHubMappingTemplateDto } from "@/lib/apihub/mapping-template-dto";
import { validateApiHubMappingRulesInput } from "@/lib/apihub/mapping-engine";
import { normalizeApiHubMappingRulesBody } from "@/lib/apihub/mapping-rules-body";
import {
  collectMappingTemplatePatchIssues,
  type MappingTemplatePatchBody,
} from "@/lib/apihub/mapping-templates-payload";
import {
  deleteApiHubMappingTemplate,
  getApiHubMappingTemplateById,
  updateApiHubMappingTemplate,
} from "@/lib/apihub/mapping-templates-repo";
import { parseApiHubPostJsonForRouteWithBudget } from "@/lib/apihub/request-budget";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { apiHubEnsureTenantActorGrants } from "@/lib/apihub/route-guards";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ templateId: string }> }) {
  const requestId = resolveApiHubRequestId(request);
  const gate = await apiHubEnsureTenantActorGrants(requestId, "view");
  if (!gate.ok) {
    return gate.response;
  }
  const { tenant } = gate.ctx;

  const { templateId } = await context.params;
  const row = await getApiHubMappingTemplateById({ tenantId: tenant.id, templateId });
  if (!row) {
    return apiHubError(404, "TEMPLATE_NOT_FOUND", "Mapping template not found.", requestId);
  }

  return apiHubJson({ template: toApiHubMappingTemplateDto(row) }, requestId);
}

export async function PATCH(request: Request, context: { params: Promise<{ templateId: string }> }) {
  const requestId = resolveApiHubRequestId(request);
  const gate = await apiHubEnsureTenantActorGrants(requestId, "edit");
  if (!gate.ok) {
    return gate.response;
  }
  const { tenant, actorId } = gate.ctx;

  const { templateId } = await context.params;
  const existing = await getApiHubMappingTemplateById({ tenantId: tenant.id, templateId });
  if (!existing) {
    return apiHubError(404, "TEMPLATE_NOT_FOUND", "Mapping template not found.", requestId);
  }

  let body: MappingTemplatePatchBody = {};
  const parsedBody = await parseApiHubPostJsonForRouteWithBudget(request, requestId, "large", {
    emptyOnInvalid: true,
  });
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  body = parsedBody.value as MappingTemplatePatchBody;

  const patchIssues = collectMappingTemplatePatchIssues(body);
  const hasRules = Object.prototype.hasOwnProperty.call(body, "rules");
  const rulesArray = hasRules && Array.isArray(body.rules) ? body.rules : [];
  const normalizedRules =
    hasRules && rulesArray.length > 0 && rulesArray.length <= APIHUB_MAPPING_TEMPLATE_RULES_MAX_COUNT
      ? normalizeApiHubMappingRulesBody(rulesArray)
      : { rules: [] as ApiHubMappingRule[], issues: [] as ApiHubValidationIssue[] };
  const structuralIssues =
    hasRules && rulesArray.length > 0 && rulesArray.length <= APIHUB_MAPPING_TEMPLATE_RULES_MAX_COUNT
      ? validateApiHubMappingRulesInput(rulesArray)
      : [];

  const issues = [...patchIssues, ...normalizedRules.issues, ...structuralIssues];
  if (issues.length > 0) {
    return apiHubValidationError(
      400,
      "VALIDATION_ERROR",
      "Mapping template update validation failed.",
      issues,
      requestId,
    );
  }

  const hasName = Object.prototype.hasOwnProperty.call(body, "name");
  const hasDescription = Object.prototype.hasOwnProperty.call(body, "description");

  const data: {
    name?: string;
    description?: string | null;
    rules?: ApiHubMappingRule[];
  } = {};
  if (hasName && typeof body.name === "string") {
    data.name = body.name.trim();
  }
  if (hasDescription) {
    if (body.description === null) {
      data.description = null;
    } else if (typeof body.description === "string") {
      const t = body.description.trim();
      data.description = t.length > 0 ? t : null;
    }
  }
  if (hasRules) {
    data.rules = normalizedRules.rules;
  }

  let auditNote: string | null = null;
  if (Object.prototype.hasOwnProperty.call(body, "note")) {
    if (body.note === null) {
      auditNote = null;
    } else if (typeof body.note === "string") {
      const t = body.note.trim();
      auditNote = t.length > 0 ? t.slice(0, APIHUB_MAPPING_TEMPLATE_AUDIT_NOTE_MAX) : null;
    }
  }

  const row = await updateApiHubMappingTemplate({
    tenantId: tenant.id,
    templateId,
    actorUserId: actorId,
    data,
    auditNote,
  });
  if (!row) {
    return apiHubError(404, "TEMPLATE_NOT_FOUND", "Mapping template not found.", requestId);
  }

  return apiHubJson({ template: toApiHubMappingTemplateDto(row) }, requestId);
}

export async function DELETE(request: Request, context: { params: Promise<{ templateId: string }> }) {
  const requestId = resolveApiHubRequestId(request);
  const gate = await apiHubEnsureTenantActorGrants(requestId, "edit");
  if (!gate.ok) {
    return gate.response;
  }
  const { tenant, actorId } = gate.ctx;

  const { templateId } = await context.params;
  const deleted = await deleteApiHubMappingTemplate({
    tenantId: tenant.id,
    templateId,
    actorUserId: actorId,
  });
  if (!deleted) {
    return apiHubError(404, "TEMPLATE_NOT_FOUND", "Mapping template not found.", requestId);
  }

  return apiHubJson({ deleted: true, templateId }, requestId);
}
