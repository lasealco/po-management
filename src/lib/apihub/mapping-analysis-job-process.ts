import { Prisma } from "@prisma/client";

import {
  APIHUB_MAPPING_ANALYSIS_ENGINE_HEURISTIC,
} from "@/lib/apihub/constants";
import { inferApiHubMappingAnalysisProposal } from "@/lib/apihub/mapping-analysis-heuristic";
import type { ApiHubMappingLlmMeta } from "@/lib/apihub/mapping-analysis-llm";
import { proposeApiHubMappingWithOpenAi } from "@/lib/apihub/mapping-analysis-llm";
import { validateApiHubMappingRulesInput } from "@/lib/apihub/mapping-engine";
import { normalizeApiHubMappingRulesBody } from "@/lib/apihub/mapping-rules-body";
import { apiHubOperatorMessageFromCaughtError } from "@/lib/apihub/api-error";
import { computeMappingPreview } from "@/lib/apihub/mapping-preview-run";
import { prisma } from "@/lib/prisma";

type StoredInputPayload = {
  schemaVersion?: number;
  records?: unknown;
  targetFields?: unknown;
  note?: unknown;
};

type JobCoreRow = {
  id: string;
  inputPayload: Prisma.JsonValue;
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

function finalizeRulesOrThrow(rules: unknown[]): { rules: ReturnType<typeof normalizeApiHubMappingRulesBody>["rules"] } {
  const structural = validateApiHubMappingRulesInput(rules);
  if (structural.length > 0) {
    throw new Error(structural[0]?.message ?? "Proposed rules failed validation.");
  }
  const normalized = normalizeApiHubMappingRulesBody(rules);
  if (normalized.issues.length > 0) {
    throw new Error(normalized.issues[0]?.message ?? "Rule normalization failed.");
  }
  return { rules: normalized.rules };
}

async function runApiHubMappingAnalysisJobCore(job: JobCoreRow): Promise<void> {
  const jobId = job.id;
  try {
    const { records, targetFields } = parseJobInputPayload(job.inputPayload);

    const llmResult = await proposeApiHubMappingWithOpenAi({ records, targetFields });
    let llmMeta: ApiHubMappingLlmMeta = llmResult.meta;

    type ProposalPack = {
      normalizedRules: ReturnType<typeof finalizeRulesOrThrow>["rules"];
      engine: string;
      notes: string[];
      usedLlmRules: boolean;
      llmMeta: ApiHubMappingLlmMeta;
    };

    let pack: ProposalPack | null = null;
    if (llmResult.ok) {
      try {
        const fin = finalizeRulesOrThrow(llmResult.proposal.rules as unknown[]);
        pack = {
          normalizedRules: fin.rules,
          engine: llmResult.proposal.engine,
          notes: [...llmResult.proposal.notes],
          usedLlmRules: true,
          llmMeta,
        };
      } catch {
        pack = null;
      }
    }

    if (!pack) {
      const inferred = inferApiHubMappingAnalysisProposal(records, targetFields);
      if (!inferred.ok) {
        throw new Error(inferred.message);
      }
      const fin = finalizeRulesOrThrow(inferred.proposal.rules as unknown[]);
      const fallbackMsg =
        llmResult.ok && llmMeta.used
          ? "LLM proposal failed server validation; used deterministic heuristic."
          : llmMeta.attempted && !llmMeta.used
            ? `LLM not used (${llmMeta.error ?? "skipped"}); used deterministic heuristic.`
            : llmMeta.attempted && llmMeta.error
              ? `LLM error (${llmMeta.error}); used deterministic heuristic.`
              : "Used deterministic heuristic (no LLM key or LLM skipped).";
      llmMeta = { ...llmMeta, used: false };
      pack = {
        normalizedRules: fin.rules,
        engine: APIHUB_MAPPING_ANALYSIS_ENGINE_HEURISTIC,
        notes: [...inferred.proposal.notes, fallbackMsg],
        usedLlmRules: false,
        llmMeta,
      };
    }

    const { normalizedRules, engine, notes, usedLlmRules } = pack;
    llmMeta = pack.llmMeta;

    const preview = computeMappingPreview({
      records,
      rules: normalizedRules,
      sampleSize: Math.min(12, records.length),
    });

    const stagingPreview = preview.ok ? { sampling: preview.sampling, rows: preview.rows } : null;

    const outputPayload = {
      schemaVersion: 1 as const,
      engine,
      rules: normalizedRules,
      notes,
      stagingPreview,
      llm: { ...llmMeta, used: usedLlmRules },
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
    const message = apiHubOperatorMessageFromCaughtError(e, "Analysis failed.").slice(0, 4000);
    await prisma.apiHubMappingAnalysisJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorMessage: message,
        outputProposal: Prisma.DbNull,
      },
    });
  }
}

/**
 * Runs analysis for a row already in **`processing`** (e.g. claimed via {@link claimNextQueuedApiHubMappingAnalysisJob}).
 * @returns `false` if no matching **`processing`** job exists.
 */
export async function executeApiHubMappingAnalysisJobForClaimedRow(jobId: string, tenantId: string): Promise<boolean> {
  const job = await prisma.apiHubMappingAnalysisJob.findFirst({
    where: { id: jobId, tenantId, status: "processing" },
    select: { id: true, inputPayload: true },
  });
  if (!job) {
    return false;
  }
  await runApiHubMappingAnalysisJobCore(job);
  return true;
}

/**
 * Claims a queued job (tenant-scoped), runs LLM (if configured) then deterministic heuristic fallback, persists outcome.
 * @returns `true` if this invocation claimed the job and ran it to success or failed status; `false` if the job was not queued (race / already processed).
 */
export async function processApiHubMappingAnalysisJob(jobId: string, tenantId: string): Promise<boolean> {
  const claimed = await prisma.apiHubMappingAnalysisJob.updateMany({
    where: { id: jobId, tenantId, status: "queued" },
    data: { status: "processing", startedAt: new Date() },
  });
  if (claimed.count === 0) {
    return false;
  }

  const job = await prisma.apiHubMappingAnalysisJob.findFirst({
    where: { id: jobId, tenantId },
    select: { id: true, inputPayload: true },
  });
  if (!job) {
    return false;
  }

  await runApiHubMappingAnalysisJobCore(job);
  return true;
}
