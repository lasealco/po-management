export const SALES_ORDER_ASSISTANT_REVIEW_STATUSES = [
  "PENDING",
  "APPROVED",
  "NEEDS_CHANGES",
  "REJECTED",
] as const;

export type SalesOrderAssistantReviewStatus = (typeof SALES_ORDER_ASSISTANT_REVIEW_STATUSES)[number];

export type ParsedSalesOrderAssistantLine = {
  id?: string;
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  currency: string;
};

export function parseSalesOrderAssistantReviewStatus(value: unknown): SalesOrderAssistantReviewStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return SALES_ORDER_ASSISTANT_REVIEW_STATUSES.includes(normalized as SalesOrderAssistantReviewStatus)
    ? (normalized as SalesOrderAssistantReviewStatus)
    : null;
}

export function parseSalesOrderAssistantLines(value: unknown): { ok: true; lines: ParsedSalesOrderAssistantLine[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) return { ok: true, lines: [] };
  if (value.length > 50) return { ok: false, error: "At most 50 sales-order lines are allowed." };

  const lines: ParsedSalesOrderAssistantLine[] = [];
  for (const [index, line] of value.entries()) {
    const obj = line && typeof line === "object" ? (line as Record<string, unknown>) : {};
    const productId = typeof obj.productId === "string" && obj.productId.trim() ? obj.productId.trim() : null;
    const description =
      typeof obj.description === "string" && obj.description.trim()
        ? obj.description.trim().slice(0, 1_000)
        : `Sales order line ${index + 1}`;
    const quantity = typeof obj.quantity === "number" ? obj.quantity : Number(obj.quantity);
    const unitPrice = typeof obj.unitPrice === "number" ? obj.unitPrice : Number(obj.unitPrice);
    const currency =
      typeof obj.currency === "string" && obj.currency.trim() ? obj.currency.trim().slice(0, 3).toUpperCase() : "USD";
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { ok: false, error: `Line ${index + 1}: quantity must be greater than zero.` };
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return { ok: false, error: `Line ${index + 1}: unit price must be zero or greater.` };
    }
    lines.push({
      id: typeof obj.id === "string" && obj.id.trim() ? obj.id.trim() : undefined,
      productId,
      description,
      quantity,
      unitPrice,
      currency,
    });
  }

  return { ok: true, lines };
}
