import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  buildCustomerSafeIncidentSummary,
  buildExceptionIncidentDraft,
  type ExceptionSignal,
  mergeIncidentDrafts,
  normalizeExceptionSeverity,
} from "@/lib/assistant/exception-nerve-center";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MODULE_GRANTS = [
  ["org.controltower", "Control Tower"],
  ["org.wms", "WMS"],
  ["org.suppliers", "SRM"],
  ["org.orders", "Orders"],
  ["org.invoice_audit", "Invoice audit"],
  ["org.apihub", "API Hub"],
  ["org.scri", "Twin risk"],
] as const;

async function requireExceptionCenterAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  }
  const canViewAny = MODULE_GRANTS.some(([resource]) => viewerHas(access.grantSet, resource, "view"));
  const canEditAny = MODULE_GRANTS.some(([resource]) => viewerHas(access.grantSet, resource, "edit"));
  if (!canViewAny || (edit && !canEditAny)) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: edit ? "Forbidden: requires at least one operational edit grant." : "Forbidden: requires at least one operational view grant.",
        code: "FORBIDDEN",
        status: 403,
      }),
    };
  }
  return { ok: true as const, access, canEditAny };
}

function iso(date: Date | string | null | undefined) {
  return date ? new Date(date).toISOString() : new Date(0).toISOString();
}

