import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  buildAssistantBoardReport,
  buildAssistantDemoScript,
  computeAssistantOperatingScore,
  type AssistantOperatingSignals,
} from "@/lib/assistant/operating-system";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

async function requireAssistantOperatingAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  const canView =
    viewerHas(access.grantSet, "org.orders", "view") ||
    viewerHas(access.grantSet, "org.controltower", "view") ||
    viewerHas(access.grantSet, "org.settings", "view");
  if (!canView) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Not allowed.", code: "FORBIDDEN", status: 403 }) };
  }
  if (edit && !viewerHas(access.grantSet, "org.settings", "edit")) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Forbidden: requires org.settings edit.", code: "FORBIDDEN", status: 403 }) };
  }
  return { ok: true as const, access };
}

export async function buildAssistantOperatingSnapshot(tenantId: string, tenantName: string) {
  const [
    auditTotal,
    evidenceRecordCount,
    pendingActionCount,
    completedActionCount,
    activePlaybookCount,
    completedPlaybookCount,
    approvedPromptCount,
    releaseGate,
    enabledAutomationCount,
    adminControl,
    apiHubOpenReviewCount,
    twinOpenInsightCount,
    latestReports,
  ] = await Promise.all([
    prisma.assistantAuditEvent.count({ where: { tenantId, archivedAt: null } }),
    prisma.assistantEvidenceRecord.count({ where: { tenantId, archivedAt: null } }),
    prisma.assistantActionQueueItem.count({ where: { tenantId, status: "PENDING" } }),
    prisma.assistantActionQueueItem.count({ where: { tenantId, status: "DONE" } }),
    prisma.assistantPlaybookRun.count({ where: { tenantId, status: "IN_PROGRESS" } }),
    prisma.assistantPlaybookRun.count({ where: { tenantId, status: "COMPLETED" } }),
    prisma.assistantPromptLibraryItem.count({ where: { tenantId, status: "APPROVED" } }),
    prisma.assistantReleaseGate.findFirst({
      where: { tenantId, gateKey: "assistant_quality_release" },
      orderBy: { evaluatedAt: "desc" },
      select: { status: true, score: true, evaluatedAt: true },
    }),
    prisma.assistantAutomationPolicy.count({ where: { tenantId, status: "ENABLED" } }),
    prisma.assistantAdminControl.findUnique({
      where: { tenantId_controlKey: { tenantId, controlKey: "assistant_admin_console" } },
      select: { packetStatus: true, rolloutMode: true, updatedAt: true },
    }),
    prisma.apiHubAssistantReviewItem.count({ where: { tenantId, status: "OPEN" } }),
    prisma.supplyChainTwinAssistantInsight.count({ where: { tenantId, status: "OPEN" } }),
    prisma.assistantOperatingReport.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, status: true, score: true, summary: true, createdAt: true },
    }),
  ]);

  const signals: AssistantOperatingSignals = {
    auditTotal,
    evidenceRecordCount,
    pendingActionCount,
    completedActionCount,
    activePlaybookCount,
    completedPlaybookCount,
    approvedPromptCount,
    releaseGateScore: releaseGate?.score ?? 0,
    releaseGatePassed: releaseGate?.status === "PASSED",
    enabledAutomationCount,
    adminPacketReady: adminControl?.packetStatus === "READY",
    apiHubOpenReviewCount,
    twinOpenInsightCount,
  };
  const score = computeAssistantOperatingScore(signals);
  const boardReport = buildAssistantBoardReport({ generatedAt: new Date().toISOString(), tenantName, signals });
  return {
    generatedAt: new Date().toISOString(),
    score,
    status: boardReport.status,
    signals,
    boardReport,
    demoScript: buildAssistantDemoScript(signals),
    releaseGate: releaseGate ? { ...releaseGate, evaluatedAt: releaseGate.evaluatedAt.toISOString() } : null,
    adminControl: adminControl ? { ...adminControl, updatedAt: adminControl.updatedAt.toISOString() } : null,
    latestReports: latestReports.map((report) => ({ ...report, createdAt: report.createdAt.toISOString() })),
  };
}

export async function GET() {
  const gate = await requireAssistantOperatingAccess();
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildAssistantOperatingSnapshot(gate.access.tenant.id, gate.access.tenant.name));
}

export async function POST(request: Request) {
  const gate = await requireAssistantOperatingAccess(true);
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
  if (body.action !== "export_board_report") {
    return toApiErrorResponse({ error: "Unsupported operating-system action.", code: "BAD_INPUT", status: 400 });
  }
  const snapshot = await buildAssistantOperatingSnapshot(gate.access.tenant.id, gate.access.tenant.name);
  const report = await prisma.assistantOperatingReport.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      reportKey: "amp12_customer_demo_board_report",
      title: "AMP12 Customer Demo Board Report",
      status: snapshot.status,
      score: snapshot.score,
      summary: snapshot.boardReport.executiveSummary,
      reportJson: snapshot.boardReport as unknown as Prisma.InputJsonValue,
    },
    select: { id: true, status: true, score: true, createdAt: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_operating_system",
      prompt: "Export AMP12 assistant operating system board report",
      answerKind: "board_report",
      message: snapshot.boardReport.executiveSummary,
      evidence: snapshot.boardReport as unknown as Prisma.InputJsonValue,
      objectType: "assistant_operating_report",
      objectId: report.id,
    },
  });
  return NextResponse.json({ ok: true, report: { ...report, createdAt: report.createdAt.toISOString() } }, { status: 201 });
}
