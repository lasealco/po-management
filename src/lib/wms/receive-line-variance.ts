import type { WmsShipmentItemVarianceDisposition } from "@prisma/client";

/** Numeric tolerance when comparing shipped vs received qty on ASN/shipment lines. */
export const RECEIVE_LINE_QTY_EPSILON = 1e-6;

/** Derive MATCH | SHORT | OVER from quantities when operator does not force DAMAGED/OTHER. */
export function deriveVarianceDisposition(
  quantityShipped: number,
  quantityReceived: number,
): Exclude<WmsShipmentItemVarianceDisposition, "UNSET" | "DAMAGED" | "OTHER"> {
  const d = quantityReceived - quantityShipped;
  if (Math.abs(d) <= RECEIVE_LINE_QTY_EPSILON) return "MATCH";
  if (d < -RECEIVE_LINE_QTY_EPSILON) return "SHORT";
  return "OVER";
}

const EXPLICIT: WmsShipmentItemVarianceDisposition[] = [
  "MATCH",
  "SHORT",
  "OVER",
  "DAMAGED",
  "OTHER",
];

/** Normalize optional API string to disposition; invalid → derive from qtys. */
export function resolveVarianceDisposition(
  quantityShipped: number,
  quantityReceived: number,
  explicitRaw: string | undefined | null,
): WmsShipmentItemVarianceDisposition {
  const t = explicitRaw?.trim().toUpperCase();
  if (t && (EXPLICIT as string[]).includes(t)) {
    return t as WmsShipmentItemVarianceDisposition;
  }
  return deriveVarianceDisposition(quantityShipped, quantityReceived);
}
