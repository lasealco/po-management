import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  buildValueRealizationPacket,
  type ValueActionSignal,
  type ValueAuditSignal,
  type ValueAutomationSignal,
  type ValueFinanceSignal,
  type ValueRealizationInputs,
  type ValueServiceSignal,
} from "@/lib/assistant/value-realization";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireValueAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  }
  const canSettings = viewerHas(access.grantSet, "org.settings", edit ? "edit" : "view");
  const canReports = viewerHas(access.grantSet, "org.reports", "view");
  if (!canSettings && !canReports) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires settings or reports access for value realization.",
        code: "FORBIDDEN",
        status: 403,
      }),
    };
  }
  return { ok: true as const, access };
}

function money(value: unknown): number {
  if (value == null) return 0;
  const n = Number(typeof value === "object" && "toString" in value ? String(value.toString()) : value);
  return Number.isFinite(n) ? n : 0;
}

async function loadValueInputs(tenantId: string, grantSet: Set<string>): Promise<ValueRealizationInputs> {
  const [audits, actions, financePackets, invoiceIntakes, customerBriefs, exceptions, automations, shadowRuns] = await Promise.all([
    prisma.assistantAuditEvent.findMany({
      where: { tenantId, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { id: true, surface: true, actorUserId: true, answerKind: true, objectType: true, feedback: true, createdAt: true },
    }),
    prisma.assistantActionQueueItem.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 500,
      select: { id: true, actionKind: true, status: true, priority: true, objectType: true, createdAt: true },
    }),
    viewerHas(grantSet, "org.invoice_audit", "view")
      ? prisma.assistantFinancePacket.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 80,
          select: { id: true, status: true, totalVariance: true, disputeAmount: true, accrualAmount: true, createdAt: true },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.invoice_audit", "view")
      ? prisma.invoiceIntake.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 120,
          select: {
            id: true,
            status: true,
            rollupOutcome: true,
            approvedForAccounting: true,
            financeHandoffStatus: true,
            receivedAt: true,
            auditResults: { select: { amountVariance: true } },
          },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.crm", "view")
      ? prisma.assistantCustomerBrief.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 100,
          select: { id: true, status: true, serviceScore: true, updatedAt: true },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.controltower", "view")
      ? prisma.ctException.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 160,
          select: { id: true, status: true, severity: true, resolvedAt: true, claimAmount: true, createdAt: true },
        })
      : Promise.resolve([]),
    prisma.assistantAutomationPolicy.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 120,
      select: { id: true, actionKind: true, status: true, readinessScore: true },
    }),
    prisma.assistantAutomationShadowRun.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, actionKind: true, runMode: true, matched: true },
    }),
  ]);

  const auditSignals: ValueAuditSignal[] = audits.map((audit) => ({
    id: audit.id,
    surface: audit.surface,
    actorUserId: audit.actorUserId,
    answerKind: audit.answerKind,
    objectType: audit.objectType,
    feedback: audit.feedback,
    createdAt: audit.createdAt.toISOString(),
  }));
  const actionSignals: ValueActionSignal[] = actions.map((action) => ({
    id: action.id,
    actionKind: action.actionKind,
    status: action.status,
    priority: action.priority,
    objectType: action.objectType,
    createdAt: action.createdAt.toISOString(),
  }));
  const financeSignals: ValueFinanceSignal[] = [
    ...financePackets.map((packet) => ({
      id: packet.id,
      sourceType: "FINANCE_PACKET" as const,
      status: packet.status,
      varianceAmount: money(packet.totalVariance),
      recoveredAmount: Math.max(0, money(packet.disputeAmount) + money(packet.accrualAmount)),
      createdAt: packet.createdAt.toISOString(),
    })),
    ...invoiceIntakes.map((intake) => {
      const variance = intake.auditResults.reduce((sum, result) => sum + money(result.amountVariance), 0);
      return {
        id: intake.id,
        sourceType: "INVOICE_INTAKE" as const,
        status: String(intake.financeHandoffStatus ?? intake.status),
        varianceAmount: variance,
        recoveredAmount: intake.approvedForAccounting || intake.financeHandoffStatus === "DISPUTE_QUEUED" ? Math.max(0, Math.abs(variance)) : 0,
        createdAt: intake.receivedAt.toISOString(),
      };
    }),
  ];
  const serviceSignals: ValueServiceSignal[] = [
    ...customerBriefs.map((brief) => ({
      id: brief.id,
      sourceType: "CUSTOMER_BRIEF" as const,
      status: brief.status,
      serviceScore: brief.serviceScore,
      severity: brief.serviceScore < 60 ? "HIGH" : brief.serviceScore < 75 ? "MEDIUM" : "LOW",
      resolved: brief.status === "APPROVED_REPLY" || brief.status === "REVIEW_QUEUED",
      createdAt: brief.updatedAt.toISOString(),
    })),
    ...exceptions.map((exception) => ({
      id: exception.id,
      sourceType: "CT_EXCEPTION" as const,
      status: String(exception.status),
      serviceScore: exception.status === "RESOLVED" || exception.resolvedAt ? 85 : exception.severity === "CRITICAL" ? 45 : 65,
      severity: exception.severity === "CRITICAL" ? "HIGH" : exception.severity === "WARN" ? "MEDIUM" : "LOW",
      resolved: exception.status === "RESOLVED" || exception.resolvedAt != null,
      createdAt: exception.createdAt.toISOString(),
    })),
  ];
  const shadowByAction = new Map(shadowRuns.map((run) => [run.actionKind, run.matched]));
  const automationSignals: ValueAutomationSignal[] = automations.map((automation) => ({
    id: automation.id,
    actionKind: automation.actionKind,
    status: automation.status,
    readinessScore: automation.readinessScore,
    matched: shadowByAction.get(automation.actionKind) ?? null,
  }));
  return {
    audits: auditSignals,
    actions: actionSignals,
    finances: financeSignals,
    services: serviceSignals,
    automations: automationSignals,
    assumptions: {
      hourlyCost: 75,
      minutesSavedPerCompletedAction: 18,
      automationMinutesSaved: 45,
      customerSaveValue: 250,
      monthlyProgramCost: 5000,
    },
  };
}

