import {
  CtExceptionStatus,
  InvoiceAuditRollupOutcome,
  InvoiceIntakeStatus,
  QuoteRequestStatus,
  WmsTaskStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { controlTowerShipmentAccessWhere, getControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const TAKE = 8;
const STALE_DAYS = 7;

function ageDays(value: Date) {
  return Math.max(0, Math.floor((Date.now() - value.getTime()) / (1000 * 60 * 60 * 24)));
}

function daysUntil(value: Date | null | undefined) {
  if (!value) return null;
  return Math.ceil((value.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function decimalNumber(value: unknown) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "object" && "toString" in value) return Number(value.toString());
  return Number(value) || 0;
}

function toneFromAge(days: number) {
  if (days >= STALE_DAYS) return "critical";
  if (days >= 3) return "watch";
  return "ready";
}

function toneFromDue(days: number | null) {
  if (days == null) return "watch";
  if (days < 0) return "critical";
  if (days <= 3) return "watch";
  return "ready";
}

function hasEvidence(value: unknown) {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

export async function GET() {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  }

  const canOrders = viewerHas(access.grantSet, "org.orders", "view");
  const canWms = viewerHas(access.grantSet, "org.wms", "view");
  const canCt = viewerHas(access.grantSet, "org.controltower", "view");
  const canTariffs = viewerHas(access.grantSet, "org.tariffs", "view");
  const canRfq = viewerHas(access.grantSet, "org.rfq", "view");
  const canInvoiceAudit = viewerHas(access.grantSet, "org.invoice_audit", "view");

  if (!canOrders && !canWms && !canCt && !canTariffs && !canRfq && !canInvoiceAudit) {
    return toApiErrorResponse({ error: "Not allowed.", code: "FORBIDDEN", status: 403 });
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const actorUserId = await getActorUserId();
  if (!actorUserId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const ctCtx = canCt ? await getControlTowerPortalContext(actorUserId) : null;
  const ctShipmentWhere = canCt && ctCtx ? await controlTowerShipmentAccessWhere(tenant.id, ctCtx, actorUserId) : null;
  const promiseHorizon = new Date(Date.now() + 1000 * 60 * 60 * 24 * 5);
  const staleBefore = new Date(Date.now() - 1000 * 60 * 60 * 24 * STALE_DAYS);

  const [
    carrierExceptions,
    promiseOrders,
    wmsTasks,
    pricingSnapshots,
    quoteRequests,
    invoiceIntakes,
    commercialCounts,
    recentActions,
    actionCounts,
    playbookRuns,
    auditEvents,
    auditCounts,
  ] = await Promise.all([
    canCt && ctShipmentWhere
      ? prisma.ctException.findMany({
          where: {
            tenantId: tenant.id,
            status: { in: [CtExceptionStatus.OPEN, CtExceptionStatus.IN_PROGRESS] },
            shipment: { is: ctShipmentWhere },
          },
          orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
          take: TAKE,
          select: {
            id: true,
            type: true,
            severity: true,
            status: true,
            rootCause: true,
            updatedAt: true,
            owner: { select: { name: true } },
            shipment: {
              select: {
                id: true,
                shipmentNo: true,
                carrier: true,
                trackingNo: true,
                expectedReceiveAt: true,
                ctAlerts: { where: { status: "OPEN" }, select: { id: true }, take: 5 },
              },
            },
          },
        })
      : Promise.resolve([]),
    canOrders
      ? prisma.salesOrder.findMany({
          where: {
            tenantId: tenant.id,
            status: { in: ["DRAFT", "OPEN"] },
            OR: [{ requestedDeliveryDate: { lte: promiseHorizon } }, { shipments: { none: {} } }],
          },
          orderBy: [{ requestedDeliveryDate: "asc" }, { updatedAt: "desc" }],
          take: TAKE,
          select: {
            id: true,
            soNumber: true,
            status: true,
            customerName: true,
            requestedDeliveryDate: true,
            updatedAt: true,
            shipments: {
              select: {
                id: true,
                shipmentNo: true,
                status: true,
                expectedReceiveAt: true,
                ctExceptions: {
                  where: { status: { in: [CtExceptionStatus.OPEN, CtExceptionStatus.IN_PROGRESS] } },
                  select: { id: true },
                },
              },
              take: 5,
            },
          },
        })
      : Promise.resolve([]),
    canWms
      ? prisma.wmsTask.findMany({
          where: { tenantId: tenant.id, status: WmsTaskStatus.OPEN },
          orderBy: [{ updatedAt: "asc" }],
          take: TAKE,
          select: {
            id: true,
            taskType: true,
            quantity: true,
            note: true,
            updatedAt: true,
            warehouse: { select: { name: true, code: true } },
            product: { select: { id: true, name: true, productCode: true, sku: true } },
            shipment: { select: { id: true, shipmentNo: true } },
            order: { select: { id: true, orderNumber: true } },
            bin: { select: { code: true } },
          },
        })
      : Promise.resolve([]),
    canTariffs || canInvoiceAudit
      ? prisma.bookingPricingSnapshot.findMany({
          where: { tenantId: tenant.id },
          orderBy: { frozenAt: "desc" },
          take: TAKE,
          select: {
            id: true,
            sourceType: true,
            sourceSummary: true,
            currency: true,
            totalEstimatedCost: true,
            frozenAt: true,
            shipmentBooking: { select: { shipment: { select: { id: true, shipmentNo: true } } } },
            _count: { select: { invoiceIntakes: true, invoiceAuditResults: true } },
          },
        })
      : Promise.resolve([]),
    canRfq
      ? prisma.quoteRequest.findMany({
          where: { tenantId: tenant.id, status: { in: [QuoteRequestStatus.DRAFT, QuoteRequestStatus.OPEN] } },
          orderBy: [{ quotesDueAt: "asc" }, { updatedAt: "desc" }],
          take: TAKE,
          select: {
            id: true,
            title: true,
            status: true,
            transportMode: true,
            originLabel: true,
            destinationLabel: true,
            quotesDueAt: true,
            updatedAt: true,
            _count: { select: { recipients: true, responses: true, clarifications: true } },
          },
        })
      : Promise.resolve([]),
    canInvoiceAudit
      ? prisma.invoiceIntake.findMany({
          where: {
            tenantId: tenant.id,
            OR: [
              { rollupOutcome: { in: [InvoiceAuditRollupOutcome.WARN, InvoiceAuditRollupOutcome.FAIL] } },
              { approvedForAccounting: false },
              { status: { in: [InvoiceIntakeStatus.RECEIVED, InvoiceIntakeStatus.PARSED, InvoiceIntakeStatus.FAILED] } },
            ],
          },
          orderBy: [{ updatedAt: "desc" }],
          take: TAKE,
          select: {
            id: true,
            externalInvoiceNo: true,
            vendorLabel: true,
            status: true,
            rollupOutcome: true,
            redLineCount: true,
            amberLineCount: true,
            unknownLineCount: true,
            approvedForAccounting: true,
            auditRunError: true,
            receivedAt: true,
            updatedAt: true,
            bookingPricingSnapshot: { select: { id: true, sourceSummary: true, currency: true, totalEstimatedCost: true } },
          },
        })
      : Promise.resolve([]),
    Promise.all([
      canTariffs || canInvoiceAudit ? prisma.bookingPricingSnapshot.count({ where: { tenantId: tenant.id } }) : 0,
      canRfq ? prisma.quoteRequest.count({ where: { tenantId: tenant.id } }) : 0,
      canInvoiceAudit ? prisma.invoiceIntake.count({ where: { tenantId: tenant.id } }) : 0,
      canInvoiceAudit
        ? prisma.invoiceIntake.count({
            where: { tenantId: tenant.id, approvedForAccounting: true },
          })
        : 0,
    ]),
    prisma.assistantActionQueueItem.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: TAKE,
      select: {
        id: true,
        actionKind: true,
        label: true,
        description: true,
        status: true,
        objectType: true,
        objectId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    Promise.all([
      prisma.assistantActionQueueItem.count({ where: { tenantId: tenant.id, status: "PENDING" } }),
      prisma.assistantActionQueueItem.count({ where: { tenantId: tenant.id, status: "DONE" } }),
      prisma.assistantActionQueueItem.count({ where: { tenantId: tenant.id, status: "REJECTED" } }),
      prisma.assistantActionQueueItem.count({
        where: { tenantId: tenant.id, status: "PENDING", createdAt: { lte: staleBefore } },
      }),
    ]),
    prisma.assistantPlaybookRun.findMany({
      where: { tenantId: tenant.id },
      orderBy: { updatedAt: "desc" },
      take: TAKE,
      select: {
        id: true,
        playbookId: true,
        title: true,
        status: true,
        objectType: true,
        objectId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.assistantAuditEvent.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true,
        surface: true,
        prompt: true,
        answerKind: true,
        evidence: true,
        feedback: true,
        objectType: true,
        objectId: true,
        createdAt: true,
        actor: { select: { name: true } },
      },
    }),
    Promise.all([
      prisma.assistantAuditEvent.count({ where: { tenantId: tenant.id } }),
      prisma.assistantAuditEvent.count({ where: { tenantId: tenant.id, feedback: "helpful" } }),
      prisma.assistantAuditEvent.count({ where: { tenantId: tenant.id, feedback: "not_helpful" } }),
      prisma.assistantAuditEvent.count({ where: { tenantId: tenant.id, feedback: null } }),
    ]),
  ]);

  const [snapshotCount, rfqCount, invoiceCount, accountingApprovedCount] = commercialCounts;
  const [pendingActionCount, doneActionCount, rejectedActionCount, staleActionCount] = actionCounts;
  const [auditTotal, helpfulAuditCount, needsReviewAuditCount, missingFeedbackCount] = auditCounts;

  const sections = [
    {
      id: "carrier-communications",
      lmpRange: "LMP11",
      title: "Carrier communication copilot",
      summary: "Carrier-facing escalation candidates from shipment exception evidence.",
      href: "/control-tower",
      items: carrierExceptions.map((row) => ({
        id: row.id,
        title: `${row.shipment.shipmentNo ?? "Shipment"} · ${row.type}`,
        subtitle: `${row.severity} · ${row.status} · ${row.shipment.carrier ?? "No carrier"}`,
        tone: row.severity === "CRITICAL" ? "critical" : "watch",
        href: `/control-tower/shipments/${row.shipment.id}?tab=exceptions`,
        evidence: [
          row.rootCause ? `Root cause: ${row.rootCause.slice(0, 160)}` : "Root cause needs carrier confirmation",
          `${row.shipment.ctAlerts.length} open alert${row.shipment.ctAlerts.length === 1 ? "" : "s"}`,
          row.shipment.trackingNo ? `Tracking ${row.shipment.trackingNo}` : "No tracking number",
        ],
        action: {
          id: `lmp11-carrier-update-${row.id}`,
          kind: "copy_text",
          label: "Draft carrier escalation",
          description: "Prepare carrier-facing escalation text from shipment evidence; user edits/copies before sending.",
          href: `/control-tower/shipments/${row.shipment.id}?tab=exceptions`,
        },
      })),
    },
    {
      id: "delivery-promises",
      lmpRange: "LMP12",
      title: "Delivery promise monitor",
      summary: "Customer promise risk across sales orders and linked shipments.",
      href: "/sales-orders",
      items: promiseOrders.map((row) => {
        const due = daysUntil(row.requestedDeliveryDate);
        const exceptionCount = row.shipments.reduce((sum, shipment) => sum + shipment.ctExceptions.length, 0);
        return {
          id: row.id,
          title: `${row.soNumber} · ${row.customerName}`,
          subtitle: `${row.status} · ${row.shipments.length} shipment${row.shipments.length === 1 ? "" : "s"}`,
          tone: exceptionCount > 0 ? "critical" : row.shipments.length === 0 ? "watch" : toneFromDue(due),
          href: `/sales-orders/${row.id}`,
          evidence: [
            due == null ? "No requested delivery date" : due < 0 ? `${Math.abs(due)} days late` : `${due} days until delivery request`,
            `${exceptionCount} linked shipment exception${exceptionCount === 1 ? "" : "s"}`,
            row.shipments.length === 0 ? "No shipment linked to promise" : "Shipment execution evidence available",
          ],
          action: {
            id: `lmp12-promise-review-${row.id}`,
            kind: "navigate",
            label: "Review customer promise",
            description: "Open SO and linked shipment evidence before sending an updated customer promise.",
            href: `/sales-orders/${row.id}`,
          },
        };
      }),
    },
    {
      id: "warehouse-recovery",
      lmpRange: "LMP13/LMP14",
      title: "Warehouse operations and task recovery",
      summary: "Open WMS tasks, bottlenecks, and recovery actions with warehouse/product evidence.",
      href: "/wms/operations",
      items: wmsTasks.map((row) => {
        const age = ageDays(row.updatedAt);
        const targetHref = row.shipment?.id ? `/control-tower/shipments/${row.shipment.id}` : "/wms/operations";
        return {
          id: row.id,
          title: `${row.taskType} · ${row.warehouse.code ?? row.warehouse.name}`,
          subtitle: `${decimalNumber(row.quantity).toLocaleString()} units · age ${age}d`,
          tone: toneFromAge(age),
          href: targetHref,
          evidence: [
            row.product ? `Product ${row.product.productCode ?? row.product.sku ?? row.product.name}` : "No product linked",
            row.bin?.code ? `Bin ${row.bin.code}` : "No bin assigned",
            row.note ? row.note.slice(0, 160) : "No task note captured",
          ],
          action: {
            id: `lmp14-recover-wms-task-${row.id}`,
            kind: "navigate",
            label: "Open warehouse recovery",
            description: "Review WMS task context, then mark done/escalated in the warehouse workflow.",
            href: targetHref,
          },
        };
      }),
    },
    {
      id: "pricing-rfq",
      lmpRange: "LMP15/LMP16",
      title: "Pricing snapshot and RFQ copilot",
      summary: "Explain frozen pricing and prepare RFQ response work with evidence links.",
      href: "/pricing-snapshots",
      items: [
        ...pricingSnapshots.slice(0, 4).map((row) => ({
          id: row.id,
          title: `Snapshot ${row.sourceType}`,
          subtitle: `${row.currency} ${decimalNumber(row.totalEstimatedCost).toLocaleString()} · frozen ${row.frozenAt.toISOString().slice(0, 10)}`,
          tone: row._count.invoiceIntakes > 0 ? "ready" : "watch",
          href: `/pricing-snapshots/${row.id}`,
          evidence: [
            row.sourceSummary?.slice(0, 160) ?? "No source summary captured",
            `${row._count.invoiceIntakes} invoice intake${row._count.invoiceIntakes === 1 ? "" : "s"} linked`,
            row.shipmentBooking?.shipment?.shipmentNo ? `Shipment ${row.shipmentBooking.shipment.shipmentNo}` : "No shipment booking linked",
          ],
          action: {
            id: `lmp15-explain-pricing-${row.id}`,
            kind: "navigate",
            label: "Explain pricing snapshot",
            description: "Open the frozen snapshot and review assumptions, charges, and invoice links.",
            href: `/pricing-snapshots/${row.id}`,
          },
        })),
        ...quoteRequests.slice(0, 4).map((row) => {
          const due = daysUntil(row.quotesDueAt);
          return {
            id: row.id,
            title: `RFQ ${row.title}`,
            subtitle: `${row.status} · ${row.originLabel} -> ${row.destinationLabel}`,
            tone: row._count.responses === 0 ? "watch" : toneFromDue(due),
            href: `/rfq/requests/${row.id}`,
            evidence: [
              `${row._count.recipients} recipient${row._count.recipients === 1 ? "" : "s"} · ${row._count.responses} response${row._count.responses === 1 ? "" : "s"}`,
              due == null ? "No quote due date" : due < 0 ? `${Math.abs(due)} days past due` : `${due} days until quote due`,
              `${row.transportMode} · ${row._count.clarifications} clarification${row._count.clarifications === 1 ? "" : "s"}`,
            ],
            action: {
              id: `lmp16-rfq-response-${row.id}`,
              kind: "navigate",
              label: "Prepare RFQ response",
              description: "Open RFQ and assemble response from rates, recipients, and clarifications.",
              href: `/rfq/requests/${row.id}`,
            },
          };
        }),
      ],
    },
    {
      id: "invoice-finance",
      lmpRange: "LMP17/LMP18",
      title: "Invoice audit and finance handoff",
      summary: "Discrepancy explanation, dispute prep, and approved accounting packet readiness.",
      href: "/invoice-audit",
      items: invoiceIntakes.map((row) => ({
        id: row.id,
        title: row.externalInvoiceNo ?? `Invoice intake ${row.id.slice(0, 8)}`,
        subtitle: `${row.vendorLabel ?? "No vendor"} · ${row.status} · ${row.rollupOutcome}`,
        tone: row.rollupOutcome === "FAIL" || row.status === "FAILED" ? "critical" : row.approvedForAccounting ? "ready" : "watch",
        href: `/invoice-audit/${row.id}`,
        evidence: [
          `${row.redLineCount} red · ${row.amberLineCount} amber · ${row.unknownLineCount} unknown lines`,
          row.auditRunError ? `Audit error: ${row.auditRunError.slice(0, 140)}` : "No audit engine error",
          row.approvedForAccounting ? "Approved for accounting" : "Accounting approval still pending",
        ],
        action: {
          id: `lmp17-invoice-audit-${row.id}`,
          kind: "navigate",
          label: "Open audit packet",
          description: "Review variance explanation, dispute notes, and accounting handoff state.",
          href: `/invoice-audit/${row.id}`,
        },
      })),
    },
    {
      id: "commercial-executive",
      lmpRange: "LMP19/LMP20",
      title: "Commercial risk and executive daily brief",
      summary: "One commercial operating card spanning pricing, RFQ, invoice, and assistant risk signals.",
      href: "/assistant/command-center",
      items: [
        {
          id: "commercial-risk",
          title: "Commercial risk dashboard",
          subtitle: `${snapshotCount} snapshots · ${rfqCount} RFQs · ${invoiceCount} invoice intakes`,
          tone: invoiceCount > accountingApprovedCount ? "watch" : "ready",
          href: "/assistant/command-center",
          evidence: [
            `${accountingApprovedCount}/${invoiceCount} invoice intakes approved for accounting`,
            `${pendingActionCount} pending assistant action${pendingActionCount === 1 ? "" : "s"}`,
            `${needsReviewAuditCount} assistant answer${needsReviewAuditCount === 1 ? "" : "s"} need review`,
          ],
          action: {
            id: "lmp20-copy-executive-brief",
            kind: "copy_text",
            label: "Prepare daily executive brief",
            description: "Use commercial and assistant signals to produce a copy-ready daily operating brief.",
            href: "/assistant/command-center",
          },
        },
      ],
    },
    {
      id: "role-action-ops",
      lmpRange: "LMP21/LMP22",
      title: "Role landing and action queue operations",
      summary: "Role-oriented assistant operations plus action queue status, aging, and handoff risk.",
      href: "/assistant/command-center",
      items: recentActions.map((row) => {
        const age = ageDays(row.createdAt);
        return {
          id: row.id,
          title: row.label,
          subtitle: `${row.status} · ${row.objectType ?? "objectless"} · age ${age}d`,
          tone: row.status === "PENDING" ? toneFromAge(age) : "ready",
          href: "/assistant/command-center",
          evidence: [
            row.description ?? "No action description captured",
            `Kind ${row.actionKind}`,
            `${pendingActionCount} pending · ${doneActionCount} done · ${rejectedActionCount} rejected · ${staleActionCount} stale`,
          ],
          action: {
            id: `lmp22-action-queue-${row.id}`,
            kind: "navigate",
            label: "Open action queue",
            description: "Review ownership, status, and aging before marking assistant action done or rejected.",
            href: "/assistant/command-center",
          },
        };
      }),
    },
    {
      id: "playbook-memory-quality",
      lmpRange: "LMP23-LMP30",
      title: "Playbooks, memory, quality, and simulation lab",
      summary: "Reusable workflow candidates, object memory, evidence debt, feedback-to-training, prompt library, quality gate, and shadow automation readiness.",
      href: "/assistant/command-center",
      items: [
        ...playbookRuns.slice(0, 4).map((row) => {
          const age = ageDays(row.updatedAt);
          return {
            id: row.id,
            title: row.title,
            subtitle: `${row.status} · ${row.playbookId}`,
            tone: row.status === "IN_PROGRESS" ? toneFromAge(age) : "ready",
            href: "/assistant/command-center",
            evidence: [
              row.objectType ? `Object ${row.objectType}:${row.objectId ?? "unlinked"}` : "No object link",
              `Updated ${age} day${age === 1 ? "" : "s"} ago`,
              "Candidate for reusable playbook operations review",
            ],
            action: {
              id: `lmp24-playbook-run-${row.id}`,
              kind: "navigate",
              label: "Review playbook run",
              description: "Open command center playbook operations and decide whether to complete, escalate, or template it.",
              href: "/assistant/command-center",
            },
          };
        }),
        ...auditEvents.slice(0, 4).map((row) => ({
          id: row.id,
          title: row.prompt.length > 80 ? `${row.prompt.slice(0, 80)}...` : row.prompt,
          subtitle: `${row.surface} · ${row.answerKind} · ${row.feedback ?? "no feedback"}`,
          tone: !hasEvidence(row.evidence) || row.feedback === "not_helpful" ? "watch" : "ready",
          href: "/assistant/command-center",
          evidence: [
            hasEvidence(row.evidence) ? "Evidence attached" : "Missing evidence",
            row.objectType ? `Object memory ${row.objectType}:${row.objectId ?? "unlinked"}` : "No object memory link",
            `${helpfulAuditCount} helpful · ${needsReviewAuditCount} needs review · ${missingFeedbackCount} missing feedback of ${auditTotal} total`,
          ],
          action: {
            id: `lmp27-audit-training-${row.id}`,
            kind: "navigate",
            label: "Review training example",
            description: "Use feedback and evidence to decide whether this answer belongs in training, prompt library, or shadow automation rehearsal.",
            href: "/assistant/command-center",
          },
        })),
      ],
    },
  ];

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    actor: access.user,
    capabilities: {
      orders: canOrders,
      wms: canWms,
      controlTower: canCt,
      tariffs: canTariffs,
      rfq: canRfq,
      invoiceAudit: canInvoiceAudit,
    },
    metrics: {
      pendingActionCount,
      doneActionCount,
      rejectedActionCount,
      staleActionCount,
      auditTotal,
      helpfulAuditCount,
      needsReviewAuditCount,
      missingFeedbackCount,
      snapshotCount,
      rfqCount,
      invoiceCount,
      accountingApprovedCount,
    },
    sections,
  });
}
