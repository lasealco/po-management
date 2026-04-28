export const SUPPLIER_ASSISTANT_EXECUTION_STATUSES = ["PENDING", "REVIEWED", "FOLLOW_UP_QUEUED", "CLOSED"] as const;

export type SupplierAssistantExecutionStatus = (typeof SUPPLIER_ASSISTANT_EXECUTION_STATUSES)[number];

export type SupplierAssistantOrderSignal = {
  id: string;
  orderNumber: string;
  title: string | null;
  statusCode: string | null;
  statusLabel: string | null;
  requestedDeliveryDate: string | null;
  totalAmount: string;
  currency: string;
  itemCount: number;
};

export type SupplierAssistantTaskSignal = {
  id: string;
  taskKey: string;
  title: string;
  done: boolean;
  dueAt: string | null;
  notes: string | null;
};

export function parseSupplierAssistantExecutionStatus(value: unknown): SupplierAssistantExecutionStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return SUPPLIER_ASSISTANT_EXECUTION_STATUSES.includes(normalized as SupplierAssistantExecutionStatus)
    ? (normalized as SupplierAssistantExecutionStatus)
    : null;
}

export function needsSupplierFollowUp(order: SupplierAssistantOrderSignal, now = new Date()): boolean {
  const status = (order.statusCode ?? order.statusLabel ?? "").toLowerCase();
  const final = status.includes("received") || status.includes("cancel") || status.includes("reject");
  if (final) return false;
  if (status.includes("sent") || status.includes("supplier") || status.includes("approved")) return true;
  if (!order.requestedDeliveryDate) return false;
  const due = new Date(order.requestedDeliveryDate);
  return Number.isFinite(due.getTime()) && due.getTime() < now.getTime();
}

export function buildSupplierPerformanceBrief(params: {
  supplierName: string;
  orderCount: number;
  awaitingConfirmation: number;
  onTimeShipPct: number | null;
  openSignals: SupplierAssistantOrderSignal[];
}) {
  const onTime =
    params.onTimeShipPct == null ? "On-time shipment percentage is not available yet." : `On-time shipment rate is ${params.onTimeShipPct}%.`;
  const followUps = params.openSignals.filter((order) => needsSupplierFollowUp(order));
  const followUpLine =
    followUps.length > 0
      ? `${followUps.length} purchase order${followUps.length === 1 ? "" : "s"} need acknowledgement or shipment follow-up.`
      : "No urgent PO follow-up is visible from current order signals.";
  return [
    `${params.supplierName} has ${params.orderCount} linked parent purchase order${params.orderCount === 1 ? "" : "s"}.`,
    `${params.awaitingConfirmation} order${params.awaitingConfirmation === 1 ? "" : "s"} are awaiting confirmation.`,
    onTime,
    followUpLine,
  ].join("\n");
}

export function buildSupplierOnboardingGapPlan(tasks: SupplierAssistantTaskSignal[]) {
  const open = tasks.filter((task) => !task.done);
  if (open.length === 0) return "All tracked onboarding tasks are complete. Keep documents and contacts current.";
  return open
    .slice(0, 8)
    .map((task, index) => {
      const due = task.dueAt ? ` Due: ${task.dueAt.slice(0, 10)}.` : "";
      const note = task.notes ? ` Note: ${task.notes.slice(0, 160)}` : "";
      return `${index + 1}. ${task.title}.${due}${note}`;
    })
    .join("\n");
}

export function buildSupplierFollowUpMessage(params: {
  supplierName: string;
  order: SupplierAssistantOrderSignal;
}) {
  const due = params.order.requestedDeliveryDate ? ` Requested delivery: ${params.order.requestedDeliveryDate.slice(0, 10)}.` : "";
  return [
    `Hi ${params.supplierName},`,
    "",
    `Can you please confirm the current status and next milestone for PO ${params.order.orderNumber}?${due}`,
    "Please reply with acknowledgement, expected ship date, and any blockers so we can update the buyer workspace.",
  ].join("\n");
}
