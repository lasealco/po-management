import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { buildGovernancePacket, type GovernanceRecordSignal } from "@/lib/assistant/governance";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireGovernanceAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  }
  const canSettings = viewerHas(access.grantSet, "org.settings", edit ? "edit" : "view");
  if (!canSettings) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires settings access for assistant data governance.",
        code: "FORBIDDEN",
        status: 403,
      }),
    };
  }
  return { ok: true as const, access };
}

function looksSensitive(value: string | null | undefined) {
  if (!value) return false;
  return /@|\bphone\b|\bssn\b|\bpassport\b|\bpassword\b|\btoken\b|\bsecret\b|\bpersonal\b|\bpii\b/i.test(value);
}

function legalHoldSignal(value: string | null | undefined) {
  if (!value) return false;
  return /\blegal hold\b|\blitigation\b|\baudit hold\b|\bdo not delete\b/i.test(value);
}

async function loadGovernanceInputs(tenantId: string) {
  const [audits, evidenceRecords, reviewExamples, prompts, reports, emailThreads] = await Promise.all([
    prisma.assistantAuditEvent.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 120,
      select: { id: true, surface: true, prompt: true, message: true, objectType: true, objectId: true, archivedAt: true, archiveReason: true, createdAt: true, feedback: true },
    }),
    prisma.assistantEvidenceRecord.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, label: true, excerpt: true, sourceType: true, archivedAt: true, createdAt: true },
    }),
    prisma.assistantReviewExample.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: { id: true, label: true, correctionNote: true, exportJson: true, status: true, createdAt: true },
    }),
    prisma.assistantPromptLibraryItem.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: { id: true, title: true, prompt: true, status: true, domain: true, objectType: true, createdAt: true },
    }),
    prisma.assistantOperatingReport.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: { id: true, title: true, status: true, summary: true, reportJson: true, reportKey: true, createdAt: true },
    }),
    prisma.assistantEmailThread.findMany({
      where: { tenantId },
      orderBy: { receivedAt: "desc" },
      take: 80,
      select: { id: true, subject: true, fromAddress: true, toAddress: true, preview: true, status: true, receivedAt: true, linkedCrmAccountId: true, salesOrderId: true },
    }),
  ]);

  const records: GovernanceRecordSignal[] = [
    ...audits.map((audit) => ({
      id: audit.id,
      sourceType: "AUDIT_EVENT" as const,
      title: `${audit.surface}: ${audit.prompt.slice(0, 80)}`,
      status: audit.feedback,
      createdAt: audit.createdAt.toISOString(),
      archivedAt: audit.archivedAt?.toISOString() ?? null,
      hasPersonalData: looksSensitive(`${audit.prompt}\n${audit.message ?? ""}`),
      hasExportPayload: true,
      legalHold: legalHoldSignal(`${audit.archiveReason ?? ""}\n${audit.message ?? ""}`),
      objectType: audit.objectType,
      objectId: audit.objectId,
    })),
    ...evidenceRecords.map((record) => ({
      id: record.id,
      sourceType: "EVIDENCE_RECORD" as const,
      title: record.label,
      status: record.sourceType,
      createdAt: record.createdAt.toISOString(),
      archivedAt: record.archivedAt?.toISOString() ?? null,
      hasPersonalData: looksSensitive(`${record.label}\n${record.excerpt ?? ""}`),
      hasExportPayload: true,
      legalHold: legalHoldSignal(`${record.label}\n${record.excerpt ?? ""}`),
      objectType: "assistant_evidence_record",
      objectId: record.id,
    })),
    ...reviewExamples.map((example) => ({
      id: example.id,
      sourceType: "REVIEW_EXAMPLE" as const,
      title: `${example.label} review example`,
      status: example.status,
      createdAt: example.createdAt.toISOString(),
      archivedAt: null,
      hasPersonalData: looksSensitive(example.correctionNote),
      hasExportPayload: example.exportJson != null,
      legalHold: legalHoldSignal(example.correctionNote),
      objectType: "assistant_review_example",
      objectId: example.id,
    })),
    ...prompts.map((prompt) => ({
      id: prompt.id,
      sourceType: "PROMPT" as const,
      title: prompt.title,
      status: prompt.status,
      createdAt: prompt.createdAt.toISOString(),
      archivedAt: null,
      hasPersonalData: looksSensitive(`${prompt.title}\n${prompt.prompt}`),
      hasExportPayload: false,
      legalHold: legalHoldSignal(prompt.prompt),
      objectType: prompt.objectType ?? "assistant_prompt",
      objectId: prompt.id,
    })),
    ...reports.map((report) => ({
      id: report.id,
      sourceType: "OPERATING_REPORT" as const,
      title: report.title,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
      archivedAt: null,
      hasPersonalData: looksSensitive(`${report.summary}\n${JSON.stringify(report.reportJson).slice(0, 1000)}`),
      hasExportPayload: true,
      legalHold: legalHoldSignal(`${report.reportKey}\n${report.summary}`),
      objectType: "assistant_operating_report",
      objectId: report.id,
    })),
    ...emailThreads.map((thread) => ({
      id: thread.id,
      sourceType: "EMAIL_THREAD" as const,
      title: thread.subject,
      status: String(thread.status),
      createdAt: thread.receivedAt.toISOString(),
      archivedAt: null,
      hasPersonalData: true,
      hasExportPayload: false,
      legalHold: legalHoldSignal(`${thread.subject}\n${thread.preview}`),
      objectType: thread.linkedCrmAccountId ? "crm_account" : thread.salesOrderId ? "sales_order" : "assistant_email_thread",
      objectId: thread.linkedCrmAccountId ?? thread.salesOrderId ?? thread.id,
    })),
  ];
  return { records, retentionDays: 90 };
}

