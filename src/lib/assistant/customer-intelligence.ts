export type CustomerServiceShipmentSignal = {
  id: string;
  shipmentNo: string | null;
  status: string;
  expectedReceiveAt: string | null;
  receivedAt: string | null;
  openExceptionCount: number;
  openAlertCount: number;
};

export type CustomerServiceOrderSignal = {
  id: string;
  soNumber: string;
  status: string;
  requestedDeliveryDate: string | null;
  assistantReviewStatus: string;
};

export type CustomerServiceInvoiceSignal = {
  id: string;
  externalInvoiceNo: string | null;
  rollupOutcome: string;
  redLineCount: number;
  amberLineCount: number;
};

export type CustomerServiceIncidentSignal = {
  id: string;
  title: string;
  severity: string;
  status: string;
  customerImpact: string | null;
};

export type CustomerIntelligenceInputs = {
  accountName: string;
  industry: string | null;
  segment: string | null;
  strategicFlag: boolean;
  activities: Array<{ subject: string; status: string; dueDate: string | null }>;
  orders: CustomerServiceOrderSignal[];
  shipments: CustomerServiceShipmentSignal[];
  invoices: CustomerServiceInvoiceSignal[];
  incidents: CustomerServiceIncidentSignal[];
};

function dateOnly(value: string | null) {
  return value ? value.slice(0, 10) : null;
}

export function computeCustomerServiceScore(input: CustomerIntelligenceInputs) {
  const lateShipments = input.shipments.filter((shipment) => {
    if (!shipment.expectedReceiveAt) return false;
    if (!shipment.receivedAt) return new Date(shipment.expectedReceiveAt).getTime() < Date.now();
    return new Date(shipment.receivedAt).getTime() > new Date(shipment.expectedReceiveAt).getTime();
  }).length;
  const unresolvedOrders = input.orders.filter((order) => order.assistantReviewStatus !== "APPROVED" && order.assistantReviewStatus !== "PENDING").length;
  const exceptionPressure = input.shipments.reduce((sum, shipment) => sum + shipment.openExceptionCount + shipment.openAlertCount, 0);
  const invoicePressure = input.invoices.reduce((sum, invoice) => sum + invoice.redLineCount * 2 + invoice.amberLineCount, 0);
  const incidentPressure = input.incidents.filter((incident) => incident.status !== "CLOSED").length * 10;
  return Math.max(0, Math.min(100, 100 - lateShipments * 12 - unresolvedOrders * 8 - exceptionPressure * 5 - invoicePressure * 3 - incidentPressure));
}

export function buildPromiseStatus(input: CustomerIntelligenceInputs) {
  const late = input.shipments.filter((shipment) => shipment.expectedReceiveAt && !shipment.receivedAt && new Date(shipment.expectedReceiveAt).getTime() < Date.now());
  const delivered = input.shipments.filter((shipment) => shipment.status === "RECEIVED" || shipment.status === "DELIVERED");
  const openOrders = input.orders.filter((order) => order.status !== "CLOSED");
  return {
    openOrderCount: openOrders.length,
    shipmentCount: input.shipments.length,
    deliveredShipmentCount: delivered.length,
    lateShipmentCount: late.length,
    nextDeliveryDate:
      input.shipments
        .map((shipment) => shipment.expectedReceiveAt)
        .filter((value): value is string => Boolean(value))
        .sort()[0] ?? null,
    status: late.length > 0 ? "AT_RISK" : openOrders.length > 0 ? "ON_TRACK" : "QUIET",
  };
}

export function redactCustomerEvidence(input: {
  text: string;
  canViewSensitive: boolean;
}) {
  if (input.canViewSensitive) return { text: input.text, redactions: [] as string[] };
  const redactions: string[] = [];
  let text = input.text;
  const rules: Array<[RegExp, string, string]> = [
    [/\b(margin|profit|net revenue|buy rate|sell rate)\b/gi, "[commercial detail withheld]", "commercial detail"],
    [/\b(invoice|dispute|red line|amber line|variance)\b/gi, "[finance detail withheld]", "finance detail"],
    [/\b(supplier|vendor|forwarder|carrier)\b/gi, "[partner detail withheld]", "partner detail"],
  ];
  for (const [pattern, replacement, label] of rules) {
    if (pattern.test(text)) {
      redactions.push(label);
      text = text.replace(pattern, replacement);
    }
  }
  return { text, redactions: Array.from(new Set(redactions)) };
}

export function buildCustomerBrief(input: CustomerIntelligenceInputs & { canViewSensitive: boolean }) {
  const serviceScore = computeCustomerServiceScore(input);
  const promise = buildPromiseStatus(input);
  const openIncidents = input.incidents.filter((incident) => incident.status !== "CLOSED");
  const topShipment = input.shipments[0] ?? null;
  const rawEvidence = [
    `${input.accountName} service score is ${serviceScore}/100 with promise status ${promise.status}.`,
    `${promise.openOrderCount} open order(s), ${promise.shipmentCount} shipment(s), ${promise.lateShipmentCount} late shipment signal(s).`,
    openIncidents.length > 0 ? `${openIncidents.length} open incident(s): ${openIncidents.map((incident) => incident.title).join("; ")}.` : "No open customer incident room is linked.",
    input.invoices.length > 0
      ? `${input.invoices.length} invoice audit/dispute signal(s) exist; keep finance detail internal unless authorized.`
      : "No invoice dispute signal found for this account snapshot.",
  ].join("\n");
  const redacted = redactCustomerEvidence({ text: rawEvidence, canViewSensitive: input.canViewSensitive });
  const replyDraft = [
    `Hello,`,
    `Here is the latest service update for ${input.accountName}.`,
    redacted.text,
    topShipment
      ? `Most recent shipment reference: ${topShipment.shipmentNo ?? topShipment.id}, status ${topShipment.status}${topShipment.expectedReceiveAt ? `, expected ${dateOnly(topShipment.expectedReceiveAt)}` : ""}.`
      : "No active shipment reference is available in the current snapshot.",
    "We will continue monitoring open items and will share confirmed operational updates after review.",
  ].join("\n\n");
  return {
    title: `Customer intelligence brief for ${input.accountName}`,
    serviceScore,
    promise,
    accountSnapshot: {
      name: input.accountName,
      industry: input.industry,
      segment: input.segment,
      strategicFlag: input.strategicFlag,
      recentActivityCount: input.activities.length,
    },
    operationsSummary: {
      orders: input.orders,
      shipments: input.shipments,
      promise,
    },
    riskSummary: {
      incidents: openIncidents,
      invoices: input.invoices,
      serviceScore,
    },
    evidence: {
      rawEvidence,
      customerSafeEvidence: redacted.text,
    },
    redaction: {
      applied: !input.canViewSensitive,
      categories: redacted.redactions,
    },
    replyDraft,
  };
}

export function buildCustomerActivityLog(input: { accountName: string; reply: string; approvedBy: string | null }) {
  return {
    subject: `Customer update approved for ${input.accountName}`,
    status: "COMPLETED",
    body: input.reply,
    approvedBy: input.approvedBy,
    loggedAt: new Date().toISOString(),
  };
}