async function buildSnapshot(tenantId: string, grantSet: Set<string>) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantValueRealizationPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        valueScore: true,
        adoptionScore: true,
        totalEstimatedValue: true,
        automationSavings: true,
        recoveredValue: true,
        avoidedCost: true,
        roiPct: true,
        adoptionFunnelJson: true,
        valueAttributionJson: true,
        savingsJson: true,
        serviceImpactJson: true,
        cohortJson: true,
        roiAssumptionJson: true,
        exportReportJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        updatedAt: true,
      },
    }),
    loadValueInputs(tenantId, grantSet),
  ]);
  const preview = buildValueRealizationPacket(inputs);
  return {
    signals: {
      interactions: inputs.audits.length,
      actions: inputs.actions.length,
      financeSignals: inputs.finances.length,
      serviceSignals: inputs.services.length,
      previewValueScore: preview.valueScore,
      previewEstimatedValue: preview.totalEstimatedValue,
    },
    preview,
    packets: packets.map((packet) => ({
      ...packet,
      totalEstimatedValue: money(packet.totalEstimatedValue),
      automationSavings: money(packet.automationSavings),
      recoveredValue: money(packet.recoveredValue),
      avoidedCost: money(packet.avoidedCost),
      approvedAt: packet.approvedAt?.toISOString() ?? null,
      updatedAt: packet.updatedAt.toISOString(),
    })),
  };
}

export async function GET() {
  const gate = await requireValueAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id, gate.access.grantSet));
}

export async function POST(request: Request) {
  const gate = await requireValueAccess(true);
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

  if (action === "queue_value_review") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const approvalNote = typeof body.approvalNote === "string" ? body.approvalNote.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantValueRealizationPacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Value realization packet not found.", code: "NOT_FOUND", status: 404 });
    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_value_realization",
        prompt: "Queue assistant value realization review",
        answerKind: "assistant_value_review",
        message: "Assistant value realization packet queued for human review. ROI claims, board reports, customer reports, finance records, service records, and source telemetry were not published or mutated automatically.",
        evidence: { packetId: packet.id, valueScore: packet.valueScore, totalEstimatedValue: money(packet.totalEstimatedValue), approvalNote } as Prisma.InputJsonObject,
        objectType: "assistant_value_realization_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_value_realization_packet",
        objectId: packet.id,
        objectHref: "/assistant/value-realization",
        priority: packet.valueScore >= 70 ? "MEDIUM" : "HIGH",
        actionId: `amp31-value-${packet.id}`.slice(0, 128),
        actionKind: "assistant_value_realization_review",
        label: `Review value packet: ${packet.title}`,
        description: "Approve ROI assumptions, attribution, and role-safe board/customer reports before sharing.",
        payload: { packetId: packet.id, valueScore: packet.valueScore, approvalNote } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    const updated = await prisma.assistantValueRealizationPacket.update({
      where: { id: packet.id },
      data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id, approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote },
      select: { id: true, status: true, actionQueueItemId: true },
    });
    return NextResponse.json({ ok: true, packet: updated, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
  }

  if (action !== "create_packet") {
    return toApiErrorResponse({ error: "Unsupported value realization action.", code: "BAD_INPUT", status: 400 });
  }

  const inputs = await loadValueInputs(gate.access.tenant.id, gate.access.grantSet);
  const built = buildValueRealizationPacket(inputs);
  const packet = await prisma.assistantValueRealizationPacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      valueScore: built.valueScore,
      adoptionScore: built.adoptionScore,
      totalEstimatedValue: built.totalEstimatedValue,
      automationSavings: built.automationSavings,
      recoveredValue: built.recoveredValue,
      avoidedCost: built.avoidedCost,
      roiPct: built.roiPct,
      adoptionFunnelJson: built.adoptionFunnel as Prisma.InputJsonValue,
      valueAttributionJson: built.valueAttribution as Prisma.InputJsonValue,
      savingsJson: built.savings as Prisma.InputJsonValue,
      serviceImpactJson: built.serviceImpact as Prisma.InputJsonValue,
      cohortJson: built.cohorts as Prisma.InputJsonValue,
      roiAssumptionJson: built.roiAssumptions as Prisma.InputJsonValue,
      exportReportJson: built.exportReport as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, valueScore: true, totalEstimatedValue: true, status: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_value_realization",
      prompt: "Create assistant value realization packet",
      answerKind: "assistant_value_realization_packet",
      message: built.leadershipSummary,
      evidence: { adoption: built.adoptionFunnel, savings: built.savings, exportReport: built.exportReport } as Prisma.InputJsonObject,
      objectType: "assistant_value_realization_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet: { ...packet, totalEstimatedValue: money(packet.totalEstimatedValue) }, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) }, { status: 201 });
}
