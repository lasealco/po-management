/** Many demo / WMS flows set `shipmentNo` to an ASN-style carrier reference (e.g. ASN-GEN-00409). */
export function isLikelyAsnStyleShipmentNo(shipmentNo: string | null | undefined): boolean {
  const s = shipmentNo?.trim() ?? "";
  return s.length > 0 && /^ASN/i.test(s);
}

/** Primary title for tower lists: prefer human PO when the stored shipment no looks like an ASN ref. */
export function controlTowerListPrimaryTitle(params: {
  orderNumber: string;
  shipmentNo: string | null;
  id: string;
}): string {
  const { orderNumber, shipmentNo, id } = params;
  if (shipmentNo && !isLikelyAsnStyleShipmentNo(shipmentNo)) return shipmentNo;
  if (orderNumber.trim()) return orderNumber.trim();
  return shipmentNo?.trim() || id.slice(0, 8);
}

/** Secondary line (ASN ref, etc.) when it differs from the primary title. */
export function controlTowerListSecondaryRef(params: {
  orderNumber: string;
  shipmentNo: string | null;
  id: string;
}): string | null {
  const primary = controlTowerListPrimaryTitle(params);
  const raw = params.shipmentNo?.trim() || "";
  if (!raw || raw === primary) return null;
  return raw;
}
