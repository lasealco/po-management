import type { Prisma, ScriWatchlistRule, TwinRiskSeverity } from "@prisma/client";

import { prisma } from "@/lib/prisma";

function asStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string").map((s) => s.trim());
}

export type WatchlistRuleDto = {
  id: string;
  name: string;
  isActive: boolean;
  minSeverity: TwinRiskSeverity | null;
  eventTypes: string[];
  countryCodes: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export function watchlistRowToDto(row: ScriWatchlistRule): WatchlistRuleDto {
  return {
    id: row.id,
    name: row.name,
    isActive: row.isActive,
    minSeverity: row.minSeverity,
    eventTypes: asStringArray(row.eventTypes),
    countryCodes: asStringArray(row.countryCodes).map((c) => c.toUpperCase().slice(0, 2)),
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listWatchlistRulesForTenant(tenantId: string): Promise<WatchlistRuleDto[]> {
  const rows = await prisma.scriWatchlistRule.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(watchlistRowToDto);
}

export async function createWatchlistRule(
  tenantId: string,
  input: {
    name: string;
    isActive?: boolean;
    minSeverity?: TwinRiskSeverity | null;
    eventTypes?: string[];
    countryCodes?: string[];
    sortOrder?: number;
  },
): Promise<WatchlistRuleDto> {
  const eventTypes = (input.eventTypes ?? []).map((s) => s.trim()).filter(Boolean);
  const countryCodes = (input.countryCodes ?? [])
    .map((s) => s.trim().toUpperCase().slice(0, 2))
    .filter((c) => /^[A-Z]{2}$/.test(c));

  const row = await prisma.scriWatchlistRule.create({
    data: {
      tenantId,
      name: input.name.trim().slice(0, 256),
      isActive: input.isActive ?? true,
      minSeverity: input.minSeverity ?? null,
      eventTypes: eventTypes as Prisma.InputJsonValue,
      countryCodes: countryCodes as Prisma.InputJsonValue,
      sortOrder: input.sortOrder ?? 0,
    },
  });
  return watchlistRowToDto(row);
}

export async function updateWatchlistRuleForTenant(
  tenantId: string,
  id: string,
  input: Partial<{
    name: string;
    isActive: boolean;
    minSeverity: TwinRiskSeverity | null;
    eventTypes: string[];
    countryCodes: string[];
    sortOrder: number;
  }>,
): Promise<WatchlistRuleDto | null> {
  const existing = await prisma.scriWatchlistRule.findFirst({ where: { id, tenantId } });
  if (!existing) return null;

  const data: Prisma.ScriWatchlistRuleUpdateInput = {};
  if (input.name !== undefined) data.name = input.name.trim().slice(0, 256);
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.minSeverity !== undefined) data.minSeverity = input.minSeverity;
  if (input.eventTypes !== undefined) {
    data.eventTypes = input.eventTypes.map((s) => s.trim()).filter(Boolean) as Prisma.InputJsonValue;
  }
  if (input.countryCodes !== undefined) {
    data.countryCodes = input.countryCodes
      .map((s) => s.trim().toUpperCase().slice(0, 2))
      .filter((c) => /^[A-Z]{2}$/.test(c)) as Prisma.InputJsonValue;
  }
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

  const row = await prisma.scriWatchlistRule.update({ where: { id }, data });
  return watchlistRowToDto(row);
}

export async function deleteWatchlistRuleForTenant(tenantId: string, id: string): Promise<boolean> {
  const res = await prisma.scriWatchlistRule.deleteMany({ where: { id, tenantId } });
  return res.count > 0;
}
