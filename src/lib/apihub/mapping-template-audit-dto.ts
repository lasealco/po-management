import type { ApiHubMappingTemplateAuditLogRow } from "@/lib/apihub/mapping-templates-repo";

export type ApiHubMappingTemplateAuditTrailDto = {
  id: string;
  templateId: string;
  actorUserId: string;
  action: string;
  note: string | null;
  createdAt: string;
};

export function toApiHubMappingTemplateAuditLogDto(row: ApiHubMappingTemplateAuditLogRow): ApiHubMappingTemplateAuditTrailDto {
  return {
    id: row.id,
    templateId: row.templateId,
    actorUserId: row.actorUserId,
    action: row.action,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}
