import type { ApiHubMappingAnalysisJobRow } from "@/lib/apihub/mapping-analysis-jobs-repo";
import type { ApiHubMappingRule } from "@/lib/apihub/mapping-engine";
import type { MappingPreviewComputedRow, MappingPreviewSamplingMeta } from "@/lib/apihub/mapping-preview-run";

export type ApiHubMappingAnalysisJobDto = {
  id: string;
  tenantId: string;
  requestedByUserId: string;
  status: string;
  input: {
    schemaVersion: number;
    recordCount: number;
    targetFields: string[] | null;
    note: string | null;
  };
  outputProposal: {
    schemaVersion: 1;
    engine: string;
    rules: ApiHubMappingRule[];
    notes: string[];
    stagingPreview: { sampling: MappingPreviewSamplingMeta; rows: MappingPreviewComputedRow[] } | null;
  } | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

function parseInputEnvelope(raw: unknown): ApiHubMappingAnalysisJobDto["input"] {
  if (!raw || typeof raw !== "object") {
    return { schemaVersion: 1, recordCount: 0, targetFields: null, note: null };
  }
  const o = raw as Record<string, unknown>;
  const records = o.records;
  const recordCount = Array.isArray(records) ? records.length : 0;
  let targetFields: string[] | null = null;
  if (Array.isArray(o.targetFields)) {
    const tf = o.targetFields.filter((x): x is string => typeof x === "string");
    targetFields = tf.length ? tf : null;
  }
  const note = typeof o.note === "string" ? o.note : null;
  const schemaVersion = typeof o.schemaVersion === "number" ? o.schemaVersion : 1;
  return { schemaVersion, recordCount, targetFields, note };
}

function parseOutputEnvelope(raw: unknown): ApiHubMappingAnalysisJobDto["outputProposal"] {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.schemaVersion !== "number" || typeof o.engine !== "string" || !Array.isArray(o.rules)) {
    return null;
  }
  const notes = Array.isArray(o.notes) ? o.notes.filter((x): x is string => typeof x === "string") : [];
  let stagingPreview: { sampling: MappingPreviewSamplingMeta; rows: MappingPreviewComputedRow[] } | null = null;
  const stagingRaw = o.stagingPreview;
  if (stagingRaw && typeof stagingRaw === "object") {
    const s = stagingRaw as Record<string, unknown>;
    if (s.sampling && typeof s.sampling === "object" && Array.isArray(s.rows)) {
      stagingPreview = {
        sampling: s.sampling as MappingPreviewSamplingMeta,
        rows: s.rows as MappingPreviewComputedRow[],
      };
    }
  }
  return {
    schemaVersion: 1,
    engine: o.engine,
    rules: o.rules as ApiHubMappingRule[],
    notes,
    stagingPreview,
  };
}

export function toApiHubMappingAnalysisJobDto(row: ApiHubMappingAnalysisJobRow): ApiHubMappingAnalysisJobDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    requestedByUserId: row.requestedByUserId,
    status: row.status,
    input: parseInputEnvelope(row.inputPayload),
    outputProposal: row.outputProposal ? parseOutputEnvelope(row.outputProposal) : null,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
  };
}
