import type { ApiHubMappingRule } from "@/lib/apihub/mapping-engine";

export type ApiHubMappingTemplateDto = {
  id: string;
  name: string;
  description: string | null;
  rules: ApiHubMappingRule[];
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

type MappingTemplateRow = {
  id: string;
  name: string;
  description: string | null;
  rules: unknown;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

function rulesFromJson(value: unknown): ApiHubMappingRule[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: ApiHubMappingRule[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const sourcePath = typeof r.sourcePath === "string" ? r.sourcePath : "";
    const targetField = typeof r.targetField === "string" ? r.targetField : "";
    if (!sourcePath || !targetField) continue;
    const transformRaw = r.transform;
    const transform =
      typeof transformRaw === "string" && transformRaw.trim().length > 0
        ? (transformRaw.trim().toLowerCase() as ApiHubMappingRule["transform"])
        : undefined;
    out.push({
      sourcePath,
      targetField,
      required: r.required === true,
      transform,
    });
  }
  return out;
}

export function toApiHubMappingTemplateDto(row: MappingTemplateRow): ApiHubMappingTemplateDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    rules: rulesFromJson(row.rules),
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
