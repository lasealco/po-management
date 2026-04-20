export const SALES_ORDER_STATUSES = ["DRAFT", "OPEN", "CLOSED"] as const;

export type SalesOrderStatus = (typeof SALES_ORDER_STATUSES)[number];

type PatchPayloadError = { ok: false; error: string };

type PatchPayloadSuccess = { ok: true; status: SalesOrderStatus };

export type ParseSalesOrderPatchPayloadResult = PatchPayloadError | PatchPayloadSuccess;

const ALLOWED_TRANSITIONS: Record<SalesOrderStatus, readonly SalesOrderStatus[]> = {
  DRAFT: ["OPEN", "CLOSED"],
  OPEN: ["DRAFT", "CLOSED"],
  CLOSED: ["OPEN"],
};

export function parseSalesOrderPatchPayload(body: unknown): ParseSalesOrderPatchPayloadResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const payload = body as Record<string, unknown>;
  const status = typeof payload.status === "string" ? payload.status.trim().toUpperCase() : "";
  if (!status) {
    return { ok: false, error: "status is required." };
  }
  if (!isSalesOrderStatus(status)) {
    return { ok: false, error: "status must be DRAFT | OPEN | CLOSED" };
  }

  return { ok: true, status };
}

export function canTransitionSalesOrderStatus(
  current: SalesOrderStatus,
  target: SalesOrderStatus,
): { ok: true } | { ok: false; error: string } {
  if (current === target) {
    return { ok: false, error: `Sales order is already ${current}.` };
  }

  if (!ALLOWED_TRANSITIONS[current].includes(target)) {
    return { ok: false, error: `Cannot change status from ${current} to ${target}.` };
  }

  return { ok: true };
}

function isSalesOrderStatus(value: string): value is SalesOrderStatus {
  return (SALES_ORDER_STATUSES as readonly string[]).includes(value);
}