async function loadSignals(tenantId: string, grantSet: Set<string>, userId: string): Promise<ExceptionSignal[]> {
  const signals: ExceptionSignal[] = [];
  const now = Date.now();

  if (viewerHas(grantSet, "org.controltower", "view")) {
    const [alerts, exceptions] = await Promise.all([
      prisma.ctAlert.findMany({
        where: { tenantId, status: "OPEN" },
        orderBy: { updatedAt: "desc" },
        take: 40,
        select: {
          id: true,
          shipmentId: true,
          severity: true,
          title: true,
          body: true,
          updatedAt: true,
          shipment: { select: { shipmentNo: true, customerCrmAccount: { select: { name: true } }, opsAssignee: { select: { name: true } } } },
        },
      }),
      prisma.ctException.findMany({
        where: { tenantId, status: "OPEN" },
        orderBy: { updatedAt: "desc" },
        take: 40,
        select: {
          id: true,
          shipmentId: true,
          type: true,
          severity: true,
          rootCause: true,
          customerImpact: true,
          recoveryState: true,
          updatedAt: true,
          shipment: { select: { shipmentNo: true, customerCrmAccount: { select: { name: true } }, opsAssignee: { select: { name: true } } } },
        },
      }),
    ]);
    for (const alert of alerts) {
      signals.push({
        id: `ct-alert:${alert.id}`,
        module: "Control Tower",
        objectType: "ct_alert",
        objectId: alert.id,
        title: alert.title,
        detail: alert.body,
        severity: normalizeExceptionSeverity(alert.severity),
        status: "OPEN",
        href: `/control-tower/shipments/${alert.shipmentId}`,
        customerLabel: alert.shipment.customerCrmAccount?.name ?? null,
        ownerLabel: alert.shipment.opsAssignee?.name ?? null,
        occurredAt: iso(alert.updatedAt),
        dedupeKey: `shipment:${alert.shipmentId}`,
      });
    }
    for (const exception of exceptions) {
      signals.push({
        id: `ct-exception:${exception.id}`,
        module: "Control Tower",
        objectType: "ct_exception",
        objectId: exception.id,
        title: `${exception.type} on ${exception.shipment.shipmentNo ?? exception.shipmentId}`,
        detail: exception.customerImpact ?? exception.rootCause,
        severity: normalizeExceptionSeverity(exception.severity),
        status: exception.recoveryState,
        href: `/control-tower/shipments/${exception.shipmentId}?tab=recovery`,
        customerLabel: exception.shipment.customerCrmAccount?.name ?? null,
        ownerLabel: exception.shipment.opsAssignee?.name ?? null,
        occurredAt: iso(exception.updatedAt),
        dedupeKey: `shipment:${exception.shipmentId}`,
      });
    }
  }

  if (viewerHas(grantSet, "org.wms", "view")) {
    const tasks = await prisma.wmsTask.findMany({
      where: { tenantId, status: "OPEN" },
      orderBy: { createdAt: "asc" },
      take: 60,
      select: {
        id: true,
        taskType: true,
        shipmentId: true,
        orderId: true,
        quantity: true,
        createdAt: true,
        warehouse: { select: { name: true, code: true } },
        product: { select: { name: true, sku: true } },
      },
    });
    for (const task of tasks.filter((row) => now - row.createdAt.getTime() >= 18 * 60 * 60 * 1000).slice(0, 30)) {
      signals.push({
        id: `wms-task:${task.id}`,
        module: "WMS",
        objectType: "wms_task",
        objectId: task.id,
        title: `${task.taskType} backlog at ${task.warehouse.name}`,
        detail: `${Number(task.quantity)} units${task.product ? ` for ${task.product.name ?? task.product.sku}` : ""}.`,
        severity: now - task.createdAt.getTime() >= 48 * 60 * 60 * 1000 ? "HIGH" : "MEDIUM",
        status: "OPEN",
        href: "/wms/tasks",
        customerLabel: null,
        ownerLabel: task.warehouse.code ?? task.warehouse.name,
        occurredAt: iso(task.createdAt),
        dedupeKey: task.shipmentId ? `shipment:${task.shipmentId}` : task.orderId ? `po:${task.orderId}` : `warehouse:${task.warehouse.name}`,
      });
    }
  }

  if (viewerHas(grantSet, "org.suppliers", "view")) {
    const notifications = await prisma.srmOperatorNotification.findMany({
      where: { tenantId, userId, readAt: null },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, kind: true, title: true, body: true, supplierId: true, createdAt: true, supplier: { select: { name: true } } },
    });
    for (const notification of notifications) {
      signals.push({
        id: `srm-notification:${notification.id}`,
        module: "SRM",
        objectType: "srm_operator_notification",
        objectId: notification.id,
        title: notification.title,
        detail: notification.body,
        severity: normalizeExceptionSeverity(notification.kind.includes("ESCAL") ? "HIGH" : "MEDIUM"),
        status: "UNREAD",
        href: notification.supplierId ? `/suppliers/${notification.supplierId}` : "/suppliers",
        customerLabel: null,
        ownerLabel: notification.supplier?.name ?? null,
        occurredAt: iso(notification.createdAt),
        dedupeKey: notification.supplierId ? `supplier:${notification.supplierId}` : `srm:${notification.kind}`,
      });
    }
  }

  if (viewerHas(grantSet, "org.orders", "view")) {
    const salesOrders = await prisma.salesOrder.findMany({
      where: { tenantId, assistantReviewStatus: { in: ["PENDING", "NEEDS_CHANGES"] } },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: { id: true, soNumber: true, customerName: true, assistantReviewStatus: true, requestedDeliveryDate: true, updatedAt: true },
    });
    for (const order of salesOrders) {
      signals.push({
        id: `sales-order:${order.id}`,
        module: "Orders",
        objectType: "sales_order",
        objectId: order.id,
        title: `Sales order ${order.soNumber} needs assistant review`,
        detail: order.requestedDeliveryDate ? `Requested delivery ${order.requestedDeliveryDate.toISOString().slice(0, 10)}.` : null,
        severity: order.assistantReviewStatus === "NEEDS_CHANGES" ? "HIGH" : "MEDIUM",
        status: order.assistantReviewStatus,
        href: `/sales-orders/${order.id}`,
        customerLabel: order.customerName,
        ownerLabel: null,
        occurredAt: iso(order.updatedAt),
        dedupeKey: `customer:${order.customerName.toLowerCase()}`,
      });
    }
  }

  if (viewerHas(grantSet, "org.invoice_audit", "view")) {
    const intakes = await prisma.invoiceIntake.findMany({
      where: { tenantId, OR: [{ rollupOutcome: { in: ["WARN", "FAIL"] } }, { financeHandoffStatus: "DISPUTE_READY" }] },
      orderBy: { updatedAt: "desc" },
      take: 35,
      select: { id: true, externalInvoiceNo: true, vendorLabel: true, rollupOutcome: true, redLineCount: true, amberLineCount: true, updatedAt: true },
    });
    for (const intake of intakes) {
      signals.push({
        id: `invoice-intake:${intake.id}`,
        module: "Invoice audit",
        objectType: "invoice_intake",
        objectId: intake.id,
        title: `Invoice audit ${intake.rollupOutcome}: ${intake.externalInvoiceNo ?? intake.id}`,
        detail: `${intake.redLineCount} red and ${intake.amberLineCount} amber variance lines.`,
        severity: normalizeExceptionSeverity(intake.rollupOutcome),
        status: intake.rollupOutcome,
        href: `/invoice-audit/${intake.id}`,
        customerLabel: null,
        ownerLabel: intake.vendorLabel,
        occurredAt: iso(intake.updatedAt),
        dedupeKey: intake.vendorLabel ? `vendor:${intake.vendorLabel.toLowerCase()}` : `invoice:${intake.id}`,
      });
    }
  }

  if (viewerHas(grantSet, "org.apihub", "view")) {
    const runs = await prisma.apiHubIngestionRun.findMany({
      where: { tenantId, status: { in: ["failed", "error"] } },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: { id: true, connectorId: true, status: true, errorCode: true, errorMessage: true, updatedAt: true, connector: { select: { name: true } } },
    });
    for (const run of runs) {
      signals.push({
        id: `apihub-run:${run.id}`,
        module: "API Hub",
        objectType: "api_hub_ingestion_run",
        objectId: run.id,
        title: `Integration run failed: ${run.connector?.name ?? run.connectorId ?? run.id}`,
        detail: run.errorMessage ?? run.errorCode,
        severity: "HIGH",
        status: run.status,
        href: "/apihub",
        customerLabel: null,
        ownerLabel: run.connector?.name ?? null,
        occurredAt: iso(run.updatedAt),
        dedupeKey: run.connectorId ? `connector:${run.connectorId}` : `apihub:${run.id}`,
      });
    }
  }

  if (viewerHas(grantSet, "org.scri", "view")) {
    const risks = await prisma.supplyChainTwinRiskSignal.findMany({
      where: { tenantId, acknowledged: false },
      orderBy: { updatedAt: "desc" },
      take: 35,
      select: { id: true, code: true, severity: true, title: true, detail: true, updatedAt: true },
    });
    for (const risk of risks) {
      signals.push({
        id: `twin-risk:${risk.id}`,
        module: "Twin risk",
        objectType: "supply_chain_twin_risk_signal",
        objectId: risk.id,
        title: risk.title,
        detail: risk.detail,
        severity: normalizeExceptionSeverity(risk.severity),
        status: "UNACKNOWLEDGED",
        href: "/supply-chain-twin/assistant",
        customerLabel: null,
        ownerLabel: null,
        occurredAt: iso(risk.updatedAt),
        dedupeKey: `risk:${risk.code}`,
      });
    }
  }

  return signals.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 160);
}

