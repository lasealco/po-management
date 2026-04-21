import { getActorUserId } from "@/lib/authz";
import {
  apiHubDemoActorMissing,
  apiHubDemoTenantMissing,
  apiHubError,
  apiHubJson,
  apiHubValidationError,
  type ApiHubValidationIssue,
} from "@/lib/apihub/api-error";
import { APIHUB_MAPPING_PREVIEW_SAMPLE_MAX } from "@/lib/apihub/constants";
import { getApiHubIngestionRunById } from "@/lib/apihub/ingestion-runs-repo";
import {
  applyApiHubMappingRulesBatch,
  validateApiHubMappingRulesInput,
  type ApiHubMappingRule,
} from "@/lib/apihub/mapping-engine";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

type PostBody = {
  records?: unknown;
  rules?: unknown;
  /** When set, only the first `min(sampleSize, APIHUB_MAPPING_PREVIEW_SAMPLE_MAX)` records are mapped. */
  sampleSize?: unknown;
};

function parseSampleSize(raw: unknown):
  | {
      ok: true;
      limit: number | null;
      requested: number | null;
      capped: boolean;
    }
  | { ok: false; issues: ApiHubValidationIssue[] } {
  if (raw === undefined || raw === null) {
    return { ok: true, limit: null, requested: null, capped: false };
  }
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return {
      ok: false,
      issues: [
        {
          field: "sampleSize",
          code: "INVALID_TYPE",
          message: "sampleSize must be a finite number when provided.",
          severity: "error",
        },
      ],
    };
  }
  if (!Number.isInteger(raw)) {
    return {
      ok: false,
      issues: [
        {
          field: "sampleSize",
          code: "INVALID_NUMBER",
          message: "sampleSize must be a whole number.",
          severity: "error",
        },
      ],
    };
  }
  if (raw < 1) {
    return {
      ok: false,
      issues: [
        {
          field: "sampleSize",
          code: "OUT_OF_RANGE",
          message: `sampleSize must be at least 1 (server cap ${APIHUB_MAPPING_PREVIEW_SAMPLE_MAX}).`,
          severity: "error",
        },
      ],
    };
  }
  const capped = raw > APIHUB_MAPPING_PREVIEW_SAMPLE_MAX;
  const limit = Math.min(raw, APIHUB_MAPPING_PREVIEW_SAMPLE_MAX);
  return { ok: true, limit, requested: raw, capped };
}

function normalizeRules(input: unknown): { rules: ApiHubMappingRule[]; issues: ApiHubValidationIssue[] } {
  const issues: ApiHubValidationIssue[] = [];
  if (!Array.isArray(input)) {
    return {
      rules: [],
      issues: [
        { field: "rules", code: "INVALID_TYPE", message: "rules must be an array.", severity: "error" },
      ],
    };
  }

  const rules: ApiHubMappingRule[] = [];
  input.forEach((row, idx) => {
    if (!row || typeof row !== "object") {
      issues.push({
        field: `rules[${idx}]`,
        code: "INVALID_TYPE",
        message: "rule must be an object.",
        severity: "error",
      });
      return;
    }
    const record = row as Record<string, unknown>;
    const sourcePath = typeof record.sourcePath === "string" ? record.sourcePath.trim() : "";
    const targetField = typeof record.targetField === "string" ? record.targetField.trim() : "";
    const transformRaw = record.transform;
    const transform = typeof transformRaw === "string" && transformRaw.trim().length > 0 ? transformRaw.trim().toLowerCase() : undefined;
    const required = record.required === true;

    if (!sourcePath) {
      issues.push({
        field: `rules[${idx}].sourcePath`,
        code: "REQUIRED",
        message: "sourcePath is required.",
        severity: "error",
      });
    }
    if (!targetField) {
      issues.push({
        field: `rules[${idx}].targetField`,
        code: "REQUIRED",
        message: "targetField is required.",
        severity: "error",
      });
    }
    if (
      transform &&
      !["identity", "trim", "upper", "lower", "number", "iso_date", "boolean", "currency"].includes(transform)
    ) {
      issues.push({
        field: `rules[${idx}].transform`,
        code: "INVALID_ENUM",
        message:
          "transform must be one of: identity, trim, upper, lower, number, iso_date, boolean, currency.",
        severity: "error",
      });
    }
    if (sourcePath && targetField) {
      rules.push({
        sourcePath,
        targetField,
        required,
        transform: transform as ApiHubMappingRule["transform"],
      });
    }
  });
  return { rules, issues };
}

function normalizeRecords(input: unknown): { records: unknown[]; issues: ApiHubValidationIssue[] } {
  if (Array.isArray(input)) {
    return { records: input, issues: [] };
  }
  if (input && typeof input === "object") {
    return { records: [input], issues: [] };
  }
  return {
    records: [],
    issues: [
      {
        field: "records",
        code: "INVALID_TYPE",
        message: "records must be an object or array of objects.",
        severity: "error",
      },
    ],
  };
}

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const requestId = resolveApiHubRequestId(request);
  const tenant = await getDemoTenant();
  if (!tenant) {
    return apiHubDemoTenantMissing(requestId);
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return apiHubDemoActorMissing(requestId);
  }

  const { jobId } = await context.params;
  const run = await getApiHubIngestionRunById({ tenantId: tenant.id, runId: jobId });
  if (!run) {
    return apiHubError(404, "RUN_NOT_FOUND", "Run not found.", requestId);
  }

  let body: PostBody = {};
  try {
    body = (await request.json()) as PostBody;
  } catch {
    body = {};
  }

  const normalizedRules = normalizeRules(body.rules);
  const normalizedRecords = normalizeRecords(body.records);
  const sampleParsed = parseSampleSize(body.sampleSize);
  const structuralIssues = validateApiHubMappingRulesInput(Array.isArray(body.rules) ? body.rules : []);
  const issues = [
    ...normalizedRules.issues,
    ...normalizedRecords.issues,
    ...(sampleParsed.ok ? [] : sampleParsed.issues),
    ...structuralIssues,
  ];
  if (issues.length > 0) {
    return apiHubValidationError(
      400,
      "VALIDATION_ERROR",
      "Mapping preview payload validation failed.",
      issues,
      requestId,
    );
  }

  const sample = sampleParsed as Extract<typeof sampleParsed, { ok: true }>;

  const allRecords = normalizedRecords.records;
  const totalRecords = allRecords.length;
  const recordsForPreview =
    sample.limit === null ? allRecords : allRecords.slice(0, sample.limit);
  const preview = applyApiHubMappingRulesBatch(recordsForPreview, normalizedRules.rules);
  return apiHubJson(
    {
      runId: run.id,
      sampling: {
        totalRecords,
        previewedRecords: preview.length,
        maxSampleSize: APIHUB_MAPPING_PREVIEW_SAMPLE_MAX,
        requestedSampleSize: sample.requested,
        sampleSizeCapped: sample.capped,
        truncated: totalRecords > preview.length,
      },
      preview: preview.map((row, index) => ({ recordIndex: index, mapped: row.mapped, issues: row.issues })),
    },
    requestId,
  );
}
