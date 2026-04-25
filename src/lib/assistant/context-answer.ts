import type { Prisma } from "@prisma/client";

import { controlTowerShipmentAccessWhere, getControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { prisma } from "@/lib/prisma";

export type AssistantContextAnswer =
  | { kind: "defer" }
  | { kind: "not_found"; message: string }
  | {
      kind: "answer";
      message: string;
      evidence: { label: string; href: string }[];
      playbook?: AssistantPlaybook;
      actions?: AssistantProposedAction[];
    };

export type AssistantPlaybook = {
  id: string;
  title: string;
  description: string;
  steps: AssistantPlaybookStep[];
};

export type AssistantPlaybookStep = {
  id: string;
  label: string;
  description: string;
  status: "done" | "available" | "needs_review";
  actionIds?: string[];
};

export type AssistantProposedAction =
  | {
      id: string;
      kind: "navigate";
      label: string;
      description: string;
      href: string;
    }
  | {
      id: string;
      kind: "copy_text";
      label: string;
      description: string;
      text: string;
    };

function extractTokenAfter(text: string, labels: string[]) {
  for (const label of labels) {
    const re = new RegExp(`${label}\\s+([a-z0-9][a-z0-9_-]{4,})`, "i");
    const m = text.match(re);
    if (m?.[1]) return m[1].replace(/[.,;:!?)]$/, "");
  }
  return null;
}

