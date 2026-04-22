import type { Prisma } from "@prisma/client";

import {
  APIHUB_AUDIT_ACTION_MAPPING_TEMPLATE_CREATED,
  APIHUB_AUDIT_ACTION_MAPPING_TEMPLATE_DELETED,
  APIHUB_AUDIT_ACTION_MAPPING_TEMPLATE_UPDATED,
} from "@/lib/apihub/audit-contract";
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

const auditSelect = {
  id: true,
  tenantId: true,
  templateId: true,
  actorUserId: true,
  action: true,
  note: true,
  createdAt: true,
} as const;

export type ApiHubMappingTemplateAuditLogRow = {
  id: string;
  tenantId: string;
  templateId: string;
  actorUserId: string;
  action: string;
  note: string | null;
  createdAt: Date;
};

async function appendMappingTemplateAuditLog(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    templateId: string;
    actorUserId: string;
    action: string;
    note: string | null;
  },
): Promise<void> {
  await tx.apiHubMappingTemplateAuditLog.create({
    data: {
      tenantId: input.tenantId,
      templateId: input.templateId,
      actorUserId: input.actorUserId,
      action: input.action,
      note: input.note,
    },
  });
}

export async function createApiHubMappingTemplate(input: {
  tenantId: string;
  createdByUserId: string;
  name: string;
  description: string | null;
  rules: ApiHubMappingRule[];
}): Promise<ApiHubMappingTemplateRow> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.apiHubMappingTemplate.create({
      data: {
        tenantId: input.tenantId,
        createdByUserId: input.createdByUserId,
        name: input.name,
        description: input.description,
        rules: input.rules as unknown as Prisma.InputJsonValue,
      },
      select,
    });
    await appendMappingTemplateAuditLog(tx, {
      tenantId: input.tenantId,
      templateId: row.id,
      actorUserId: input.createdByUserId,
      action: APIHUB_AUDIT_ACTION_MAPPING_TEMPLATE_CREATED,
      note: null,
    });
    return row;
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

export async function updateApiHubMappingTemplate(input: {
  tenantId: string;
  templateId: string;
  actorUserId: string;
  data: {
    name?: string;
    description?: string | null;
    rules?: ApiHubMappingRule[];
  };
  auditNote: string | null;
}): Promise<ApiHubMappingTemplateRow | null> {
  return prisma.$transaction(async (tx) => {
    const patch: Prisma.ApiHubMappingTemplateUpdateManyMutationInput = {};
    if (input.data.name !== undefined) {
      patch.name = input.data.name;
    }
    if (input.data.description !== undefined) {
      patch.description = input.data.description;
    }
    if (input.data.rules !== undefined) {
      patch.rules = input.data.rules as unknown as Prisma.InputJsonValue;
    }
    if (Object.keys(patch).length === 0) {
      const row = await tx.apiHubMappingTemplate.findFirst({
        where: { id: input.templateId, tenantId: input.tenantId },
        select,
      });
      if (!row) {
        return null;
      }
      await appendMappingTemplateAuditLog(tx, {
        tenantId: input.tenantId,
        templateId: input.templateId,
        actorUserId: input.actorUserId,
        action: APIHUB_AUDIT_ACTION_MAPPING_TEMPLATE_UPDATED,
        note: input.auditNote,
      });
      return row;
    }
    const updated = await tx.apiHubMappingTemplate.updateMany({
      where: { id: input.templateId, tenantId: input.tenantId },
      data: patch,
    });
    if (updated.count === 0) {
      return null;
    }
    const row = await tx.apiHubMappingTemplate.findFirstOrThrow({
      where: { id: input.templateId, tenantId: input.tenantId },
      select,
    });
    await appendMappingTemplateAuditLog(tx, {
      tenantId: input.tenantId,
      templateId: input.templateId,
      actorUserId: input.actorUserId,
      action: APIHUB_AUDIT_ACTION_MAPPING_TEMPLATE_UPDATED,
      note: input.auditNote,
    });
    return row;
  });
}

export async function deleteApiHubMappingTemplate(input: {
  tenantId: string;
  templateId: string;
  actorUserId: string;
}): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const removed = await tx.apiHubMappingTemplate.deleteMany({
      where: { id: input.templateId, tenantId: input.tenantId },
    });
    if (removed.count === 0) {
      return false;
    }
    await appendMappingTemplateAuditLog(tx, {
      tenantId: input.tenantId,
      templateId: input.templateId,
      actorUserId: input.actorUserId,
      action: APIHUB_AUDIT_ACTION_MAPPING_TEMPLATE_DELETED,
      note: null,
    });
    return true;
  });
}

/** Tenant-scoped audit page for a template id (`createdAt` desc); `hasMore` via over-fetch of one row. */
export async function listApiHubMappingTemplateAuditLogsPage(opts: {
  tenantId: string;
  templateId: string;
  limit: number;
  offset: number;
}): Promise<{ items: ApiHubMappingTemplateAuditLogRow[]; hasMore: boolean }> {
  const take = opts.limit + 1;
  const rows = await prisma.apiHubMappingTemplateAuditLog.findMany({
    where: { tenantId: opts.tenantId, templateId: opts.templateId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: opts.offset,
    take,
    select: auditSelect,
  });
  const hasMore = rows.length > opts.limit;
  const items = hasMore ? rows.slice(0, opts.limit) : rows;
  return { items, hasMore };
}
