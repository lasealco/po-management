import { prisma } from "@/lib/prisma";

import type { GeoMatchSignals } from "@/lib/scri/matching/geo-signals";
import { normCountry } from "@/lib/scri/matching/geo-signals";
import { R2_MATCH_LIMITS } from "@/lib/scri/matching/run-event-match-limits";

/**
 * Resolve shipment IDs to evaluate for R2 using indexed filters (UN/LOC, country),
 * then cap. Falls back to a recent scan only when the event has region keywords but
 * no structured country / port codes.
 */
export async function resolveShipmentCandidates(
  tenantId: string,
  signals: GeoMatchSignals,
): Promise<string[]> {
  const cap = R2_MATCH_LIMITS.maxShipmentCandidates;
  const hasCountry = signals.countries.size > 0;
  const hasUnloc = signals.unlocs.size > 0;
  const hasRegionOnly =
    !hasCountry &&
    !hasUnloc &&
    signals.regionTerms.some((t) => t.trim().length > 0);

  const unlocList = [...signals.unlocs];
  const countryList = [...signals.countries].map((c) => normCountry(c)!).filter(Boolean);

  const fromUnloc = new Set<string>();

  if (unlocList.length > 0) {
    const [legRows, bookingRows] = await Promise.all([
      prisma.ctShipmentLeg.findMany({
        where: {
          tenantId,
          OR: [{ originCode: { in: unlocList } }, { destinationCode: { in: unlocList } }],
        },
        select: { shipmentId: true },
        take: R2_MATCH_LIMITS.maxUnlocLegHits,
      }),
      prisma.shipmentBooking.findMany({
        where: {
          shipment: { order: { tenantId } },
          OR: [{ originCode: { in: unlocList } }, { destinationCode: { in: unlocList } }],
        },
        select: { shipmentId: true },
        take: R2_MATCH_LIMITS.maxUnlocBookingHits,
      }),
    ]);
    for (const r of legRows) fromUnloc.add(r.shipmentId);
    for (const r of bookingRows) fromUnloc.add(r.shipmentId);
  }

  const fromCountry = new Set<string>();
  if (countryList.length > 0) {
    const countryShipments = await prisma.shipment.findMany({
      where: {
        order: {
          tenantId,
          OR: [
            { shipToCountryCode: { in: countryList } },
            { supplier: { is: { registeredCountryCode: { in: countryList } } } },
          ],
        },
      },
      select: { id: true },
      take: R2_MATCH_LIMITS.maxCountryShipmentHits,
    });
    for (const r of countryShipments) fromCountry.add(r.id);
  }

  const ordered: string[] = [];
  for (const id of fromUnloc) {
    if (ordered.length >= cap) break;
    ordered.push(id);
  }
  for (const id of fromCountry) {
    if (ordered.length >= cap) break;
    if (!fromUnloc.has(id)) ordered.push(id);
  }

  if (ordered.length === 0 && hasRegionOnly) {
    const recent = await prisma.shipment.findMany({
      where: { order: { tenantId } },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
      take: R2_MATCH_LIMITS.maxRegionFallbackShipments,
    });
    return recent.map((r) => r.id);
  }

  return ordered;
}
