-- Slice 63: normalize legacy API Hub audit `action` strings to `apihub.<resource>.<event>`.

UPDATE "ApiHubConnectorAuditLog" SET "action" = 'apihub.connector.created' WHERE "action" = 'connector.created';
UPDATE "ApiHubConnectorAuditLog" SET "action" = 'apihub.connector.lifecycle_updated' WHERE "action" = 'connector.lifecycle.updated';
UPDATE "ApiHubConnectorAuditLog" SET "action" = 'apihub.connector.ops_note_updated' WHERE "action" = 'connector.ops_note.updated';
UPDATE "ApiHubConnectorAuditLog" SET "action" = 'apihub.connector.auth_config_ref_updated' WHERE "action" = 'connector.auth_config_ref.updated';

UPDATE "ApiHubMappingTemplateAuditLog" SET "action" = 'apihub.mapping_template.created' WHERE "action" = 'mapping_template_created';
UPDATE "ApiHubMappingTemplateAuditLog" SET "action" = 'apihub.mapping_template.updated' WHERE "action" = 'mapping_template_updated';
UPDATE "ApiHubMappingTemplateAuditLog" SET "action" = 'apihub.mapping_template.deleted' WHERE "action" = 'mapping_template_deleted';

UPDATE "ApiHubIngestionRunAuditLog" SET "action" = 'apihub.ingestion_run.apply' WHERE "action" = 'apply';
UPDATE "ApiHubIngestionRunAuditLog" SET "action" = 'apihub.ingestion_run.retry' WHERE "action" = 'retry';