function dateLabel(value: Date | string | null | undefined) {
  if (!value) return "not set";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "not set";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function activeShipment(status: string) {
  return ["SHIPPED", "VALIDATED", "BOOKED", "IN_TRANSIT"].includes(status);
}

function salesOrderNextAction(status: string, activeCount: number, shipmentCount: number) {
  if (status === "DRAFT") return "Next action: review the customer commitment, complete any missing details, then transition the SO when it is ready.";
  if (status === "OPEN" && activeCount > 0) return "Next action: monitor the active shipment(s) and prepare customer updates around carrier, tracking, and delivery timing.";
  if (status === "OPEN" && shipmentCount === 0) return "Next action: create or attach a shipment so operations can execute against this customer commitment.";
  if (status === "CLOSED") return "Next action: no operational action is required unless a customer follow-up or exception reopens the work.";
  return "Next action: review status and linked shipments before committing another customer update.";
}

export async function answerSalesOrderContext({
  tenantId,
  token,
}: {
  tenantId: string;
  token: string;
}): Promise<AssistantContextAnswer> {
  const row = await prisma.salesOrder.findFirst({
    where: {
      tenantId,
      OR: [{ id: token }, { soNumber: { equals: token, mode: "insensitive" } }],
    },
    include: {
      servedOrgUnit: { select: { name: true, code: true } },
      shipments: {
        orderBy: { createdAt: "desc" },
        select: { id: true, shipmentNo: true, status: true, transportMode: true, carrier: true, trackingNo: true },
      },
      assistantEmailThreads: {
        orderBy: { updatedAt: "desc" },
        take: 3,
        select: { id: true, subject: true, status: true, lastSendConfirmAt: true },
      },
    },
  });
  if (!row) {
    return { kind: "not_found", message: `I could not find sales order "${token}" in this tenant.` };
  }

  const activeCount = row.shipments.filter((s) => activeShipment(s.status)).length;
  const newestShipment = row.shipments[0] ?? null;
  const linkedMail = row.assistantEmailThreads[0] ?? null;
  const message = [
    `Sales order ${row.soNumber} is ${row.status} for ${row.customerName}.`,
    `Requested delivery: ${dateLabel(row.requestedDeliveryDate)}. Order-for org: ${row.servedOrgUnit?.name ?? "not set"}.`,
    `Linked shipments: ${row.shipments.length} total, ${activeCount} active.`,
    newestShipment
      ? `Latest shipment: ${newestShipment.shipmentNo ?? newestShipment.id} is ${newestShipment.status}, mode ${newestShipment.transportMode ?? "not set"}, carrier ${newestShipment.carrier ?? "not set"}, tracking ${newestShipment.trackingNo ?? "not set"}.`
      : "No shipment is linked yet.",
    linkedMail ? `Assistant mail context: latest linked thread "${linkedMail.subject}" is ${linkedMail.status}.` : null,
    salesOrderNextAction(row.status, activeCount, row.shipments.length),
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  return {
    kind: "answer",
    message,
    evidence: [
      { label: `Sales order ${row.soNumber}`, href: `/sales-orders/${row.id}` },
      ...row.shipments.slice(0, 3).map((s) => ({
        label: `Shipment ${s.shipmentNo ?? s.id}`,
        href: `/control-tower/shipments/${s.id}`,
      })),
      ...row.assistantEmailThreads.slice(0, 2).map((t) => ({
        label: `Mail thread: ${t.subject}`,
        href: `/assistant/mail?thread=${t.id}`,
      })),
    ],
    playbook: {
      id: "sales-order-follow-up",
      title: "Sales order follow-up",
      description: "Review the customer commitment, inspect linked execution work, then prepare a human-approved update.",
      steps: [
        {
          id: "review-so",
          label: "Review the sales order",
          description: "Confirm customer, status, requested delivery, notes, and order-for organization.",
          status: "available",
          actionIds: ["open-sales-order"],
        },
        {
          id: "review-execution",
          label: newestShipment ? "Review linked shipment" : "Create or attach execution work",
          description: newestShipment
            ? "Check carrier, tracking, milestones, alerts, and exceptions before promising an update."
            : "No shipment is linked yet; operations needs an execution record before fulfillment can be tracked.",
          status: newestShipment ? "available" : "needs_review",
          actionIds: newestShipment ? ["open-latest-shipment"] : ["open-sales-order"],
        },
        {
          id: "review-thread",
          label: linkedMail ? "Review source conversation" : "Check communication context",
          description: linkedMail
            ? "Open the linked mail thread before sending or revising a customer reply."
            : "No linked mail thread is attached; keep outbound communication in the customer context.",
          status: linkedMail ? "available" : "needs_review",
          actionIds: linkedMail ? ["open-linked-mail"] : undefined,
        },
        {
          id: "draft-update",
          label: "Prepare customer update",
          description: "Copy the drafted update and decide where and whether to send it.",
          status: "available",
          actionIds: ["copy-customer-update"],
        },
      ],
    },
    actions: [
      {
        id: "open-sales-order",
        kind: "navigate",
        label: "Open sales order",
        description: "Review the SO before changing status or adding operational details.",
        href: `/sales-orders/${row.id}`,
      },
      ...(newestShipment
        ? [
            {
              id: "open-latest-shipment",
              kind: "navigate" as const,
              label: "Open latest shipment",
              description: "Check carrier, tracking, milestones, alerts, and exceptions before updating the customer.",
              href: `/control-tower/shipments/${newestShipment.id}`,
            },
          ]
        : []),
      ...(linkedMail
        ? [
            {
              id: "open-linked-mail",
              kind: "navigate" as const,
              label: "Open linked mail",
              description: "Review the source conversation and draft reply before sending anything.",
              href: `/assistant/mail?thread=${linkedMail.id}`,
            },
          ]
        : []),
      {
        id: "copy-customer-update",
        kind: "copy_text",
        label: "Copy customer update",
        description: "Copy a draft update; you decide where and whether to send it.",
        text: [
          `Sales order ${row.soNumber} is currently ${row.status}.`,
          newestShipment
            ? `Latest shipment ${newestShipment.shipmentNo ?? newestShipment.id} is ${newestShipment.status}${newestShipment.trackingNo ? ` with tracking ${newestShipment.trackingNo}` : ""}.`
            : "No shipment is linked yet.",
          "We will confirm the next operational update after review.",
        ].join("\n"),
      },
    ],
  };
}

export async function answerShipmentContext({
  tenantId,
  actorUserId,
  token,
}: {
  tenantId: string;
  actorUserId: string;
  token: string;
}): Promise<AssistantContextAnswer> {
  const ctx = await getControlTowerPortalContext(actorUserId);
  const accessWhere = await controlTowerShipmentAccessWhere(tenantId, ctx, actorUserId);
  const tokenWhere: Prisma.ShipmentWhereInput = {
    OR: [{ id: token }, { shipmentNo: { equals: token, mode: "insensitive" } }],
  };
  const row = await prisma.shipment.findFirst({
    where: { AND: [accessWhere, tokenWhere] },
    include: {
      order: { select: { id: true, orderNumber: true, requestedDeliveryDate: true, supplier: { select: { name: true } } } },
      salesOrder: { select: { id: true, soNumber: true, status: true, customerName: true } },
      booking: { select: { status: true, bookingNo: true, mode: true, originCode: true, destinationCode: true, etd: true, eta: true, latestEta: true } },
      ctLegs: {
        orderBy: { legNo: "asc" },
        select: { legNo: true, originCode: true, destinationCode: true, transportMode: true, carrier: true, plannedEta: true, actualAta: true },
      },
      ctAlerts: {
        where: { status: "OPEN" },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        take: 3,
        select: { id: true, severity: true, title: true },
      },
      ctExceptions: {
        where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        take: 3,
        select: { id: true, type: true, severity: true, status: true, rootCause: true },
      },
    },
  });
  if (!row) {
    return { kind: "not_found", message: `I could not find shipment "${token}" in your Control Tower scope.` };
  }

  const route =
    row.booking?.originCode || row.booking?.destinationCode
      ? `${row.booking.originCode ?? "?"} -> ${row.booking.destinationCode ?? "?"}`
      : row.ctLegs.length > 0
        ? `${row.ctLegs[0]?.originCode ?? "?"} -> ${row.ctLegs[row.ctLegs.length - 1]?.destinationCode ?? "?"}`
        : "route not set";
  const eta = row.booking?.latestEta ?? row.booking?.eta ?? row.ctLegs.find((leg) => leg.plannedEta)?.plannedEta ?? null;
  const nextAction =
    row.ctExceptions.length > 0
      ? "Next action: work the open exception first, then send a customer update once the recovery plan is clear."
      : row.ctAlerts.length > 0
        ? "Next action: review the open alert and decide whether the customer needs a proactive update."
        : activeShipment(row.status)
          ? "Next action: monitor milestones and prepare a status update if ETA or tracking changes."
          : "Next action: verify booking, milestone, and receipt status before sending an update.";

  return {
    kind: "answer",
    message: [
      `Shipment ${row.shipmentNo ?? row.id} is ${row.status}. Route: ${route}.`,
      `Mode: ${row.transportMode ?? row.booking?.mode ?? "not set"}. Carrier: ${row.carrier ?? "not set"}. Tracking: ${row.trackingNo ?? "not set"}.`,
      `ETA/latest ETA: ${dateLabel(eta)}. Purchase order: ${row.order.orderNumber}. Supplier: ${row.order.supplier?.name ?? "not set"}.`,
      row.salesOrder ? `Linked sales order: ${row.salesOrder.soNumber} (${row.salesOrder.status}) for ${row.salesOrder.customerName}.` : "No sales order is linked.",
      `Open alerts: ${row.ctAlerts.length}. Open exceptions: ${row.ctExceptions.length}.`,
      row.ctExceptions[0] ? `Top exception: ${row.ctExceptions[0].type} (${row.ctExceptions[0].severity}, ${row.ctExceptions[0].status}).` : null,
      row.ctAlerts[0] ? `Top alert: ${row.ctAlerts[0].title} (${row.ctAlerts[0].severity}).` : null,
      nextAction,
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n"),
    evidence: [
      { label: `Shipment ${row.shipmentNo ?? row.id}`, href: `/control-tower/shipments/${row.id}` },
      { label: `Purchase order ${row.order.orderNumber}`, href: `/orders/${row.order.id}` },
      ...(row.salesOrder ? [{ label: `Sales order ${row.salesOrder.soNumber}`, href: `/sales-orders/${row.salesOrder.id}` }] : []),
    ],
    playbook: {
      id: "shipment-triage",
      title: "Shipment triage",
      description: "Ground the status, review operational risk, then prepare the next customer-safe update.",
      steps: [
        {
          id: "review-shipment",
          label:
            row.ctExceptions.length > 0
              ? "Open exception workspace"
              : row.ctAlerts.length > 0
                ? "Open alert workspace"
                : "Open shipment workspace",
          description: "Start from the shipment record and inspect the most relevant operational tab.",
          status: "available",
          actionIds: ["open-shipment-workspace"],
        },
        {
          id: "review-commercial-context",
          label: "Review commercial context",
          description: "Open the PO and any linked SO so the update matches the commitment behind the move.",
          status: "available",
          actionIds: row.salesOrder ? ["open-purchase-order", "open-linked-sales-order"] : ["open-purchase-order"],
        },
        {
          id: "resolve-risk",
          label: row.ctExceptions.length > 0 ? "Work open exception" : row.ctAlerts.length > 0 ? "Review alert" : "Monitor milestones",
          description:
            row.ctExceptions.length > 0
              ? "Resolve or progress the exception before promising recovery."
              : row.ctAlerts.length > 0
                ? "Confirm whether the alert is material enough for a proactive update."
                : "No open exception or alert is visible; keep watching milestone and ETA movement.",
          status: row.ctExceptions.length > 0 || row.ctAlerts.length > 0 ? "needs_review" : "available",
          actionIds: ["open-shipment-workspace"],
        },
        {
          id: "draft-update",
          label: "Prepare customer update",
          description: "Copy the suggested update and send only after human review.",
          status: "available",
          actionIds: ["copy-status-update"],
        },
      ],
    },
    actions: [
      {
        id: "open-shipment-workspace",
        kind: "navigate",
        label: row.ctExceptions.length > 0 ? "Open exceptions tab" : row.ctAlerts.length > 0 ? "Open alerts tab" : "Open shipment",
        description: "Review the source record before changing status or sending an update.",
        href: `/control-tower/shipments/${row.id}${
          row.ctExceptions.length > 0 ? "?tab=exceptions" : row.ctAlerts.length > 0 ? "?tab=alerts" : ""
        }`,
      },
      {
        id: "open-purchase-order",
        kind: "navigate",
        label: "Open purchase order",
        description: "Check the commercial/order context behind this shipment.",
        href: `/orders/${row.order.id}`,
      },
      ...(row.salesOrder
        ? [
            {
              id: "open-linked-sales-order",
              kind: "navigate" as const,
              label: "Open linked sales order",
              description: "Review the customer commitment tied to this shipment.",
              href: `/sales-orders/${row.salesOrder.id}`,
            },
          ]
        : []),
      {
        id: "copy-status-update",
        kind: "copy_text",
        label: "Copy customer update",
        description: "Copy a draft update; sending still happens outside this action.",
        text: [
          `Shipment ${row.shipmentNo ?? row.id} is currently ${row.status}.`,
          `Route: ${route}. ETA/latest ETA: ${dateLabel(eta)}.`,
          row.ctExceptions[0]
            ? `We are reviewing an open ${row.ctExceptions[0].type} exception and will confirm the recovery plan.`
            : row.ctAlerts[0]
              ? `We are reviewing alert: ${row.ctAlerts[0].title}.`
              : "We will keep monitoring milestones and share any material update.",
        ].join("\n"),
      },
    ],
  };
}

export function extractContextRequest(text: string): { kind: "sales_order" | "shipment"; token: string } | null {
  const salesOrderToken = extractTokenAfter(text, ["sales order", "so"]);
  if (salesOrderToken) return { kind: "sales_order", token: salesOrderToken };
  const shipmentToken = extractTokenAfter(text, ["shipment", "ship"]);
  if (shipmentToken) return { kind: "shipment", token: shipmentToken };
  return null;
}
