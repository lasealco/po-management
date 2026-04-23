import type { SrmSupplierCategory, SupplierApprovalStatus } from "@prisma/client";

export type BoardViewerMode = "buyer" | "supplier";

export type WorkbenchNextOwner = "buyer" | "supplier" | "operations" | "system";

export type ConversationSlaSlice = {
  awaitingReplyFrom: "buyer" | "supplier" | null;
  daysSinceLastShared: number | null;
  lastSharedAt: string | null;
};

export type LogisticsRollup = {
  logisticsStatus: "NONE" | "SHIPPED" | "PARTIALLY_RECEIVED" | "RECEIVED";
  /** True if any shipment ties to a sales order. */
  linkedToSalesOrder: boolean;
  /** Forwarder booking still in draft or sent (not confirmed). */
  bookingPending: boolean;
  /** Shipped quantity exists but no ASN reference on that shipment. */
  missingAsnOnActiveShipment: boolean;
  /** Single-line hint under the Ship badge. */
  logisticsDetail: string | null;
};

export type ShipmentForBoardRollup = {
  salesOrderId: string | null;
  asnReference: string | null;
  expectedReceiveAt: Date | null;
  items: { quantityShipped: { toString(): string }; quantityReceived: { toString(): string } }[];
  booking: { status: string } | null;
};

