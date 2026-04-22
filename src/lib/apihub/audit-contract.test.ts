import { describe, expect, it } from "vitest";

import {
  APIHUB_AUDIT_ACTION_CONNECTOR_CREATED,
  APIHUB_AUDIT_ACTION_INGESTION_RUN_APPLY,
  APIHUB_AUDIT_ACTION_MAPPING_TEMPLATE_CREATED,
  apiHubIngestionRunAuditMetadataEnvelope,
} from "./audit-contract";

describe("audit-contract", () => {
  it("uses stable apihub-prefixed action ids", () => {
    expect(APIHUB_AUDIT_ACTION_CONNECTOR_CREATED).toMatch(/^apihub\.connector\./);
    expect(APIHUB_AUDIT_ACTION_MAPPING_TEMPLATE_CREATED).toMatch(/^apihub\.mapping_template\./);
    expect(APIHUB_AUDIT_ACTION_INGESTION_RUN_APPLY).toMatch(/^apihub\.ingestion_run\./);
  });

  it("exposes ingestion metadata envelope", () => {
    expect(apiHubIngestionRunAuditMetadataEnvelope()).toEqual({
      schemaVersion: 1,
      resourceType: "ingestion_run",
    });
  });
});
