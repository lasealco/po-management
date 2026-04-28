import { CtAlertStatus, CtExceptionStatus } from "@prisma/client";
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

function percent(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

function score(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toneFromScore(value: number) {
  if (value >= 75) return "ready";
  if (value >= 45) return "watch";
  return "critical";
}

function toneFromAge(days: number) {
  if (days >= STALE_DAYS) return "critical";
  if (days >= 3) return "watch";
  return "ready";
}

function hasEvidence(value: unknown) {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function decimalNumber(value: unknown) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "object" && "toString" in value) return Number(value.toString());
  return Number(value) || 0;
}

export async function GET() {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  }

  const canOrders = viewerHas(access.grantSet, "org.orders", "view");
  const canWms = viewerHas(access.grantSet, "org.wms", "view");
  const canCt = viewerHas(access.grantSet, "org.controltower", "view");
  const canSuppliers = viewerHas(access.grantSet, "org.suppliers", "view");
  const canApiHub = viewerHas(access.grantSet, "org.apihub", "view");
  const canRisk = viewerHas(access.grantSet, "org.scri", "view");
  const canInvoiceAudit = viewerHas(access.grantSet, "org.invoice_audit", "view");

  if (!canOrders && !canWms && !canCt && !canSuppliers && !canApiHub && !canRisk && !canInvoiceAudit) {
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
  const staleBefore = new Date(Date.now() - 1000 * 60 * 60 * 24 * STALE_DAYS);

  const [
    actions,
    actionCounts,
    auditEvents,
    auditCounts,
    playbookRuns,
    users,
    roles,
    rolePermissionCount,
    connectors,
    apiRuns,
    stagingCounts,
    twinCounts,
    twinEntities,
    twinRisks,
    scenarios,
    orderCounts,
    shipmentCounts,
    inventoryRows,
    collaborationCounts,
    invoiceCounts,
  ] = await Promise.all([
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
    prisma.assistantAuditEvent.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 80,
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
    prisma.user.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { name: "asc" },
      take: TAKE,
      select: { id: true, name: true, email: true, _count: { select: { assistantAuditEvents: true } } },
    }),
    prisma.role.findMany({
      where: { tenantId: tenant.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, isSystem: true, _count: { select: { users: true, permissions: true } } },
    }),
    prisma.rolePermission.count({ where: { role: { tenantId: tenant.id } } }),
    canApiHub
      ? prisma.apiHubConnector.findMany({
          where: { tenantId: tenant.id },
          orderBy: { updatedAt: "desc" },
          take: TAKE,
          select: {
            id: true,
            name: true,
            sourceKind: true,
            authMode: true,
            authState: true,
            status: true,
            lastSyncAt: true,
            healthSummary: true,
            updatedAt: true,
          },
        })
      : Promise.resolve([]),
    canApiHub
      ? prisma.apiHubIngestionRun.findMany({
          where: { tenantId: tenant.id },
          orderBy: { createdAt: "desc" },
          take: TAKE,
          select: {
            id: true,
            status: true,
            triggerKind: true,
            resultSummary: true,
            errorCode: true,
            errorMessage: true,
            appliedAt: true,
            createdAt: true,
            connector: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    canApiHub
      ? Promise.all([
          prisma.apiHubStagingBatch.count({ where: { tenantId: tenant.id, status: "open" } }),
          prisma.apiHubMappingTemplate.count({ where: { tenantId: tenant.id } }),
          prisma.apiHubMappingAnalysisJob.count({ where: { tenantId: tenant.id, status: { in: ["queued", "processing"] } } }),
        ])
      : Promise.resolve([0, 0, 0]),
    Promise.all([
      prisma.supplyChainTwinEntitySnapshot.count({ where: { tenantId: tenant.id } }),
      prisma.supplyChainTwinEntityEdge.count({ where: { tenantId: tenant.id } }),
      prisma.supplyChainTwinIngestEvent.count({ where: { tenantId: tenant.id } }),
      prisma.supplyChainTwinScenarioDraft.count({ where: { tenantId: tenant.id } }),
      prisma.supplyChainTwinRiskSignal.count({ where: { tenantId: tenant.id, acknowledged: false } }),
    ]),
    prisma.supplyChainTwinEntitySnapshot.groupBy({
      by: ["entityKind"],
      where: { tenantId: tenant.id },
      _count: { _all: true },
      orderBy: { _count: { entityKind: "desc" } },
      take: 8,
    }),
    prisma.supplyChainTwinRiskSignal.findMany({
      where: { tenantId: tenant.id, acknowledged: false },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: TAKE,
      select: { id: true, code: true, severity: true, title: true, detail: true, createdAt: true },
    }),
    prisma.supplyChainTwinScenarioDraft.findMany({
      where: { tenantId: tenant.id },
      orderBy: { updatedAt: "desc" },
      take: TAKE,
      select: { id: true, title: true, status: true, updatedAt: true, _count: { select: { revisions: true } } },
    }),
    canOrders
      ? Promise.all([
          prisma.salesOrder.count({ where: { tenantId: tenant.id } }),
          prisma.salesOrder.count({ where: { tenantId: tenant.id, status: "DRAFT" } }),
          prisma.purchaseOrder.count({ where: { tenantId: tenant.id } }),
          prisma.purchaseOrder.count({ where: { tenantId: tenant.id, shipments: { none: {} } } }),
        ])
      : Promise.resolve([0, 0, 0, 0]),
    canCt && ctShipmentWhere
      ? Promise.all([
          prisma.shipment.count({ where: ctShipmentWhere }),
          prisma.ctAlert.count({ where: { tenantId: tenant.id, status: CtAlertStatus.OPEN, shipment: { is: ctShipmentWhere } } }),
          prisma.ctException.count({
            where: {
              tenantId: tenant.id,
              status: { in: [CtExceptionStatus.OPEN, CtExceptionStatus.IN_PROGRESS] },
              shipment: { is: ctShipmentWhere },
            },
          }),
        ])
      : Promise.resolve([0, 0, 0]),
    canWms
      ? prisma.inventoryBalance.findMany({
          where: { tenantId: tenant.id },
          orderBy: [{ onHold: "desc" }, { updatedAt: "desc" }],
          take: 50,
          select: {
            productId: true,
            onHandQty: true,
            allocatedQty: true,
            onHold: true,
            warehouse: { select: { name: true, code: true } },
            product: { select: { id: true, name: true, productCode: true, sku: true } },
          },
        })
      : Promise.resolve([]),
    Promise.all([
      canSuppliers ? prisma.supplier.count({ where: { tenantId: tenant.id, isActive: true } }) : 0,
      canCt && ctShipmentWhere
        ? prisma.shipment.count({ where: { ...ctShipmentWhere, carrierSupplierId: { not: null } } })
        : 0,
      canOrders ? prisma.salesOrder.count({ where: { tenantId: tenant.id, customerCrmAccountId: { not: null } } }) : 0,
    ]),
    canInvoiceAudit
      ? Promise.all([
          prisma.invoiceIntake.count({ where: { tenantId: tenant.id } }),
          prisma.invoiceIntake.count({ where: { tenantId: tenant.id, approvedForAccounting: true } }),
        ])
      : Promise.resolve([0, 0]),
  ]);

  const [pendingActions, doneActions, rejectedActions, staleActions] = actionCounts;
  const [auditTotal, helpfulAudit, needsReviewAudit, missingFeedback] = auditCounts;
  const [openStagingBatches, mappingTemplateCount, activeMappingJobs] = stagingCounts;
  const [twinEntityCount, twinEdgeCount, twinIngestCount, twinScenarioCount, openTwinRiskCount] = twinCounts;
  const [salesOrderCount, draftSalesOrderCount, purchaseOrderCount, poWithoutShipmentCount] = orderCounts;
  const [shipmentCount, openAlertCount, openExceptionCount] = shipmentCounts;
  const [supplierCount, carrierLinkedShipmentCount, customerLinkedSalesOrderCount] = collaborationCounts;
  const [invoiceCount, accountingApprovedCount] = invoiceCounts;

  const evidenceCoverage = percent(auditEvents.filter((event) => hasEvidence(event.evidence)).length, auditEvents.length);
  const feedbackCoverage = percent(auditEvents.filter((event) => event.feedback).length, auditEvents.length);
  const actionCompletion = percent(doneActions, pendingActions + doneActions + rejectedActions);
  const automationScore = score(actionCompletion * 0.45 + evidenceCoverage * 0.35 + (100 - percent(staleActions, pendingActions || 1)) * 0.2);
  const twinScore = score(
    percent(twinEntityCount, 25) * 0.35 +
      percent(twinEdgeCount, 20) * 0.25 +
      percent(twinScenarioCount, 3) * 0.2 +
      (openTwinRiskCount > 0 ? 10 : 20),
  );
  const operatingScore = score((automationScore + twinScore + evidenceCoverage + feedbackCoverage) / 4);

  const inventoryByProduct = new Map<string, { id: string; label: string; onHand: number; allocated: number; held: number }>();
  for (const row of inventoryRows) {
    const current = inventoryByProduct.get(row.productId) ?? {
      id: row.productId,
      label: row.product.productCode || row.product.sku || row.product.name,
      onHand: 0,
      allocated: 0,
      held: 0,
    };
    current.onHand += decimalNumber(row.onHandQty);
    current.allocated += decimalNumber(row.allocatedQty);
    if (row.onHold) current.held += decimalNumber(row.onHandQty);
    inventoryByProduct.set(row.productId, current);
  }

  const sections = [
    {
      id: "controlled-automation",
      lmpRange: "LMP31/LMP32",
      title: "Controlled automation and override center",
      summary: "Automation remains opt-in, reversible, and visible through queued actions, stale work, and rejected overrides.",
      href: "/assistant/command-center",
      items: [
        {
          id: "automation-score",
          title: `Automation readiness ${automationScore}/100`,
          subtitle: `${pendingActions} pending · ${doneActions} done · ${rejectedActions} rejected · ${staleActions} stale`,
          tone: toneFromScore(automationScore),
          href: "/assistant/command-center",
          evidence: [
            `${actionCompletion}% action completion`,
            `${evidenceCoverage}% recent evidence coverage`,
            "No live automation is enabled from this workbench; actions are queued for human review.",
          ],
          action: {
            id: "lmp31-review-automation-candidate",
            kind: "navigate",
            label: "Review automation candidate",
            description: "Open the command center and choose a low-risk queued action for shadow-to-controlled automation.",
            href: "/assistant/command-center",
          },
        },
        ...actions.slice(0, 5).map((row) => {
          const age = ageDays(row.createdAt);
          return {
            id: row.id,
            title: row.label,
            subtitle: `${row.status} · ${row.actionKind} · age ${age}d`,
            tone: row.status === "PENDING" ? toneFromAge(age) : "ready",
            href: "/assistant/command-center",
            evidence: [
              row.description ?? "No action description captured",
              row.objectType ? `Object ${row.objectType}:${row.objectId ?? "unlinked"}` : "No object context",
              "Human can complete, reject, or leave queued before automation expands.",
            ],
            action: {
              id: `lmp32-override-action-${row.id}`,
              kind: "navigate",
              label: "Open override review",
              description: "Review why this action was proposed and decide whether to complete, reject, or keep pending.",
              href: "/assistant/command-center",
            },
          };
        }),
      ],
    },
    {
      id: "domain-integration-rollout",
      lmpRange: "LMP33-LMP36",
      title: "Domain expansion, integration readiness, rollout, and enablement",
      summary: "Choose next domains using real coverage, API Hub readiness, user activity, and role/team adoption signals.",
      href: "/apihub",
      items: [
        {
          id: "domain-expansion",
          title: "Domain expansion planner",
          subtitle: `${salesOrderCount} SO · ${purchaseOrderCount} PO · ${shipmentCount} shipments · ${inventoryByProduct.size} products with stock`,
          tone: salesOrderCount + purchaseOrderCount + shipmentCount + inventoryByProduct.size > 0 ? "ready" : "watch",
          href: "/assistant/command-center",
          evidence: [
            `${draftSalesOrderCount} draft sales orders`,
            `${poWithoutShipmentCount} purchase orders without shipment`,
            `${openExceptionCount} open shipment exceptions`,
          ],
          action: {
            id: "lmp33-plan-domain-expansion",
            kind: "navigate",
            label: "Plan next domain",
            description: "Use coverage and exception density to choose the next assistant domain.",
            href: "/assistant/command-center",
          },
        },
        {
          id: "integration-readiness",
          title: "Integration readiness",
          subtitle: `${connectors.length} connectors · ${openStagingBatches} open staging batches`,
          tone: connectors.some((connector) => connector.status === "active" || connector.authState === "configured")
            ? "ready"
            : "watch",
          href: "/apihub",
          evidence: [
            `${mappingTemplateCount} mapping templates`,
            `${activeMappingJobs} active mapping analysis jobs`,
            apiRuns[0]?.errorMessage ? `Latest run issue: ${apiRuns[0].errorMessage.slice(0, 120)}` : "No latest API run error in sample",
          ],
          action: {
            id: "lmp34-open-integration-readiness",
            kind: "navigate",
            label: "Open API Hub readiness",
            description: "Review connectors, mapping templates, staging batches, and ingestion health before deeper automation.",
            href: "/apihub",
          },
        },
        ...users.slice(0, 4).map((user) => ({
          id: user.id,
          title: user.name,
          subtitle: `${user.email} · ${user._count.assistantAuditEvents} assistant event${user._count.assistantAuditEvents === 1 ? "" : "s"}`,
          tone: user._count.assistantAuditEvents > 0 ? "ready" : "watch",
          href: "/assistant/command-center",
          evidence: [
            `${roles.length} tenant role${roles.length === 1 ? "" : "s"} configured`,
            `${rolePermissionCount} role permission row${rolePermissionCount === 1 ? "" : "s"}`,
            "Enablement coach can target users with low/no assistant usage.",
          ],
          action: {
            id: `lmp36-coach-user-${user.id}`,
            kind: "navigate",
            label: "Plan enablement coaching",
            description: "Open assistant operations and choose next prompt examples for this role/user.",
            href: "/assistant/command-center",
          },
        })),
      ],
    },
    {
      id: "policy-security-incident",
      lmpRange: "LMP37-LMP40",
      title: "Policy, security, incident, and resilience controls",
      summary: "Audit-ready controls for approvals, permissions, incidents, resilience, and stakeholder updates.",
      href: "/assistant/command-center",
      items: [
        {
          id: "policy-packet",
          title: "Policy and compliance packet",
          subtitle: `${auditTotal} audit events · ${pendingActions} pending approvals`,
          tone: evidenceCoverage >= 70 && feedbackCoverage >= 40 ? "ready" : "watch",
          href: "/assistant/command-center",
          evidence: [
            `${evidenceCoverage}% evidence coverage`,
            `${feedbackCoverage}% feedback coverage`,
            `${missingFeedback} events still missing feedback`,
          ],
          action: {
            id: "lmp37-generate-policy-packet",
            kind: "copy_text",
            label: "Prepare compliance packet",
            description: "Generate an audit-ready summary of approvals, evidence, feedback, and automation guardrails.",
            href: "/assistant/command-center",
          },
        },
        {
          id: "security-posture",
          title: "Security posture",
          subtitle: `${roles.length} roles · ${rolePermissionCount} permissions`,
          tone: roles.length > 0 && rolePermissionCount > 0 ? "ready" : "critical",
          href: "/settings/roles",
          evidence: [
            roles.map((role) => `${role.name}: ${role._count.users} users/${role._count.permissions} grants`).slice(0, 3).join(" · ") ||
              "No role rows sampled",
            "Assistant workbench access is grant-gated.",
            "Action queue keeps sensitive mutations human-approved.",
          ],
          action: {
            id: "lmp38-review-security-posture",
            kind: "navigate",
            label: "Review permissions",
            description: "Inspect roles and grants before enabling broader automation.",
            href: "/settings/roles",
          },
        },
        {
          id: "resilience-incidents",
          title: "Incident and resilience runbook",
          subtitle: `${openAlertCount} open alerts · ${openExceptionCount} open exceptions · ${openTwinRiskCount} twin risks`,
          tone: openAlertCount + openExceptionCount + openTwinRiskCount > 0 ? "watch" : "ready",
          href: "/control-tower",
          evidence: [
            `${staleActions} stale assistant action${staleActions === 1 ? "" : "s"}`,
            `${playbookRuns.filter((run) => run.status === "IN_PROGRESS").length} active playbook run${playbookRuns.filter((run) => run.status === "IN_PROGRESS").length === 1 ? "" : "s"}`,
            "Resilience work can be converted into escalation playbooks from command center.",
          ],
          action: {
            id: "lmp39-create-incident-runbook",
            kind: "navigate",
            label: "Open resilience work",
            description: "Review operational alerts, exceptions, and twin risk before preparing stakeholder updates.",
            href: "/control-tower",
          },
        },
      ],
    },
    {
      id: "digital-twin",
      lmpRange: "LMP41-LMP44",
      title: "Digital twin readiness and flow models",
      summary: "Object graph confidence across orders, shipments, inventory, scenarios, and risk signals.",
      href: "/supply-chain-twin",
      items: [
        {
          id: "twin-readiness",
          title: `Digital twin readiness ${twinScore}/100`,
          subtitle: `${twinEntityCount} entities · ${twinEdgeCount} edges · ${twinScenarioCount} scenarios`,
          tone: toneFromScore(twinScore),
          href: "/supply-chain-twin",
          evidence: [
            `${twinIngestCount} ingest events`,
            `${openTwinRiskCount} unacknowledged risk signals`,
            twinRisks[0] ? `Top risk: ${twinRisks[0].title}` : "No open twin risk sampled",
            twinEntities.map((row) => `${row.entityKind}: ${row._count._all}`).slice(0, 4).join(" · ") || "No twin entity kinds yet",
          ],
          action: {
            id: "lmp41-open-twin-readiness",
            kind: "navigate",
            label: "Open Supply Chain Twin",
            description: "Inspect object graph coverage and confidence gaps before using twin-style recommendations.",
            href: "/supply-chain-twin",
          },
        },
        {
          id: "order-flow-twin",
          title: "Order-flow twin",
          subtitle: `${salesOrderCount} sales orders · ${purchaseOrderCount} purchase orders`,
          tone: salesOrderCount + purchaseOrderCount > 0 ? "ready" : "watch",
          href: "/sales-orders",
          evidence: [
            `${draftSalesOrderCount} draft sales orders`,
            `${poWithoutShipmentCount} POs without shipment`,
            "Order lifecycle health is linked to assistant exceptions and twin graph coverage.",
          ],
          action: {
            id: "lmp42-open-order-flow",
            kind: "navigate",
            label: "Open order flow",
            description: "Review order lifecycle bottlenecks and missing execution links.",
            href: "/sales-orders",
          },
        },
        {
          id: "shipment-flow-twin",
          title: "Shipment-flow twin",
          subtitle: `${shipmentCount} shipments · ${openExceptionCount} active exceptions`,
          tone: openExceptionCount > 0 ? "watch" : shipmentCount > 0 ? "ready" : "critical",
          href: "/control-tower",
          evidence: [
            `${openAlertCount} open Control Tower alerts`,
            `${carrierLinkedShipmentCount} shipments linked to carrier supplier`,
            "Shipment flow readiness depends on carrier, milestone, and exception evidence.",
          ],
          action: {
            id: "lmp43-open-shipment-flow",
            kind: "navigate",
            label: "Open shipment flow",
            description: "Inspect shipment lifecycle health, carrier risk, and recovery actions.",
            href: "/control-tower",
          },
        },
        {
          id: "inventory-flow-twin",
          title: "Inventory-flow twin",
          subtitle: `${inventoryByProduct.size} products with sampled stock`,
          tone: inventoryByProduct.size > 0 ? "ready" : "watch",
          href: "/wms/stock",
          evidence: Array.from(inventoryByProduct.values())
            .slice(0, 3)
            .map((row) => `${row.label}: ${Math.max(0, row.onHand - row.allocated - row.held).toLocaleString()} available`),
          action: {
            id: "lmp44-open-inventory-flow",
            kind: "navigate",
            label: "Open inventory flow",
            description: "Review stock movement, allocation, and promise impacts.",
            href: "/wms/stock",
          },
        },
      ],
    },
    {
      id: "collaboration-sustainability-reporting",
      lmpRange: "LMP45-LMP47",
      title: "Collaboration, sustainability, and board reporting",
      summary: "External collaboration coverage, emissions/data gaps, and leadership-ready reporting.",
      href: "/executive",
      items: [
        {
          id: "network-collaboration",
          title: "Network collaboration hub",
          subtitle: `${supplierCount} suppliers · ${customerLinkedSalesOrderCount} customer-linked SO · ${carrierLinkedShipmentCount} carrier-linked shipments`,
          tone: supplierCount + customerLinkedSalesOrderCount + carrierLinkedShipmentCount > 0 ? "ready" : "watch",
          href: "/srm",
          evidence: [
            "Supplier, customer, and carrier collaboration can be grouped into one assistant handoff view.",
            `${openExceptionCount} shipment exception${openExceptionCount === 1 ? "" : "s"} may need external updates`,
            `${pendingActions} assistant action${pendingActions === 1 ? "" : "s"} pending human follow-up`,
          ],
          action: {
            id: "lmp45-open-network-collaboration",
            kind: "navigate",
            label: "Open collaboration work",
            description: "Review parties, open updates, promised responses, and generated communication packs.",
            href: "/srm",
          },
        },
        {
          id: "sustainability-readiness",
          title: "Sustainability readiness",
          subtitle: `${shipmentCount} shipments · ${inventoryByProduct.size} stocked products`,
          tone: shipmentCount > 0 && inventoryByProduct.size > 0 ? "watch" : "critical",
          href: "/control-tower/reports",
          evidence: [
            "Current readiness is a data-gap plan, not emissions calculation.",
            "Needed: mode, distance/lane, weight/volume, carrier, and warehouse movement coverage.",
            `${shipmentCount} shipments can contribute logistics activity data.`,
          ],
          action: {
            id: "lmp46-build-sustainability-gap-plan",
            kind: "copy_text",
            label: "Prepare data-gap plan",
            description: "Create a sustainability data readiness checklist from logistics and inventory coverage.",
            href: "/control-tower/reports",
          },
        },
        {
          id: "board-report",
          title: "Board-ready AI operating report",
          subtitle: `Operating score ${operatingScore}/100`,
          tone: toneFromScore(operatingScore),
          href: "/assistant/command-center",
          evidence: [
            `Automation ${automationScore}/100 · Twin ${twinScore}/100`,
            `Evidence ${evidenceCoverage}% · Feedback ${feedbackCoverage}%`,
            `${openAlertCount + openExceptionCount + openTwinRiskCount} open operating risk signal${openAlertCount + openExceptionCount + openTwinRiskCount === 1 ? "" : "s"}`,
          ],
          action: {
            id: "lmp47-copy-board-report",
            kind: "copy_text",
            label: "Prepare board report",
            description: "Generate a leadership-ready report with value, risks, controls, adoption, roadmap, and gaps.",
            href: "/assistant/command-center",
          },
        },
      ],
    },
    {
      id: "admin-demo-os",
      lmpRange: "LMP48-LMP50",
      title: "AI admin console, demo scenarios, and operating system",
      summary: "Configuration readiness, repeatable demos, and the cohesive AI operating-system score.",
      href: "/assistant",
      items: [
        {
          id: "admin-console-readiness",
          title: "AI admin console readiness",
          subtitle: `${roles.length} roles · ${mappingTemplateCount} mappings · ${playbookRuns.length} recent playbooks`,
          tone: roles.length > 0 && mappingTemplateCount + playbookRuns.length > 0 ? "ready" : "watch",
          href: "/assistant/command-center",
          evidence: [
            "Admin config is currently distributed across command center, API Hub, role settings, playbooks, and prompt candidates.",
            `${connectors.length} integration connector${connectors.length === 1 ? "" : "s"} sampled`,
            `${rolePermissionCount} permission row${rolePermissionCount === 1 ? "" : "s"} configured`,
          ],
          action: {
            id: "lmp48-open-ai-admin-readiness",
            kind: "navigate",
            label: "Open admin readiness",
            description: "Review flags, prompt library, playbooks, automation candidates, and quality thresholds.",
            href: "/assistant/command-center",
          },
        },
        {
          id: "demo-scenario-pack",
          title: "End-to-end demo scenario pack",
          subtitle: `${salesOrderCount > 0 ? "SO" : "SO gap"} · ${shipmentCount > 0 ? "CT" : "CT gap"} · ${invoiceCount > 0 ? "Invoice" : "Invoice gap"} · ${twinScenarioCount > 0 ? "Twin" : "Twin gap"}`,
          tone: salesOrderCount > 0 && shipmentCount > 0 && twinScenarioCount > 0 ? "ready" : "watch",
          href: "/assistant/workbench",
          evidence: [
            `${accountingApprovedCount}/${invoiceCount} invoice intakes accounting-approved`,
            `${twinScenarioCount} twin scenario draft${twinScenarioCount === 1 ? "" : "s"}`,
            `${scenarios[0]?.title ?? "No recent twin scenario title"} is the latest scenario seed candidate.`,
          ],
          action: {
            id: "lmp49-open-demo-scenarios",
            kind: "navigate",
            label: "Open demo path",
            description: "Walk through sales/order/shipment/inventory/invoice/twin assistant scenarios.",
            href: "/assistant/workbench",
          },
        },
        {
          id: "ai-operating-system",
          title: "AI operating system v1",
          subtitle: `Cohesion score ${operatingScore}/100`,
          tone: toneFromScore(operatingScore),
          href: "/assistant",
          evidence: [
            "Connected work queues, object memory, evidence, playbooks, approvals, quality gates, and executive reporting are visible.",
            `${auditTotal} audit events · ${pendingActions} pending actions · ${playbookRuns.length} recent playbooks`,
            `${twinEntityCount} twin entities · ${connectors.length} connectors · ${openExceptionCount} CT exceptions`,
          ],
          action: {
            id: "lmp50-open-ai-operating-system",
            kind: "navigate",
            label: "Open assistant OS",
            description: "Use the assistant shell as the operating layer across work queues, memory, evidence, approvals, and reporting.",
            href: "/assistant",
          },
        },
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
      suppliers: canSuppliers,
      apiHub: canApiHub,
      risk: canRisk,
      invoiceAudit: canInvoiceAudit,
    },
    metrics: {
      automationScore,
      twinScore,
      operatingScore,
      pendingActions,
      doneActions,
      rejectedActions,
      staleActions,
      auditTotal,
      helpfulAudit,
      needsReviewAudit,
      missingFeedback,
      evidenceCoverage,
      feedbackCoverage,
      twinEntityCount,
      twinEdgeCount,
      twinScenarioCount,
      openTwinRiskCount,
      openAlertCount,
      openExceptionCount,
    },
    sections,
  });
}