export function buildConversationSla(latestShared:
  | {
      createdAt: Date;
      authorRoleNames: string[];
    }
  | undefined): ConversationSlaSlice {
  if (!latestShared) {
    return { awaitingReplyFrom: null, daysSinceLastShared: null, lastSharedAt: null };
  }
  const fromSupplier = latestShared.authorRoleNames.includes("Supplier portal");
  const awaitingReplyFrom: "buyer" | "supplier" = fromSupplier ? "buyer" : "supplier";
  const daysSinceLastShared = Math.max(
    0,
    Math.floor((Date.now() - latestShared.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
  );
  return {
    awaitingReplyFrom,
    daysSinceLastShared,
    lastSharedAt: latestShared.createdAt.toISOString(),
  };
}

export function buildLogisticsRollup(shipments: ShipmentForBoardRollup[]): LogisticsRollup {
  let shippedTotal = 0;
  let receivedTotal = 0;
  let linkedToSalesOrder = false;
  let bookingPending = false;
  let missingAsnOnActiveShipment = false;

  for (const s of shipments) {
    if (s.salesOrderId) linkedToSalesOrder = true;
    const st = s.booking?.status;
    if (st === "DRAFT" || st === "SENT") bookingPending = true;
    let shipQty = 0;
    for (const it of s.items) {
      const q = Number(it.quantityShipped.toString());
      const r = Number(it.quantityReceived.toString());
      if (Number.isFinite(q)) shipQty += q;
      if (Number.isFinite(r)) receivedTotal += r;
    }
    shippedTotal += shipQty;
    if (shipQty > 0 && !(s.asnReference && s.asnReference.trim())) {
      missingAsnOnActiveShipment = true;
    }
  }

  const logisticsStatus: LogisticsRollup["logisticsStatus"] =
    shippedTotal <= 0
      ? "NONE"
      : receivedTotal <= 0
        ? "SHIPPED"
        : receivedTotal < shippedTotal
          ? "PARTIALLY_RECEIVED"
          : "RECEIVED";

  const hints: string[] = [];
  if (bookingPending) hints.push("Booking pending");
  if (missingAsnOnActiveShipment) hints.push("ASN missing on shipped leg");
  if (linkedToSalesOrder) hints.push("SO linked");

  return {
    logisticsStatus,
    linkedToSalesOrder,
    bookingPending,
    missingAsnOnActiveShipment,
    logisticsDetail: hints.length ? hints.slice(0, 2).join(" · ") : null,
  };
}

export function buildSupplierSignals(
  supplier: {
    srmCategory: SrmSupplierCategory;
    approvalStatus: SupplierApprovalStatus;
  } | null,
): string[] {
  if (!supplier) return [];
  const out: string[] = [];
  if (supplier.srmCategory === "logistics") out.push("Logistics partner");
  if (supplier.approvalStatus === "pending_approval") out.push("Supplier approval pending");
  if (supplier.approvalStatus === "rejected") out.push("Supplier rejected");
  return out;
}

const HIGH_VALUE_USD = 100_000;

export function buildImpactTags(input: {
  totalAmount: string;
  currency: string;
  linkedToSalesOrder: boolean;
  requestedDeliveryOverdue: boolean;
  bookingPending: boolean;
}): string[] {
  const tags: string[] = [];
  if (input.linkedToSalesOrder) tags.push("SO linked");
  const amt = Number(input.totalAmount);
  if (input.currency === "USD" && Number.isFinite(amt) && amt >= HIGH_VALUE_USD) tags.push("High value");
  if (input.requestedDeliveryOverdue) tags.push("Past due date");
  if (input.bookingPending) tags.push("Booking hold");
  return tags;
}

export function computeLogisticsBlocked(input: {
  statusCode: string;
  logisticsStatus: LogisticsRollup["logisticsStatus"];
  bookingPending: boolean;
  missingAsnOnActiveShipment: boolean;
}): boolean {
  if (input.bookingPending) return true;
  if (input.statusCode === "CONFIRMED" && input.logisticsStatus === "NONE") return true;
  if (input.missingAsnOnActiveShipment) return true;
  return false;
}

export function computeWorkbenchNextStep(input: {
  statusCode: string;
  viewerMode: BoardViewerMode;
  allowedActionLabels: string[];
  conversationSla: ConversationSlaSlice;
  logisticsStatus: LogisticsRollup["logisticsStatus"];
  bookingPending: boolean;
}): {
  nextOwner: WorkbenchNextOwner;
  nextActionLabel: string;
  nextActionDetail: string;
} {
  const { statusCode, viewerMode, allowedActionLabels, conversationSla, logisticsStatus, bookingPending } = input;

  if (statusCode === "SPLIT_PENDING_BUYER") {
    return {
      nextOwner: "buyer",
      nextActionLabel: "Decide on split proposal",
      nextActionDetail:
        viewerMode === "buyer"
          ? "Review supplier split lines and accept or reject in order detail."
          : "Waiting on buyer to accept or reject the split.",
    };
  }

  if (bookingPending && viewerMode === "buyer") {
    return {
      nextOwner: "operations",
      nextActionLabel: "Forwarder booking in progress",
      nextActionDetail: "Booking request draft or awaiting carrier confirmation.",
    };
  }

  if (statusCode === "SENT") {
    const thread = conversationSla.awaitingReplyFrom
      ? `Shared thread: last message ${conversationSla.daysSinceLastShared ?? 0}d ago.`
      : "No shared supplier thread yet.";
    return {
      nextOwner: "supplier",
      nextActionLabel: "Awaiting supplier confirmation",
      nextActionDetail: thread,
    };
  }

  if (conversationSla.awaitingReplyFrom === "buyer") {
    const urgency =
      (conversationSla.daysSinceLastShared ?? 0) >= 5
        ? "SLA critical — reply overdue."
        : (conversationSla.daysSinceLastShared ?? 0) >= 2
          ? "SLA warning — reply soon."
          : "Reply to keep the thread moving.";
    return {
      nextOwner: "buyer",
      nextActionLabel: "Buyer reply needed",
      nextActionDetail: urgency,
    };
  }

  if (conversationSla.awaitingReplyFrom === "supplier") {
    return {
      nextOwner: "supplier",
      nextActionLabel: "Awaiting supplier reply",
      nextActionDetail: `Last buyer message ${conversationSla.daysSinceLastShared ?? 0}d ago.`,
    };
  }

  if (allowedActionLabels.length > 0) {
    return {
      nextOwner: viewerMode,
      nextActionLabel: allowedActionLabels[0] ?? "Workflow action available",
      nextActionDetail:
        allowedActionLabels.length > 1
          ? `${allowedActionLabels.length} actions available on this row.`
          : "Use the action buttons to move the PO forward.",
    };
  }

  if (logisticsStatus === "NONE" && (statusCode === "CONFIRMED" || statusCode === "FULFILLED")) {
    return {
      nextOwner: "operations",
      nextActionLabel: "Shipment / ASN setup",
      nextActionDetail: "PO confirmed but no shipped quantity recorded yet.",
    };
  }

  return {
    nextOwner: "system",
    nextActionLabel: "No immediate action",
    nextActionDetail: "Monitor or open detail for history and documents.",
  };
}
