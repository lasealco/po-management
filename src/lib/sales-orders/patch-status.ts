const ACTIVE_SHIPMENT_STATUSES = new Set(["SHIPPED", "VALIDATED", "BOOKED", "IN_TRANSIT"]);

export type SalesOrderHeaderStatus = "DRAFT" | "OPEN" | "CLOSED";
export type SalesOrderStatusTransitionErrorCode = "INVALID_TRANSITION" | "ACTIVE_SHIPMENTS";

const SALES_ORDER_STATUSES: readonly SalesOrderHeaderStatus[] = ["DRAFT", "OPEN", "CLOSED"];

function isSalesOrderHeaderStatus(value: string): value is SalesOrderHeaderStatus {
  return (SALES_ORDER_STATUSES as readonly string[]).includes(value);
}

export type SalesOrderShipmentForStatusPatch = {
  id: string;
  status: string;
  shipmentNo: string | null;
};

export function parseSalesOrderRouteId(
  raw: string,
): { ok: true; id: string } | { ok: false; status: 400; error: string } {
  const id = raw.trim();
  if (!id) {
    return { ok: false, status: 400, error: "Sales order id is required." };
  }
  return { ok: true, id };
}

export function parseSalesOrderPatchRequestBody(
  body: unknown,
): { ok: true; record: Record<string, unknown> } | { ok: false; status: 400; error: string } {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Expected JSON object body." };
  }
  return { ok: true, record: body as Record<string, unknown> };
}

export function parseTargetSalesOrderStatus(
  record: Record<string, unknown>,
): { ok: true; status: SalesOrderHeaderStatus } | { ok: false; error: string } {
  const raw = record.status;
  if (raw === undefined) {
    return { ok: false, error: "Field `status` is required." };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "Field `status` must be a string (DRAFT, OPEN, or CLOSED)." };
  }
  const target = raw.trim().toUpperCase();
  if (!isSalesOrderHeaderStatus(target)) {
    return { ok: false, error: "status must be DRAFT, OPEN, or CLOSED." };
  }
  return { ok: true, status: target };
}

const ALLOWED_TRANSITIONS: Record<SalesOrderHeaderStatus, SalesOrderHeaderStatus[]> = {
  DRAFT: ["OPEN", "CLOSED"],
  OPEN: ["DRAFT", "CLOSED"],
  CLOSED: ["OPEN"],
};

export type SalesOrderStatusTransitionResult =
  | { ok: true }
  | {
      ok: false;
      status: 409;
      code: SalesOrderStatusTransitionErrorCode;
      error: string;
      activeShipments?: Array<{ id: string; shipmentNo: string | null; status: string }>;
    };

export function evaluateSalesOrderStatusTransition(input: {
  current: SalesOrderHeaderStatus;
  target: SalesOrderHeaderStatus;
  shipments: SalesOrderShipmentForStatusPatch[];
}): SalesOrderStatusTransitionResult {
  const { current, target, shipments } = input;
  const allowed = ALLOWED_TRANSITIONS[current];
  if (!allowed?.includes(target)) {
    return {
      ok: false,
      status: 409,
      code: "INVALID_TRANSITION",
      error: `Cannot change status from ${current} to ${target}.`,
    };
  }

  if (target === "CLOSED") {
    const active = shipments.filter((s) => ACTIVE_SHIPMENT_STATUSES.has(s.status));
    if (active.length > 0) {
      return {
        ok: false,
        status: 409,
        code: "ACTIVE_SHIPMENTS",
        error: "Cannot close sales order while linked shipments are active.",
        activeShipments: active.map((s) => ({
          id: s.id,
          shipmentNo: s.shipmentNo,
          status: s.status,
        })),
      };
    }
  }

  return { ok: true };
}
