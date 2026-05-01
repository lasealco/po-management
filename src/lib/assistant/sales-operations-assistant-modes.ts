export type AssistantWorkbenchMode = "sales-order" | "stock" | "trace" | "drafts";

export function normalizeAssistantUrlMode(modeParam: string | null): AssistantWorkbenchMode {
  if (modeParam === "stock" || modeParam === "trace" || modeParam === "drafts" || modeParam === "sales-order") {
    return modeParam;
  }
  return "sales-order";
}

export const MODE_CENTER_TITLES: Record<AssistantWorkbenchMode, string> = {
  "sales-order": "Create sales order draft",
  stock: "Check stock",
  trace: "Trace product movement",
  drafts: "Review drafts",
};

export const MODE_PLACEHOLDERS: Record<AssistantWorkbenchMode, string> = {
  "sales-order": "Paste a customer order, email text, or describe the sales order…",
  stock: "Ask about stock by product name, SKU, customer wording, warehouse, lot, or batch…",
  trace: "Enter product, PO, shipment, lot, customer, or order reference to trace movement…",
  drafts: "Search open drafts or ask what needs review…",
};

export const SAMPLE_SALES_ORDER =
  "John from ABC customer called and wants 100 corr-roll for 100 USD a piece. He will send a truck to pick up at our demo warehouse next week tuesday.";

export const SAMPLE_STOCK = "How much corr-roll do we have in stock at the demo warehouse?";

export const SAMPLE_TRACE =
  "Trace corr-roll: show inventory, shipments, and PO links for the demo warehouse.";

export const SAMPLE_DRAFTS_REVIEW = "Which draft sales orders still need review before we confirm them?";

export function buildGuidedSalesOrderPrompt(fields: {
  customer: string;
  deliveryAddress: string;
  productSku: string;
  quantity: string;
  requestedDeliveryDate: string;
  specialInstructions: string;
}): string {
  const chunks = [
    "Create a sales order draft",
    fields.customer.trim() && `for customer ${fields.customer.trim()}`,
    fields.deliveryAddress.trim() && `Delivery address: ${fields.deliveryAddress.trim()}`,
    fields.productSku.trim() && `Product/SKU: ${fields.productSku.trim()}`,
    fields.quantity.trim() && `Quantity: ${fields.quantity.trim()}`,
    fields.requestedDeliveryDate.trim() && `Requested delivery date: ${fields.requestedDeliveryDate.trim()}`,
    fields.specialInstructions.trim() && `Special instructions: ${fields.specialInstructions.trim()}`,
  ].filter(Boolean);
  return chunks.join(". ") + ".";
}

export function buildGuidedStockPrompt(fields: {
  productSku: string;
  customer: string;
  warehouse: string;
  lotBatch: string;
}): string {
  const chunks = [
    "Check stock",
    fields.productSku.trim() && `for product/SKU ${fields.productSku.trim()}`,
    fields.customer.trim() && `relevant to customer ${fields.customer.trim()}`,
    fields.warehouse.trim() && `warehouse ${fields.warehouse.trim()}`,
    fields.lotBatch.trim() && `lot/batch ${fields.lotBatch.trim()}`,
  ].filter(Boolean);
  return chunks.join("; ") + ".";
}

export function buildGuidedTracePrompt(fields: {
  productSku: string;
  poNumber: string;
  shipmentRef: string;
  lotBatch: string;
  customer: string;
}): string {
  const chunks = [
    "Trace product movement",
    fields.productSku.trim() && `product/SKU ${fields.productSku.trim()}`,
    fields.poNumber.trim() && `PO ${fields.poNumber.trim()}`,
    fields.shipmentRef.trim() && `shipment ${fields.shipmentRef.trim()}`,
    fields.lotBatch.trim() && `lot/batch ${fields.lotBatch.trim()}`,
    fields.customer.trim() && `customer ${fields.customer.trim()}`,
  ].filter(Boolean);
  return chunks.join("; ") + ".";
}
