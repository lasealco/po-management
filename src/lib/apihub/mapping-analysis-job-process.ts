import { Prisma } from "@prisma/client";

import { inferApiHubMappingAnalysisProposal } from "@/lib/apihub/mapping-analysis-heuristic";
import { validateApiHubMappingRulesInput } from "@/lib/apihub/mapping-engine";
import { normalizeApiHubMappingRulesBody } from "@/lib/apihub/mapping-rules-body";
import { computeMappingPreview } from "@/lib/apihub/mapping-preview-run";
import { prisma } from "@/lib/prisma";

type StoredInputPayload = {
  schemaVersion?: number;
  records?: unknown;
  targetFields?: unknown;
  note?: unknown;
};

function parseJobInputPayload(raw: unknown): { records: unknown[]; targetFields: string[] | null } {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid job payload.");
  }
  const p = raw as StoredInputPayload;
  const records = p.records;
  if (!Array.isArray(records)) {
    throw new Error("Invalid job payload: records must be an array.");
  }
  let targetFields: string[] | null = null;
  if (Array.isArray(p.targetFields)) {
    const tf = p.targetFields.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean);
    targetFields = tf.length ? tf : null;
  }
  return { records, targetFields };
}

/**
 * Claims a queued job (tenant-scoped), runs deterministic analysis, persists succeeded/failed outcome.
 * Safe to call multiple times: only one caller transitions from `queued` to `processing`.
 */
export async function processApiHubMappingAnalysisJob(jobId: string, tenantId: string): Promise<void> {
  const claimed = await prisma.apiHubMappingAnalysisJob.updateMany({
    where: { id: jobId, tenantId, status: "queued" },
    data: { status: "processing", startedAt: new Date() },
  });
  if (claimed.count === 0) {
    return;
  }

  const job = await prisma.apiHubMappingAnalysisJob.findFirst({
    where: { id: jobId, tenantId },
  });
  if (!job) {
    return;
  }

  try {
    const { records, targetFields } = parseJobInputPayload(job.inputPayload);

    const inferred = inferApiHubMappingAnalysisProposal(records, targetFields);
    if (!inferred.ok) {
      throw new Error(inferred.message);
    }

    const structural = validateApiHubMappingRulesInput(inferred.proposal.rules as unknown[]);
    if (structural.length > 0) {
      throw new Error(structural[0]?.message ?? "Proposed rules failed validation.");
    }

    const normalized = normalizeApiHubMappingRulesBody(inferred.proposal.rules);
    if (normalized.issues.length > 0) {
      throw new Error(normalized.issues[0]?.message ?? "Rule normalization failed.");
    }

    const preview = computeMappingPreview({
      records,
      rules: normalized.rules,
      sampleSize: Math.min(12, records.length),
    });

    const stagingPreview = preview.ok ? { sampling: preview.sampling, rows: preview.rows } : null;

    const outputPayload = {
      ...inferred.proposal,
      rules: normalized.rules,
      stagingPreview,
    };

    await prisma.apiHubMappingAnalysisJob.update({
      where: { id: jobId },
      data: {
        status: "succeeded",
        finishedAt: new Date(),
        outputProposal: JSON.parse(JSON.stringify(outputPayload)) as Prisma.InputJsonValue,
        errorMessage: null,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analysis failed.";
    await prisma.apiHubMappingAnalysisJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorMessage: message.slice(0, 4000),
        outputProposal: Prisma.DbNull,
      },
    });
  }
}
