/**
 * R2 matching scan limits (per tenant, per match run).
 * Prefer indexed candidate queries in `resolve-shipment-candidates.ts` over raising these caps.
 */
export const R2_MATCH_LIMITS = {
  /** Max shipments evaluated for UN/LOC + PO geo + region rules after candidate resolution. */
  maxShipmentCandidates: 4500,
  /** Leg rows read when resolving UN/LOC candidates. */
  maxUnlocLegHits: 12_000,
  /** Booking rows read when resolving UN/LOC candidates. */
  maxUnlocBookingHits: 8000,
  /** Shipments pulled by PO ship-to / supplier country alone. */
  maxCountryShipmentHits: 4500,
  /** When the event only has region keywords (no country / UN/LOC), scan recent shipments. */
  maxRegionFallbackShipments: 2800,
  maxSuppliersByCountry: 800,
  maxPurchaseOrdersScan: 2500,
  maxWarehouses: 500,
  /** Distinct inventory balance rows linked to matched warehouses. */
  maxInventoryBalances: 400,
  createManyChunk: 400,
} as const;
