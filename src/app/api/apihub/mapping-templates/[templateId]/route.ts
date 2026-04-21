import {
  apiHubDemoActorMissing,
  apiHubDemoTenantMissing,
  apiHubError,
  apiHubJson,
} from "@/lib/apihub/api-error";
import { toApiHubMappingTemplateDto } from "@/lib/apihub/mapping-template-dto";
import { getApiHubMappingTemplateById } from "@/lib/apihub/mapping-templates-repo";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { getActorUserId } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ templateId: string }> }) {
  const requestId = resolveApiHubRequestId(request);
  const tenant = await getDemoTenant();
  if (!tenant) {
    return apiHubDemoTenantMissing(requestId);
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return apiHubDemoActorMissing(requestId);
  }

  const { templateId } = await context.params;
  const row = await getApiHubMappingTemplateById({ tenantId: tenant.id, templateId });
  if (!row) {
    return apiHubError(404, "TEMPLATE_NOT_FOUND", "Mapping template not found.", requestId);
  }

  return apiHubJson({ template: toApiHubMappingTemplateDto(row) }, requestId);
}
