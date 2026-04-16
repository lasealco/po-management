/**
 * Customer / supplier portal visibility for Control Tower tracking milestones.
 * Operational / customs-style codes stay internal-only on restricted views.
 */

const CUSTOMER_VISIBLE_CT_TRACKING_CODES = new Set([
  "BOOKING_CONFIRMED",
  "POL_DEPARTURE",
  "POD_ARRIVAL",
  "FLIGHT_DEPARTURE",
  "FLIGHT_ARRIVAL",
  "DELIVERY_AVAILABLE",
  "RAIL_ORIGIN_DEPARTURE",
  "RAIL_DESTINATION_ARRIVAL",
  "FINAL_MILE_READY",
]);

export function isCustomerVisibleCtTrackingCode(code: string): boolean {
  return CUSTOMER_VISIBLE_CT_TRACKING_CODES.has(code);
}

export function filterCtTrackingMilestonesForPortal<T extends { code: string }>(rows: T[]): T[] {
  return rows.filter((r) => isCustomerVisibleCtTrackingCode(r.code));
}
