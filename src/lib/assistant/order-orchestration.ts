export type OrderOrchestrationDemandLine = {
  description: string;
  quantity: number;
  productId?: string | null;
  productName?: string | null;
};

export type OrderOrchestrationAtpLine = {
  description: string;
  quantity: number;
  availableNow: number;
  inboundQty: number;
  shortageQty: number;
};

export function parseOrderDemandText(text: string): { title: string; lines: OrderOrchestrationDemandLine[] } {
  const cleaned = text.trim().replace(/\s+/g, " ");
  const quantityMatch = cleaned.match(/(?:qty|quantity|x)\s*[:#-]?\s*(\d+(?:\.\d+)?)/i) ?? cleaned.match(/\b(\d+(?:\.\d+)?)\s*(?:units|pcs|pieces|ea|x)\b/i);
  const quantity = quantityMatch ? Number(quantityMatch[1]) : 1;
  const title = cleaned.slice(0, 120) || "Assistant order orchestration";
  return {
    title,
    lines: [
      {
        description: cleaned || "Demand line",
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      },
    ],
  };
}

export function computeLinePromise(line: OrderOrchestrationAtpLine) {
  const promiseStatus =
    line.shortageQty <= 0 ? "PROMISE_READY" : line.inboundQty >= line.shortageQty ? "SPLIT_OR_INBOUND_RECOVERY" : "NEEDS_SUPPLY_RECOVERY";
  const immediateQty = Math.min(line.quantity, line.availableNow);
  const laterQty = Math.max(0, line.quantity - immediateQty);
  return {
    ...line,
    immediateQty,
    laterQty,
    promiseStatus,
  };
}

export function buildOrderOrchestrationProposal(lines: OrderOrchestrationAtpLine[]) {
  const promised = lines.map(computeLinePromise);
  const needsRecovery = promised.some((line) => line.shortageQty > 0);
  const splitRequired = promised.some((line) => line.laterQty > 0);
  return {
    status: needsRecovery ? "NEEDS_APPROVAL" : "PROMISE_READY",
    splitRequired,
    reservationPolicy: "Human approval required before reservation, allocation, stock move, or split order creation.",
    lines: promised,
    actions: [
      splitRequired ? "Approve split/partial fulfillment plan before customer confirmation." : "Confirm customer promise with current ATP evidence.",
      needsRecovery ? "Queue supply or warehouse recovery for shortage lines." : "Monitor promise through shipment creation.",
      "Do not mutate inventory or create shipment reservations silently.",
    ],
  };
}

export function buildOrderOrchestrationSummary(input: {
  customerName: string | null;
  lineCount: number;
  proposal: ReturnType<typeof buildOrderOrchestrationProposal>;
}) {
  return [
    `Order orchestration plan for ${input.customerName ?? "unmatched customer"} with ${input.lineCount} demand line${input.lineCount === 1 ? "" : "s"}.`,
    `Plan status: ${input.proposal.status}; split required: ${input.proposal.splitRequired ? "yes" : "no"}.`,
    input.proposal.reservationPolicy,
  ].join("\n");
}
