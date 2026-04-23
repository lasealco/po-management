/** Deep link for an affected internal object (R2). */
export function scriObjectHref(objectType: string, objectId: string): string | null {
  switch (objectType) {
    case "SHIPMENT":
      return `/control-tower/shipments/${objectId}`;
    case "PURCHASE_ORDER":
      return `/orders/${objectId}`;
    case "SUPPLIER":
      return `/suppliers/${objectId}`;
    case "SALES_ORDER":
      return `/sales-orders/${objectId}`;
    default:
      return null;
  }
}
