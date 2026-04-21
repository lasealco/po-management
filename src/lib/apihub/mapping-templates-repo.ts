import type { Prisma } from "@prisma/client";

import type { ApiHubMappingRule } from "@/lib/apihub/mapping-engine";
import { prisma } from "@/lib/prisma";

const select = {
  id: true,
  tenantId: true,
  name: true,
  description: true,
  rules: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type ApiHubMappingTemplateRow = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  rules: unknown;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function createApiHubMappingTemplate(input: {
  tenantId: string;
  createdByUserId: string;
  name: string;
  description: string | null;
  rules: ApiHubMappingRule[];
}): Promise<ApiHubMappingTemplateRow> {
  return prisma.apiHubMappingTemplate.create({
    data: {
      tenantId: input.tenantId,
      createdByUserId: input.createdByUserId,
      name: input.name,
      description: input.description,
      rules: input.rules as unknown as Prisma.InputJsonValue,
    },
    select,
  });
}

export async function listApiHubMappingTemplates(
  tenantId: string,
  limit: number,
): Promise<ApiHubMappingTemplateRow[]> {
  return prisma.apiHubMappingTemplate.findMany({
    where: { tenantId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select,
  });
}

export async function getApiHubMappingTemplateById(input: {
  tenantId: string;
  templateId: string;
}): Promise<ApiHubMappingTemplateRow | null> {
  return prisma.apiHubMappingTemplate.findFirst({
    where: { id: input.templateId, tenantId: input.tenantId },
    select,
  });
}
