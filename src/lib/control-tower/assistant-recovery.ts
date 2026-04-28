export const CT_RECOVERY_STATES = ["TRIAGE", "OWNER_ASSIGNED", "CARRIER_ESCALATED", "CUSTOMER_UPDATED", "RECOVERED"] as const;

export type CtRecoveryState = (typeof CT_RECOVERY_STATES)[number];

export type CtRecoveryExceptionSignal = {
  id: string;
  type: string;
  typeLabel: string;
  severity: string;
  status: string;
  rootCause: string | null;
  ownerName: string | null;
  customerImpact: string | null;
};

export type CtRecoveryShipmentSignal = {
  shipmentNo: string | null;
  trackingNo: string | null;
  carrier: string | null;
  customerName: string | null;
  originCode: string | null;
  destinationCode: string | null;
  latestEta: string | null;
  orderNumber: string | null;
};

export function parseCtRecoveryState(value: unknown): CtRecoveryState | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return CT_RECOVERY_STATES.includes(normalized as CtRecoveryState) ? (normalized as CtRecoveryState) : null;
}

export function buildRecoveryPlan(params: {
  shipment: CtRecoveryShipmentSignal;
  exceptions: CtRecoveryExceptionSignal[];
}) {
  const primary = params.exceptions[0] ?? null;
  const root = primary?.rootCause?.trim() || primary?.typeLabel || "shipment exception";
  const owner = primary?.ownerName ? ` Current owner: ${primary.ownerName}.` : " Assign an owner before escalation.";
  return [
    `Recover ${params.shipment.shipmentNo ?? "shipment"} for ${params.shipment.customerName ?? "the customer"}.`,
    `Primary issue: ${root}.${owner}`,
    "1. Confirm current milestone and blocker with carrier/forwarder.",
    "2. Update ETA and customer impact on the exception.",
    "3. Send customer-safe status update after carrier confirmation.",
    "4. Close recovery only after milestone evidence or customer acknowledgement is captured.",
  ].join("\n");
}

export function buildCarrierDraft(params: {
  shipment: CtRecoveryShipmentSignal;
  exception: CtRecoveryExceptionSignal | null;
}) {
  return [
    "Hi,",
    "",
    `Please confirm recovery status for shipment ${params.shipment.shipmentNo ?? params.shipment.trackingNo ?? ""}.`,
    `Issue: ${params.exception?.typeLabel ?? "open Control Tower exception"}.`,
    params.shipment.latestEta ? `Latest ETA on file: ${params.shipment.latestEta.slice(0, 10)}.` : "Please provide latest ETA and next milestone.",
    "",
    "Reply with root cause, revised ETA, and recovery action owner.",
  ].join("\n");
}

export function buildCustomerDraft(params: {
  shipment: CtRecoveryShipmentSignal;
  exception: CtRecoveryExceptionSignal | null;
}) {
  const customer = params.shipment.customerName ?? "Customer";
  const impact = params.exception?.customerImpact?.trim() || "We are validating the shipment impact and recovery timeline.";
  return [
    `Hi ${customer},`,
    "",
    `We are actively working on shipment ${params.shipment.shipmentNo ?? params.shipment.trackingNo ?? ""}.`,
    impact,
    params.shipment.latestEta ? `Current ETA: ${params.shipment.latestEta.slice(0, 10)}.` : "We will share a confirmed ETA as soon as the carrier responds.",
    "",
    "We will keep you updated as recovery progresses.",
  ].join("\n");
}

export function defaultRecoveryPlaybook() {
  return [
    { id: "assign-owner", label: "Assign recovery owner", done: false },
    { id: "carrier-confirm", label: "Confirm carrier root cause and ETA", done: false },
    { id: "customer-update", label: "Send customer-safe recovery update", done: false },
    { id: "close-evidence", label: "Attach/confirm recovery evidence and close", done: false },
  ];
}
