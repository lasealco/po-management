import { prisma } from "@/lib/prisma";
import { getTariffContractVersionForTenant } from "@/lib/tariff/contract-versions";

/** Human label for `BookingPricingSnapshot.sourceType` (audit UI). */
export function formatPricingSnapshotSourceType(sourceType: string): string {
  if (sourceType === "TARIFF_CONTRACT_VERSION") return "Tariff contract version";
  if (sourceType === "QUOTE_RESPONSE") return "RFQ quote response";
  if (sourceType === "COMPOSITE_CONTRACT_VERSION") return "Composite (multi-contract)";
  return sourceType.trim() ? sourceType : "Unknown source";
}

export type PricingSnapshotSourceNav = {
  /** Deep link when the version still exists for this tenant. */
  tariffVersionHref: string | null;
  /** Parent RFQ request (response may be reached from the request page). */
  rfqRequestHref: string | null;
};

/**
 * Resolves in-app navigation from frozen snapshot metadata (best-effort; IDs may be stale after deletes).
 */
export async function resolvePricingSnapshotSourceNav(params: {
  tenantId: string;
  sourceType: string;
  sourceRecordId: string;
}): Promise<PricingSnapshotSourceNav> {
  const id = params.sourceRecordId.trim();
  if (!id) return { tariffVersionHref: null, rfqRequestHref: null };

  if (params.sourceType === "TARIFF_CONTRACT_VERSION" || params.sourceType === "COMPOSITE_CONTRACT_VERSION") {
    const v = await getTariffContractVersionForTenant({ tenantId: params.tenantId, versionId: id });
    if (!v) return { tariffVersionHref: null, rfqRequestHref: null };
    return {
      tariffVersionHref: `/tariffs/contracts/${v.contractHeaderId}/versions/${v.id}`,
      rfqRequestHref: null,
    };
  }

  if (params.sourceType === "QUOTE_RESPONSE") {
    const r = await prisma.quoteResponse.findFirst({
      where: { id, quoteRequest: { tenantId: params.tenantId } },
      select: { quoteRequestId: true },
    });
    if (!r) return { tariffVersionHref: null, rfqRequestHref: null };
    return { tariffVersionHref: null, rfqRequestHref: `/rfq/requests/${r.quoteRequestId}` };
  }

  return { tariffVersionHref: null, rfqRequestHref: null };
}
