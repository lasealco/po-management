import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const select = {
  id: true,
  tenantId: true,
  requestedByUserId: true,
  status: true,
  inputPayload: true,
  outputProposal: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  finishedAt: true,
} as const;

export type ApiHubMappingAnalysisJobRow = {
  id: string;
  tenantId: string;
  requestedByUserId: string;
  status: string;
  inputPayload: Prisma.JsonValue;
  outputProposal: Prisma.JsonValue | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
};

export async function createApiHubMappingAnalysisJob(input: {
  tenantId: string;
  requestedByUserId: string;
  inputPayload: Prisma.InputJsonValue;
}): Promise<ApiHubMappingAnalysisJobRow> {
  return prisma.apiHubMappingAnalysisJob.create({
    data: {
      tenantId: input.tenantId,
      requestedByUserId: input.requestedByUserId,
      status: "queued",
      inputPayload: input.inputPayload,
    },
    select,
  });
}

export async function getApiHubMappingAnalysisJob(input: {
  tenantId: string;
  jobId: string;
}): Promise<ApiHubMappingAnalysisJobRow | null> {
  return prisma.apiHubMappingAnalysisJob.findFirst({
    where: { id: input.jobId, tenantId: input.tenantId },
    select,
  });
}

export async function listApiHubMappingAnalysisJobs(input: {
  tenantId: string;
  limit: number;
}): Promise<ApiHubMappingAnalysisJobRow[]> {
  return prisma.apiHubMappingAnalysisJob.findMany({
    where: { tenantId: input.tenantId },
    orderBy: { createdAt: "desc" },
    take: input.limit,
    select,
  });
}
