import type { OrgUnitOperatingRole } from "@prisma/client";

/** Ordered for Settings UI. Labels are end-user copy, not field names. */
export const ORG_UNIT_OPERATING_ROLE_CATALOG: ReadonlyArray<{
  value: OrgUnitOperatingRole;
  label: string;
  shortHint: string;
}> = [
  { value: "REGIONAL_HQ", label: "Regional HQ", shortHint: "Coordinates a macro-region" },
  {
    value: "GROUP_PROCUREMENT",
    label: "Group / centralized procurement",
    shortHint: "Buys for multiple entities under policy",
  },
  { value: "PLANT", label: "Plant (manufacturing)", shortHint: "Production site" },
  { value: "DIST_CENTER", label: "Distribution center", shortHint: "DC / warehouse hub" },
  { value: "SALES_HUB", label: "Sales hub", shortHint: "Commercial / customer-facing cluster" },
  { value: "SHARED_SERVICE", label: "Shared services / GBS", shortHint: "Finance, IT, HR, etc." },
  { value: "R_AND_D", label: "R&D", shortHint: "Research and development" },
  { value: "CORPORATE_FUNCTION", label: "Corporate / group function", shortHint: "Group staff function" },
  { value: "LOGISTICS_HUB", label: "Logistics hub", shortHint: "Flow / transport coordination" },
] as const;

const ROLE_SET = new Set<OrgUnitOperatingRole>(
  ORG_UNIT_OPERATING_ROLE_CATALOG.map((x) => x.value) as OrgUnitOperatingRole[],
);

/**
 * Parse `operatingRoles` from API JSON. Duplicates are removed. Empty / omitted = no roles.
 */
export function parseOperatingRolesInput(raw: unknown): { ok: true; roles: OrgUnitOperatingRole[] } | { ok: false; error: string } {
  if (raw === undefined) {
    return { ok: true, roles: [] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, error: "operatingRoles must be an array of role codes or omitted." };
  }
  const out: OrgUnitOperatingRole[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string" || !item.trim()) {
      return { ok: false, error: "Each operating role must be a non-empty string." };
    }
    const v = item.trim() as OrgUnitOperatingRole;
    if (!ROLE_SET.has(v)) {
      return { ok: false, error: `Unknown operating role: ${item}.` };
    }
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return { ok: true, roles: out };
}

export function mapRoleAssignmentsToRoles(
  rows: { role: OrgUnitOperatingRole }[],
): OrgUnitOperatingRole[] {
  return rows.map((r) => r.role);
}

export function formatOperatingRolesShort(roles: readonly OrgUnitOperatingRole[], max = 3): string {
  if (roles.length === 0) return "—";
  const labels = ORG_UNIT_OPERATING_ROLE_CATALOG;
  const nameBy = (r: OrgUnitOperatingRole) => labels.find((x) => x.value === r)?.label ?? r;
  const shown = roles.slice(0, max).map(nameBy);
  const rest = roles.length - max;
  return rest > 0 ? `${shown.join(", ")} +${rest}` : shown.join(", ");
}