async function buildSnapshot(tenantId: string) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantGovernancePacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        governanceScore: true,
        retentionCandidateCount: true,
        exportRecordCount: true,
        deletionRequestCount: true,
        legalHoldBlockCount: true,
        privacyRiskCount: true,
        sourceSummaryJson: true,
        retentionPlanJson: true,
        exportManifestJson: true,
        deletionRequestJson: true,
        legalHoldJson: true,
        privacyReviewJson: true,
        auditPlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        updatedAt: true,
      },
    }),
    loadGovernanceInputs(tenantId),
  ]);
  const preview = buildGovernancePacket(inputs);
  return {
    signals: {
      records: inputs.records.length,
      previewGovernanceScore: preview.governanceScore,
      retentionCandidates: preview.retentionCandidateCount,
      privacyRisks: preview.privacyRiskCount,
      legalHoldBlocks: preview.legalHoldBlockCount,
    },
    preview,
    packets: packets.map((packet) => ({
      ...packet,
      approvedAt: packet.approvedAt?.toISOString() ?? null,
      updatedAt: packet.updatedAt.toISOString(),
    })),
  };
}

export async function GET() {
  const gate = await requireGovernanceAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id));
}

export async function POST(request: Request) {
  const gate = await requireGovernanceAccess(true);
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

  if (action === "queue_governance_review") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const approvalNote = typeof body.approvalNote === "string" ? body.approvalNote.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantGovernancePacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Governance packet not found.", code: "NOT_FOUND", status: 404 });
    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_governance",
        prompt: "Queue assistant governance review",
        answerKind: "assistant_governance_review",
        message: "Assistant governance packet queued for human review. Audit events, evidence, prompts, examples, email threads, reports, source records, exports, and deletions were not mutated automatically.",
        evidence: { packetId: packet.id, governanceScore: packet.governanceScore, approvalNote } as Prisma.InputJsonObject,
        objectType: "assistant_governance_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_governance_packet",
        objectId: packet.id,
        objectHref: "/assistant/governance",
        priority: packet.legalHoldBlockCount > 0 || packet.privacyRiskCount > 5 ? "HIGH" : "MEDIUM",
        actionId: `amp29-governance-${packet.id}`.slice(0, 128),
        actionKind: "assistant_governance_review",
        label: `Review governance packet: ${packet.title}`,
        description: "Approve retention, export, deletion, and legal-hold handling before any source-system changes.",
        payload: { packetId: packet.id, governanceScore: packet.governanceScore, approvalNote } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    const updated = await prisma.assistantGovernancePacket.update({
      where: { id: packet.id },
      data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id, approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote },
      select: { id: true, status: true, actionQueueItemId: true },
    });
    return NextResponse.json({ ok: true, packet: updated, snapshot: await buildSnapshot(gate.access.tenant.id) });
  }

  if (action !== "create_packet") {
    return toApiErrorResponse({ error: "Unsupported governance action.", code: "BAD_INPUT", status: 400 });
  }

  const inputs = await loadGovernanceInputs(gate.access.tenant.id);
  const built = buildGovernancePacket(inputs);
  const packet = await prisma.assistantGovernancePacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      governanceScore: built.governanceScore,
      retentionCandidateCount: built.retentionCandidateCount,
      exportRecordCount: built.exportRecordCount,
      deletionRequestCount: built.deletionRequestCount,
      legalHoldBlockCount: built.legalHoldBlockCount,
      privacyRiskCount: built.privacyRiskCount,
      sourceSummaryJson: built.sourceSummary as Prisma.InputJsonValue,
      retentionPlanJson: built.retentionPlan as Prisma.InputJsonValue,
      exportManifestJson: built.exportManifest as Prisma.InputJsonValue,
      deletionRequestJson: built.deletionRequests as Prisma.InputJsonValue,
      legalHoldJson: built.legalHoldReview as Prisma.InputJsonValue,
      privacyReviewJson: built.privacyReview as Prisma.InputJsonValue,
      auditPlanJson: built.auditPlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, governanceScore: true, status: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_governance",
      prompt: "Create assistant governance packet",
      answerKind: "assistant_governance_packet",
      message: built.leadershipSummary,
      evidence: { sourceSummary: built.sourceSummary, retentionPlan: built.retentionPlan, exportManifest: built.exportManifest } as Prisma.InputJsonObject,
      objectType: "assistant_governance_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id) }, { status: 201 });
}
