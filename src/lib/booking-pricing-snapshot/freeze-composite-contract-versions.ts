import type { Prisma } from "@prisma/client";

import { TOTAL_DERIVATION_COMPOSITE_CONTRACT_VERSIONS } from "@/lib/booking-pricing-snapshot/constants";
import { buildContractVersionSnapshotPayload } from "@/lib/booking-pricing-snapshot/freeze-from-contract-version";
import { SnapshotRepoError } from "@/lib/booking-pricing-snapshot/snapshot-repo-error";

const COMPOSITE_BREAKDOWN_SCHEMA_VERSION = 3;

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export type CompositeContractComponentInput = {
  /** e.g. FORWARDER_HANDLING, PRE_CARRIAGE, MAIN_OCEAN, ON_CARRIAGE, DESTINATION_HANDLING, LAST_MILE */
  role: string;
  contractVersionId: string;
};

/**
 * Freezes several tariff contract versions into one snapshot (same currency).
 * Incoterm is stored for audit/context; which legs you include is a business choice at freeze time.
 */
export async function buildCompositeContractVersionsSnapshotPayload(params: {
  tenantId: string;
  incoterm: string | null;
  components: CompositeContractComponentInput[];
}) {
  if (params.components.length === 0) {
    throw new SnapshotRepoError("BAD_INPUT", "At least one contract version component is required.");
  }
  if (params.components.length > 12) {
    throw new SnapshotRepoError("BAD_INPUT", "Too many components (max 12).");
  }

  const seen = new Set<string>();
  for (const c of params.components) {
    const role = typeof c.role === "string" ? c.role.trim() : "";
    const vid = typeof c.contractVersionId === "string" ? c.contractVersionId.trim() : "";
    if (!role) throw new SnapshotRepoError("BAD_INPUT", "Each component needs a non-empty role.");
    if (!vid) throw new SnapshotRepoError("BAD_INPUT", "Each component needs a contractVersionId.");
    const dedupe = `${role}:${vid}`;
    if (seen.has(dedupe)) throw new SnapshotRepoError("BAD_INPUT", `Duplicate component: ${dedupe}`);
    seen.add(dedupe);
  }

  const parts: Prisma.InputJsonValue[] = [];
  let currency: string | null = null;
  let total = 0;
  const freeTimeRulesAccum: Prisma.InputJsonValue[] = [];

  for (const c of params.components) {
    const built = await buildContractVersionSnapshotPayload({
      tenantId: params.tenantId,
      contractVersionId: c.contractVersionId.trim(),
    });
    if (currency == null) currency = built.currency;
    else if (currency !== built.currency) {
      throw new SnapshotRepoError(
        "BAD_INPUT",
        `Mixed currencies in composite snapshot: base ${currency}, component ${c.role} uses ${built.currency}.`,
      );
    }
    total += built.totalEstimatedCost;

    const inner = built.breakdown;
    if (!isRecord(inner)) {
      throw new SnapshotRepoError("BAD_INPUT", "Internal: contract breakdown is not an object.");
    }

    parts.push({
      role: c.role.trim(),
      contractVersionId: c.contractVersionId.trim(),
      contract: inner.contract ?? null,
      version: inner.version ?? null,
      rateLines: inner.rateLines ?? [],
      chargeLines: inner.chargeLines ?? [],
      totals: inner.totals ?? null,
      sourceSummary: built.sourceSummary,
    });

    const ft = built.freeTimeBasis;
    if (isRecord(ft) && Array.isArray(ft.rules)) {
      for (const r of ft.rules) {
        if (isRecord(r)) {
          freeTimeRulesAccum.push({ ...r, componentRole: c.role.trim() } as Prisma.InputJsonValue);
        }
      }
    }
  }

  const incNorm = params.incoterm?.trim().toUpperCase().slice(0, 16) || null;

  const breakdown: Prisma.InputJsonValue = {
    schemaVersion: COMPOSITE_BREAKDOWN_SCHEMA_VERSION,
    composite: true,
    compositeKind: "MULTI_CONTRACT_VERSION",
    incoterm: incNorm,
    components: parts,
    mergedTotals: {
      grand: total,
      currency,
      currencyAssumption: "SINGLE_CURRENCY",
    },
  };

  const freeTimeBasis: Prisma.InputJsonValue = {
    schemaVersion: 2,
    composite: true,
    source: "COMPOSITE.mergeOfTariffContractVersionFreeTimeRules",
    rules: freeTimeRulesAccum,
  };

  const sourceSummary = `Composite (${params.components.length})${incNorm ? ` · ${incNorm}` : ""} · ${params.components.map((c) => c.role.trim()).join(" + ")}`;

  return {
    currency: currency ?? "USD",
    totalEstimatedCost: total,
    breakdown,
    freeTimeBasis,
    totalDerivation: TOTAL_DERIVATION_COMPOSITE_CONTRACT_VERSIONS,
    sourceSummary,
    anchorContractVersionId: params.components[0]!.contractVersionId.trim(),
    incoterm: incNorm,
  };
}
