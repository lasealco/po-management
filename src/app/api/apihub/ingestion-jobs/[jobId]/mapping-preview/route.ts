import { getActorUserId } from "@/lib/authz";
import {
  apiHubDemoActorMissing,
  apiHubDemoTenantMissing,
  apiHubError,
  apiHubJson,
  apiHubValidationError,
  type ApiHubValidationIssue,
} from "@/lib/apihub/api-error";
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
};

function normalizeRules(input: unknown): { rules: ApiHubMappingRule[]; issues: ApiHubValidationIssue[] } {
  const issues: ApiHubValidationIssue[] = [];
  if (!Array.isArray(input)) {
    return {
      rules: [],
      issues: [{ field: "rules", code: "INVALID_TYPE", message: "rules must be an array." }],
    };
  }

  const rules: ApiHubMappingRule[] = [];
  input.forEach((row, idx) => {
    if (!row || typeof row !== "object") {
      issues.push({ field: `rules[${idx}]`, code: "INVALID_TYPE", message: "rule must be an object." });
      return;
    }
    const record = row as Record<string, unknown>;
    const sourcePath = typeof record.sourcePath === "string" ? record.sourcePath.trim() : "";
    const targetField = typeof record.targetField === "string" ? record.targetField.trim() : "";
    const transformRaw = record.transform;
    const transform = typeof transformRaw === "string" && transformRaw.trim().length > 0 ? transformRaw.trim().toLowerCase() : undefined;
    const required = record.required === true;

    if (!sourcePath) {
      issues.push({ field: `rules[${idx}].sourcePath`, code: "REQUIRED", message: "sourcePath is required." });
    }
    if (!targetField) {
      issues.push({ field: `rules[${idx}].targetField`, code: "REQUIRED", message: "targetField is required." });
    }
    if (
      transform &&
      !["identity", "trim", "upper", "lower", "number", "iso_date"].includes(transform)
    ) {
      issues.push({
        field: `rules[${idx}].transform`,
        code: "INVALID_ENUM",
        message: "transform must be one of: identity, trim, upper, lower, number, iso_date.",
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
    issues: [{ field: "records", code: "INVALID_TYPE", message: "records must be an object or array of objects." }],
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
  const structuralIssues = validateApiHubMappingRulesInput(Array.isArray(body.rules) ? body.rules : []);
  const issues = [...normalizedRules.issues, ...normalizedRecords.issues, ...structuralIssues];
  if (issues.length > 0) {
    return apiHubValidationError(
      400,
      "VALIDATION_ERROR",
      "Mapping preview payload validation failed.",
      issues,
      requestId,
    );
  }

  const preview = applyApiHubMappingRulesBatch(normalizedRecords.records, normalizedRules.rules);
  return apiHubJson(
    {
      runId: run.id,
      preview: preview.map((row, index) => ({ recordIndex: index, mapped: row.mapped, issues: row.issues })),
    },
    requestId,
  );
}