async function buildSnapshot(tenantId: string, grantSet: Set<string>, userId: string) {
  const [signals, incidents] = await Promise.all([
    loadSignals(tenantId, grantSet, userId),
    prisma.assistantExceptionIncident.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        severity: true,
        severityScore: true,
        sourceSummaryJson: true,
        blastRadiusJson: true,
        communicationDraftJson: true,
        customerImpact: true,
        rootCauseNote: true,
        updatedAt: true,
      },
    }),
  ]);
  const grantModules = MODULE_GRANTS.filter(([resource]) => viewerHas(grantSet, resource, "view")).map(([, label]) => label);
  return {
    signals,
    grantModules,
    incidents: incidents.map((incident) => ({ ...incident, updatedAt: incident.updatedAt.toISOString() })),
  };
}

export async function GET() {
  const gate = await requireExceptionCenterAccess(false);
  if (!gate.ok) return gate.response;
  const activeUserId = gate.access.user?.id;
  if (!activeUserId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id, gate.access.grantSet, activeUserId));
}

export async function POST(request: Request) {
  const gate = await requireExceptionCenterAccess(true);
  if (!gate.ok) return gate.response;
  const actorUserId = await getActorUserId();
  if (!actorUserId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "close_incident") {
    const incidentId = typeof body.incidentId === "string" ? body.incidentId.trim() : "";
    const rootCauseNote = typeof body.rootCauseNote === "string" ? body.rootCauseNote.trim() : "";
    if (!incidentId || !rootCauseNote) return toApiErrorResponse({ error: "incidentId and rootCauseNote are required.", code: "BAD_INPUT", status: 400 });
    const incident = await prisma.assistantExceptionIncident.findFirst({ where: { tenantId: gate.access.tenant.id, id: incidentId } });
    if (!incident) return toApiErrorResponse({ error: "Incident not found.", code: "NOT_FOUND", status: 404 });
    const updated = await prisma.assistantExceptionIncident.update({
      where: { id: incident.id },
      data: { status: "CLOSED", rootCauseNote, closedAt: new Date() },
      select: { id: true, status: true },
    });
    await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_exception_center",
        prompt: "Close exception incident",
        answerKind: "incident_close",
        message: `Closed ${incident.title} with root-cause notes.`,
        evidence: { incidentId: incident.id, rootCauseNote } as Prisma.InputJsonObject,
        objectType: "assistant_exception_incident",
        objectId: incident.id,
      },
    });
    return NextResponse.json({ ok: true, incident: updated });
  }

  if (action === "queue_playbook") {
    const incidentId = typeof body.incidentId === "string" ? body.incidentId.trim() : "";
    if (!incidentId) return toApiErrorResponse({ error: "incidentId is required.", code: "BAD_INPUT", status: 400 });
    const incident = await prisma.assistantExceptionIncident.findFirst({ where: { tenantId: gate.access.tenant.id, id: incidentId } });
    if (!incident) return toApiErrorResponse({ error: "Incident not found.", code: "NOT_FOUND", status: 404 });
    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_exception_center",
        prompt: "Queue incident playbook approval",
        answerKind: "incident_playbook",
        message: `Queued incident command approval for ${incident.title}.`,
        evidence: { incidentId: incident.id, playbook: incident.playbookJson, communicationDraft: incident.communicationDraftJson } as Prisma.InputJsonValue,
        objectType: "assistant_exception_incident",
        objectId: incident.id,
      },
      select: { id: true },
    });
    const actionItem = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_exception_incident",
        objectId: incident.id,
        objectHref: "/assistant/exception-center",
        priority: incident.severity === "CRITICAL" || incident.severity === "HIGH" ? "HIGH" : "MEDIUM",
        actionId: `amp17-incident-${incident.id}`.slice(0, 128),
        actionKind: "incident_command_approval",
        label: `Approve incident command: ${incident.title}`,
        description: "Approve incident playbook and communication drafts before module mutations or outbound messages.",
        payload: { incidentId: incident.id, playbook: incident.playbookJson, communicationDraft: incident.communicationDraftJson } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    const updated = await prisma.assistantExceptionIncident.update({
      where: { id: incident.id },
      data: { status: "ACTION_QUEUED", actionQueueItemId: actionItem.id },
      select: { id: true, status: true },
    });
    return NextResponse.json({ ok: true, incident: updated });
  }

  if (action === "merge_incidents") {
    const primaryId = typeof body.primaryIncidentId === "string" ? body.primaryIncidentId.trim() : "";
    const secondaryId = typeof body.secondaryIncidentId === "string" ? body.secondaryIncidentId.trim() : "";
    if (!primaryId || !secondaryId || primaryId === secondaryId) return toApiErrorResponse({ error: "Two distinct incident ids are required.", code: "BAD_INPUT", status: 400 });
    const [primary, secondary] = await Promise.all([
      prisma.assistantExceptionIncident.findFirst({ where: { tenantId: gate.access.tenant.id, id: primaryId } }),
      prisma.assistantExceptionIncident.findFirst({ where: { tenantId: gate.access.tenant.id, id: secondaryId } }),
    ]);
    if (!primary || !secondary) return toApiErrorResponse({ error: "Incident not found.", code: "NOT_FOUND", status: 404 });
    const merged = mergeIncidentDrafts(
      {
        title: primary.title,
        incidentKey: primary.incidentKey,
        severity: normalizeExceptionSeverity(primary.severity),
        severityScore: primary.severityScore,
        sourceSummary: primary.sourceSummaryJson as ReturnType<typeof buildExceptionIncidentDraft>["sourceSummary"],
        linkedObjects: primary.linkedObjectsJson as ReturnType<typeof buildExceptionIncidentDraft>["linkedObjects"],
        blastRadius: primary.blastRadiusJson as ReturnType<typeof buildExceptionIncidentDraft>["blastRadius"],
        timeline: primary.timelineJson as ReturnType<typeof buildExceptionIncidentDraft>["timeline"],
        playbook: primary.playbookJson as ReturnType<typeof buildExceptionIncidentDraft>["playbook"],
        communicationDraft: primary.communicationDraftJson as ReturnType<typeof buildExceptionIncidentDraft>["communicationDraft"],
        customerImpact: primary.customerImpact ?? "",
      },
      {
        title: secondary.title,
        incidentKey: secondary.incidentKey,
        severity: normalizeExceptionSeverity(secondary.severity),
        severityScore: secondary.severityScore,
        sourceSummary: secondary.sourceSummaryJson as ReturnType<typeof buildExceptionIncidentDraft>["sourceSummary"],
        linkedObjects: secondary.linkedObjectsJson as ReturnType<typeof buildExceptionIncidentDraft>["linkedObjects"],
        blastRadius: secondary.blastRadiusJson as ReturnType<typeof buildExceptionIncidentDraft>["blastRadius"],
        timeline: secondary.timelineJson as ReturnType<typeof buildExceptionIncidentDraft>["timeline"],
        playbook: secondary.playbookJson as ReturnType<typeof buildExceptionIncidentDraft>["playbook"],
        communicationDraft: secondary.communicationDraftJson as ReturnType<typeof buildExceptionIncidentDraft>["communicationDraft"],
        customerImpact: secondary.customerImpact ?? "",
      },
    );
    const updated = await prisma.assistantExceptionIncident.update({
      where: { id: primary.id },
      data: {
        severity: merged.severity,
        severityScore: merged.severityScore,
        linkedObjectsJson: merged.linkedObjects as unknown as Prisma.InputJsonValue,
        blastRadiusJson: merged.blastRadius as unknown as Prisma.InputJsonValue,
        timelineJson: merged.timeline as unknown as Prisma.InputJsonValue,
        sourceSummaryJson: merged.sourceSummary as unknown as Prisma.InputJsonValue,
      },
      select: { id: true, severity: true, severityScore: true },
    });
    await prisma.assistantExceptionIncident.update({ where: { id: secondary.id }, data: { status: "MERGED", mergedIntoIncidentId: primary.id } });
    return NextResponse.json({ ok: true, incident: updated });
  }

  const activeUserId = gate.access.user?.id;
  if (!activeUserId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  const signals = await loadSignals(gate.access.tenant.id, gate.access.grantSet, activeUserId);
  const selectedIds = Array.isArray(body.signalIds) ? body.signalIds.filter((id): id is string => typeof id === "string") : [];
  const selectedSignals = selectedIds.length > 0 ? signals.filter((signal) => selectedIds.includes(signal.id)) : signals.slice(0, 12);

  if (action === "split_incident") {
    const sourceIncidentId = typeof body.sourceIncidentId === "string" ? body.sourceIncidentId.trim() : "";
    if (!sourceIncidentId || selectedSignals.length === 0) return toApiErrorResponse({ error: "sourceIncidentId and signalIds are required.", code: "BAD_INPUT", status: 400 });
    const source = await prisma.assistantExceptionIncident.findFirst({ where: { tenantId: gate.access.tenant.id, id: sourceIncidentId } });
    if (!source) return toApiErrorResponse({ error: "Source incident not found.", code: "NOT_FOUND", status: 404 });
    const draft = buildExceptionIncidentDraft({ title: typeof body.title === "string" ? body.title : `Split from ${source.title}`, signals: selectedSignals });
    const created = await prisma.assistantExceptionIncident.create({
      data: {
        tenantId: gate.access.tenant.id,
        createdByUserId: actorUserId,
        title: draft.title,
        status: "OPEN",
        severity: draft.severity,
        incidentKey: draft.incidentKey,
        severityScore: draft.severityScore,
        sourceSummaryJson: draft.sourceSummary as unknown as Prisma.InputJsonValue,
        linkedObjectsJson: draft.linkedObjects as unknown as Prisma.InputJsonValue,
        blastRadiusJson: draft.blastRadius as unknown as Prisma.InputJsonValue,
        timelineJson: draft.timeline as unknown as Prisma.InputJsonValue,
        playbookJson: draft.playbook as unknown as Prisma.InputJsonValue,
        communicationDraftJson: draft.communicationDraft as unknown as Prisma.InputJsonValue,
        customerImpact: buildCustomerSafeIncidentSummary(draft),
        splitFromIncidentId: source.id,
      },
      select: { id: true, title: true, severity: true },
    });
    return NextResponse.json({ ok: true, incident: created }, { status: 201 });
  }

  if (action !== "create_incident") {
    return toApiErrorResponse({ error: "Unsupported exception center action.", code: "BAD_INPUT", status: 400 });
  }
  if (selectedSignals.length === 0) {
    return toApiErrorResponse({ error: "No accessible signals are available to create an incident.", code: "BAD_INPUT", status: 400 });
  }
  const draft = buildExceptionIncidentDraft({ title: typeof body.title === "string" ? body.title : null, signals: selectedSignals });
  const created = await prisma.assistantExceptionIncident.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: draft.title,
      status: "OPEN",
      severity: draft.severity,
      incidentKey: draft.incidentKey,
      severityScore: draft.severityScore,
      sourceSummaryJson: draft.sourceSummary as unknown as Prisma.InputJsonValue,
      linkedObjectsJson: draft.linkedObjects as unknown as Prisma.InputJsonValue,
      blastRadiusJson: draft.blastRadius as unknown as Prisma.InputJsonValue,
      timelineJson: draft.timeline as unknown as Prisma.InputJsonValue,
      playbookJson: draft.playbook as unknown as Prisma.InputJsonValue,
      communicationDraftJson: draft.communicationDraft as unknown as Prisma.InputJsonValue,
      customerImpact: buildCustomerSafeIncidentSummary(draft),
    },
    select: { id: true, title: true, severity: true, severityScore: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_exception_center",
      prompt: `Create incident room: ${draft.title}`,
      answerKind: "incident_room",
      message: buildCustomerSafeIncidentSummary(draft),
      evidence: { draft, selectedSignalIds: selectedSignals.map((signal) => signal.id) } as unknown as Prisma.InputJsonValue,
      objectType: "assistant_exception_incident",
      objectId: created.id,
    },
  });
  return NextResponse.json({ ok: true, incident: created }, { status: 201 });
}
