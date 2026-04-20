import type {
  Prisma,
  TariffContractStatus,
  TariffLineRateType,
  TariffTransportMode,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** Rate line types treated as the principal leg for POL/POD geography matching. */
export const TARIFF_MAIN_LEG_RATE_TYPES: TariffLineRateType[] = ["BASE_RATE", "ALL_IN"];

const ANCILLARY_RATE_TYPES: TariffLineRateType[] = [
  "PRE_CARRIAGE",
  "ON_CARRIAGE",
  "GATE_IN",
  "GATE_IN_ALL_IN",
  "GATE_IN_GATE_OUT",
  "ADD_ON",
  "LOCAL_CHARGE",
  "SURCHARGE",
  "CUSTOMS",
];

export type TariffRatingInput = {
  tenantId: string;
  pol: string;
  pod: string;
  equipment: string;
  /** Calendar date used for version validity (UTC midnight semantics). */
  asOf: Date;
  transportMode: TariffTransportMode;
  providerIds?: string[];
  /** Max ranked contract versions to return (each uses latest APPROVED+APPROVED version). */
  maxResults?: number;
};

export type TariffRatedLine = {
  kind: "RATE" | "CHARGE";
  id: string;
  label: string;
  rateType?: TariffLineRateType;
  currency: string;
  amount: number;
  /** Included in payable total. */
  payable: boolean;
  /** Why the line was included (debug / UX). */
  matchReason: string;
};

export type TariffRatedCandidate = {
  contractHeaderId: string;
  contractNumber: string | null;
  contractTitle: string;
  versionId: string;
  versionNo: number;
  providerId: string;
  providerLegalName: string;
  providerTradingName: string | null;
  transportMode: TariffTransportMode;
  headerStatus: TariffContractStatus;
  /** Higher is a more specific geography hit on the main leg. */
  geographyScore: number;
  lines: TariffRatedLine[];
  totalsByCurrency: Record<string, number>;
  /** Human-readable caveats (e.g. no strict main-leg match). */
  warnings: string[];
};

function normUnloc(s: string): string {
  return s.trim().toUpperCase();
}

/** Normalize common equipment labels to tariff line tokens (e.g. 40' HC → 40HC). */
export function normalizeEquipmentType(raw: string): string {
  const t = raw.trim().toUpperCase().replaceAll("'", "").replaceAll(" ", "");
  if (t === "40HIGHCUBE" || t === "40HQ" || t === "40HC") return "40HC";
  if (t === "20STANDARD" || t === "20GP" || t === "20DC") return "20GP";
  if (t === "45HC" || t === "45HIGHCUBE") return "45HC";
  return raw.trim().toUpperCase();
}

function equipmentMatches(lineEquipment: string | null | undefined, requested: string): boolean {
  if (!lineEquipment || !lineEquipment.trim()) return true;
  return normalizeEquipmentType(lineEquipment) === normalizeEquipmentType(requested);
}

function chargeEquipmentMatches(scope: string | null | undefined, requested: string): boolean {
  if (!scope || !scope.trim()) return true;
  return normalizeEquipmentType(scope) === normalizeEquipmentType(requested);
}

type GeoMembers = { memberCode: string }[];

function groupContainsUnloc(members: GeoMembers | undefined, unloc: string): boolean {
  if (!members?.length) return false;
  const u = normUnloc(unloc);
  return members.some((m) => normUnloc(m.memberCode) === u);
}

function scopeIsWildcard(group: { members: GeoMembers } | null | undefined): boolean {
  return !group || group.members.length === 0;
}

/** Exported for unit tests — same rules as runtime main-leg matching. */
export function mainLegPolPodMatch(
  origin: { members: GeoMembers } | null | undefined,
  dest: { members: GeoMembers } | null | undefined,
  pol: string,
  pod: string,
): { ok: boolean; score: number } {
  const oWild = scopeIsWildcard(origin);
  const dWild = scopeIsWildcard(dest);
  if (oWild && dWild) return { ok: true, score: 40 };
  const oOk = oWild || groupContainsUnloc(origin?.members, pol);
  const dOk = dWild || groupContainsUnloc(dest?.members, pod);
  if (oOk && dOk) return { ok: true, score: oWild || dWild ? 70 : 100 };
  return { ok: false, score: 0 };
}

function dateOnlyUtc(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function versionIsEffectiveOn(v: { validFrom: Date | null; validTo: Date | null }, asOf: Date): boolean {
  const t = dateOnlyUtc(asOf);
  if (v.validFrom) {
    const f = dateOnlyUtc(v.validFrom);
    if (t < f) return false;
  }
  if (v.validTo) {
    const x = dateOnlyUtc(v.validTo);
    if (t > x) return false;
  }
  return true;
}

function num(v: { toString(): string } | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

function rateLineReason(
  rateType: TariffLineRateType,
  mainOk: boolean,
  pol: string,
  pod: string,
): string {
  if (TARIFF_MAIN_LEG_RATE_TYPES.includes(rateType)) {
    return mainOk ? `Main leg matched ${normUnloc(pol)}→${normUnloc(pod)}` : "Main leg geography relaxed or wildcard";
  }
  if (rateType === "PRE_CARRIAGE") return "Pre-carriage stack";
  if (rateType === "ON_CARRIAGE") return "On-carriage stack";
  return `Ancillary ${rateType}`;
}

function chargeLineIncluded(
  line: {
    geographyScope: { members: GeoMembers } | null;
    isIncluded: boolean;
  },
  pol: string,
  pod: string,
): { ok: boolean; reason: string } {
  if (line.isIncluded) return { ok: true, reason: "Included (informational)" };
  const g = line.geographyScope;
  if (!g || !g.members.length) return { ok: true, reason: "Global charge" };
  if (groupContainsUnloc(g.members, pol) || groupContainsUnloc(g.members, pod)) {
    return { ok: true, reason: "Geography scope matches POL or POD" };
  }
  return { ok: false, reason: "Geography scope does not match POL/POD" };
}

/**
 * Operational v1 rating: pick **approved** contract headers, latest **approved** version per header,
 * filter rate/charge lines by equipment and geography heuristics, rank by main-leg specificity, return totals.
 *
 * This is intentionally conservative on the main leg (BASE_RATE / ALL_IN) and more permissive on ancillaries
 * once a main leg exists on the contract.
 */
export async function rateTariffLane(input: TariffRatingInput): Promise<{
  candidates: TariffRatedCandidate[];
  meta: { pol: string; pod: string; equipment: string; asOf: string; transportMode: TariffTransportMode };
}> {
  const pol = normUnloc(input.pol);
  const pod = normUnloc(input.pod);
  const equipment = normalizeEquipmentType(input.equipment);
  const max = Math.min(Math.max(input.maxResults ?? 12, 1), 50);

  const headerWhere: Prisma.TariffContractHeaderWhereInput = {
    tenantId: input.tenantId,
    transportMode: input.transportMode,
    status: "APPROVED",
    ...(input.providerIds?.length ? { providerId: { in: input.providerIds } } : {}),
  };

  const headers = await prisma.tariffContractHeader.findMany({
    where: headerWhere,
    include: {
      provider: { select: { id: true, legalName: true, tradingName: true } },
      versions: {
        where: { approvalStatus: "APPROVED", status: "APPROVED" },
        orderBy: { versionNo: "desc" },
        take: 1,
        include: {
          rateLines: {
            include: {
              originScope: { include: { members: true } },
              destinationScope: { include: { members: true } },
            },
            orderBy: { id: "asc" },
          },
          chargeLines: {
            include: {
              normalizedChargeCode: { select: { code: true } },
              geographyScope: { include: { members: true } },
            },
            orderBy: { id: "asc" },
          },
        },
      },
    },
  });

  const candidates: TariffRatedCandidate[] = [];

  for (const h of headers) {
    const v = h.versions[0];
    if (!v || !versionIsEffectiveOn(v, input.asOf)) continue;

    let bestMainScore = 0;
    let hasStrictMain = false;
    for (const rl of v.rateLines) {
      if (!equipmentMatches(rl.equipmentType, equipment)) continue;
      if (!TARIFF_MAIN_LEG_RATE_TYPES.includes(rl.rateType)) continue;
      const m = mainLegPolPodMatch(rl.originScope, rl.destinationScope, pol, pod);
      if (m.ok) {
        bestMainScore = Math.max(bestMainScore, m.score);
        if (m.score >= 100) hasStrictMain = true;
      }
    }

    const hasMainLine = v.rateLines.some(
      (rl) => TARIFF_MAIN_LEG_RATE_TYPES.includes(rl.rateType) && equipmentMatches(rl.equipmentType, equipment),
    );

    const warnings: string[] = [];
    if (hasMainLine && !hasStrictMain && bestMainScore > 0 && bestMainScore < 100) {
      warnings.push("Main leg matched with wildcard geography on at least one scope — confirm carrier intent.");
    }

    const lines: TariffRatedLine[] = [];
    let mainMatchedForAncillary = hasStrictMain || bestMainScore > 0;

    if (!hasMainLine) {
      mainMatchedForAncillary = true;
      warnings.push("No BASE_RATE/ALL_IN on this version — equipment-only filter for rate lines.");
    }

    if (hasMainLine && !mainMatchedForAncillary) {
      continue;
    }

    for (const rl of v.rateLines) {
      if (!equipmentMatches(rl.equipmentType, equipment)) continue;

      let include = false;
      let reason = "";

      if (TARIFF_MAIN_LEG_RATE_TYPES.includes(rl.rateType)) {
        const m = mainLegPolPodMatch(rl.originScope, rl.destinationScope, pol, pod);
        include = m.ok;
        reason = rateLineReason(rl.rateType, m.ok, pol, pod);
      } else if (ANCILLARY_RATE_TYPES.includes(rl.rateType)) {
        if (!mainMatchedForAncillary) {
          include = false;
        } else if (rl.rateType === "PRE_CARRIAGE") {
          const dest = rl.destinationScope;
          const origin = rl.originScope;
          const destHit = scopeIsWildcard(dest) || groupContainsUnloc(dest?.members, pol);
          const originHit = scopeIsWildcard(origin) || groupContainsUnloc(origin?.members, pol);
          include = destHit || originHit;
          reason = include ? "Pre-carriage matched POL corridor" : "Skipped pre-carriage (geography)";
        } else if (rl.rateType === "ON_CARRIAGE") {
          const origin = rl.originScope;
          const dest = rl.destinationScope;
          const originHit = scopeIsWildcard(origin) || groupContainsUnloc(origin?.members, pod);
          const destHit = scopeIsWildcard(dest) || groupContainsUnloc(dest?.members, pod);
          include = originHit || destHit;
          reason = include ? "On-carriage matched POD corridor" : "Skipped on-carriage (geography)";
        } else {
          include = true;
          reason = rateLineReason(rl.rateType, true, pol, pod);
        }
      } else {
        include = mainMatchedForAncillary;
        reason = include ? `Rate type ${rl.rateType}` : "Skipped (no main match)";
      }

      if (!include) continue;

      lines.push({
        kind: "RATE",
        id: rl.id,
        label: rl.rawRateDescription?.trim() || `${rl.rateType} (${rl.serviceScope ?? "—"})`,
        rateType: rl.rateType,
        currency: rl.currency,
        amount: num(rl.amount),
        payable: true,
        matchReason: reason,
      });
    }

    for (const cl of v.chargeLines) {
      if (!chargeEquipmentMatches(cl.equipmentScope, equipment)) continue;
      const { ok, reason } = chargeLineIncluded(cl, pol, pod);
      if (!ok) continue;
      lines.push({
        kind: "CHARGE",
        id: cl.id,
        label: cl.rawChargeName,
        currency: cl.currency,
        amount: num(cl.amount),
        payable: !cl.isIncluded,
        matchReason: cl.normalizedChargeCode ? `${reason} · ${cl.normalizedChargeCode.code}` : reason,
      });
    }

    if (lines.length === 0) continue;

    const totalsByCurrency: Record<string, number> = {};
    for (const ln of lines) {
      if (!ln.payable) continue;
      totalsByCurrency[ln.currency] = (totalsByCurrency[ln.currency] ?? 0) + ln.amount;
    }

    candidates.push({
      contractHeaderId: h.id,
      contractNumber: h.contractNumber,
      contractTitle: h.title,
      versionId: v.id,
      versionNo: v.versionNo,
      providerId: h.providerId,
      providerLegalName: h.provider.legalName,
      providerTradingName: h.provider.tradingName,
      transportMode: h.transportMode,
      headerStatus: h.status,
      geographyScore: bestMainScore,
      lines,
      totalsByCurrency,
      warnings,
    });
  }

  candidates.sort((a, b) => {
    if (b.geographyScore !== a.geographyScore) return b.geographyScore - a.geographyScore;
    const ua = a.totalsByCurrency.USD ?? 0;
    const ub = b.totalsByCurrency.USD ?? 0;
    if (ua !== ub) return ua - ub;
    return a.contractTitle.localeCompare(b.contractTitle);
  });

  return {
    candidates: candidates.slice(0, max),
    meta: {
      pol,
      pod,
      equipment,
      asOf: input.asOf.toISOString().slice(0, 10),
      transportMode: input.transportMode,
    },
  };
}
