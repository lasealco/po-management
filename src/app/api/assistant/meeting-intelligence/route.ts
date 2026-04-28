import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { buildMeetingIntelligencePacket, type MeetingTranscriptSignal } from "@/lib/assistant/meeting-intelligence";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireMeetingIntelligenceAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  }
  const canCrm = viewerHas(access.grantSet, "org.crm", edit ? "edit" : "view");
  const canCt = viewerHas(access.grantSet, "org.controltower", edit ? "edit" : "view");
  const canSuppliers = viewerHas(access.grantSet, "org.suppliers", edit ? "edit" : "view");
  if (!canCrm && !canCt && !canSuppliers) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires CRM, Control Tower, or supplier meeting intelligence access.",
        code: "FORBIDDEN",
        status: 403,
      }),
    };
  }
  return { ok: true as const, access };
}

async function loadMeetingInputs(tenantId: string, grantSet: Set<string>) {
  const [emailThreads, crmActivities, shipmentNotes, exceptions, supplierTasks] = await Promise.all([
    viewerHas(grantSet, "org.crm", "view")
      ? prisma.assistantEmailThread.findMany({
          where: { tenantId },
          orderBy: { receivedAt: "desc" },
          take: 30,
          select: { id: true, subject: true, fromAddress: true, bodyText: true, receivedAt: true, linkedCrmAccountId: true },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.crm", "view")
      ? prisma.crmActivity.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 40,
          select: { id: true, subject: true, body: true, type: true, startTime: true, updatedAt: true, relatedAccountId: true },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.controltower", "view")
      ? prisma.ctShipmentNote.findMany({
          where: { tenantId },
          orderBy: { createdAt: "desc" },
          take: 40,
          select: { id: true, shipmentId: true, body: true, visibility: true, createdAt: true, shipment: { select: { shipmentNo: true } } },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.controltower", "view")
      ? prisma.ctException.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 40,
          select: { id: true, shipmentId: true, type: true, customerImpact: true, recoveryPlan: true, status: true, updatedAt: true, shipment: { select: { shipmentNo: true } } },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.suppliers", "view")
      ? prisma.supplierOnboardingTask.findMany({
          where: { tenantId, done: false },
          orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
          take: 40,
          select: { id: true, title: true, notes: true, updatedAt: true, supplierId: true, supplier: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const transcripts: MeetingTranscriptSignal[] = [
    ...emailThreads.map((thread) => ({
      id: thread.id,
      sourceType: "EMAIL_THREAD" as const,
      title: thread.subject,
      body: thread.bodyText,
      speakerLabel: thread.fromAddress,
      occurredAt: thread.receivedAt.toISOString(),
      objectType: thread.linkedCrmAccountId ? "crm_account" : "assistant_email_thread",
      objectId: thread.linkedCrmAccountId ?? thread.id,
      objectHref: thread.linkedCrmAccountId ? `/crm/accounts/${thread.linkedCrmAccountId}` : `/assistant/inbox`,
    })),
    ...crmActivities.map((activity) => ({
      id: activity.id,
      sourceType: "CRM_ACTIVITY" as const,
      title: activity.subject,
      body: activity.body ?? activity.subject,
      speakerLabel: String(activity.type),
      occurredAt: (activity.startTime ?? activity.updatedAt).toISOString(),
      objectType: activity.relatedAccountId ? "crm_account" : "crm_activity",
      objectId: activity.relatedAccountId ?? activity.id,
      objectHref: activity.relatedAccountId ? `/crm/accounts/${activity.relatedAccountId}` : "/crm",
    })),
    ...shipmentNotes.map((note) => ({
      id: note.id,
      sourceType: "SHIPMENT_NOTE" as const,
      title: `Shipment note ${note.shipment.shipmentNo ?? note.shipmentId}`,
      body: note.body,
      speakerLabel: String(note.visibility),
      occurredAt: note.createdAt.toISOString(),
      objectType: "shipment",
      objectId: note.shipmentId,
      objectHref: `/control-tower/shipments/${note.shipmentId}`,
    })),
    ...exceptions.map((exception) => ({
      id: exception.id,
      sourceType: "CT_EXCEPTION" as const,
      title: `${exception.type} ${exception.shipment.shipmentNo ?? exception.shipmentId}`,
      body: [exception.customerImpact, exception.recoveryPlan, `Status ${exception.status}`].filter(Boolean).join("\n"),
      speakerLabel: "Control Tower",
      occurredAt: exception.updatedAt.toISOString(),
      objectType: "shipment",
      objectId: exception.shipmentId,
      objectHref: `/control-tower/shipments/${exception.shipmentId}`,
    })),
    ...supplierTasks.map((task) => ({
      id: task.id,
      sourceType: "SUPPLIER_TASK" as const,
      title: `${task.supplier.name}: ${task.title}`,
      body: task.notes ?? task.title,
      speakerLabel: "SRM",
      occurredAt: task.updatedAt.toISOString(),
      objectType: "supplier",
      objectId: task.supplierId,
      objectHref: `/suppliers/${task.supplierId}`,
    })),
  ];
  return { transcripts };
}

async function buildSnapshot(tenantId: string, grantSet: Set<string>) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantMeetingIntelligencePacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        meetingScore: true,
        transcriptCount: true,
        extractedActionCount: true,
        riskCount: true,
        decisionCount: true,
        redactionCount: true,
        sourceSummaryJson: true,
        transcriptDigestJson: true,
        extractedActionJson: true,
        riskJson: true,
        decisionJson: true,
        objectLinkJson: true,
        redactionJson: true,
        minutesJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        updatedAt: true,
      },
    }),
    loadMeetingInputs(tenantId, grantSet),
  ]);
  const preview = buildMeetingIntelligencePacket(inputs);
  return {
    signals: {
      transcripts: inputs.transcripts.length,
      previewMeetingScore: preview.meetingScore,
      previewActions: preview.extractedActionCount,
      previewRisks: preview.riskCount,
      previewRedactions: preview.redactionCount,
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
  const gate = await requireMeetingIntelligenceAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id, gate.access.grantSet));
}

export async function POST(request: Request) {
  const gate = await requireMeetingIntelligenceAccess(true);
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

  if (action === "queue_meeting_review") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const approvalNote = typeof body.approvalNote === "string" ? body.approvalNote.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantMeetingIntelligencePacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Meeting intelligence packet not found.", code: "NOT_FOUND", status: 404 });
    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_meeting_intelligence",
        prompt: "Queue meeting intelligence review",
        answerKind: "meeting_intelligence_review",
        message: "Meeting intelligence packet queued for human review. CRM activities, shipment notes, supplier tasks, email replies, and action queue tasks were not created or mutated automatically.",
        evidence: { packetId: packet.id, meetingScore: packet.meetingScore, approvalNote } as Prisma.InputJsonObject,
        objectType: "assistant_meeting_intelligence_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_meeting_intelligence_packet",
        objectId: packet.id,
        objectHref: "/assistant/meeting-intelligence",
        priority: packet.riskCount > 3 || packet.meetingScore < 65 ? "HIGH" : "MEDIUM",
        actionId: `amp27-meeting-${packet.id}`.slice(0, 128),
        actionKind: "meeting_intelligence_review",
        label: `Review meeting actions: ${packet.title}`,
        description: "Approve extracted actions, risks, decisions, minutes, and follow-ups before source-system changes.",
        payload: { packetId: packet.id, meetingScore: packet.meetingScore, approvalNote } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    const updated = await prisma.assistantMeetingIntelligencePacket.update({
      where: { id: packet.id },
      data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id, approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote },
      select: { id: true, status: true, actionQueueItemId: true },
    });
    return NextResponse.json({ ok: true, packet: updated, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
  }

  if (action !== "create_packet") {
    return toApiErrorResponse({ error: "Unsupported meeting intelligence action.", code: "BAD_INPUT", status: 400 });
  }

  const inputs = await loadMeetingInputs(gate.access.tenant.id, gate.access.grantSet);
  const built = buildMeetingIntelligencePacket(inputs);
  const packet = await prisma.assistantMeetingIntelligencePacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      meetingScore: built.meetingScore,
      transcriptCount: built.transcriptCount,
      extractedActionCount: built.extractedActionCount,
      riskCount: built.riskCount,
      decisionCount: built.decisionCount,
      redactionCount: built.redactionCount,
      sourceSummaryJson: built.sourceSummary as Prisma.InputJsonValue,
      transcriptDigestJson: built.transcriptDigest as Prisma.InputJsonValue,
      extractedActionJson: built.extractedActions as Prisma.InputJsonValue,
      riskJson: built.risks as Prisma.InputJsonValue,
      decisionJson: built.decisions as Prisma.InputJsonValue,
      objectLinkJson: built.objectLinks as Prisma.InputJsonValue,
      redactionJson: built.redactions as Prisma.InputJsonValue,
      minutesJson: built.minutes as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, meetingScore: true, status: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_meeting_intelligence",
      prompt: "Create meeting intelligence packet",
      answerKind: "meeting_intelligence_packet",
      message: built.leadershipSummary,
      evidence: { meetingScore: built.meetingScore, sourceSummary: built.sourceSummary, minutes: built.minutes } as Prisma.InputJsonObject,
      objectType: "assistant_meeting_intelligence_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) }, { status: 201 });
}
