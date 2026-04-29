import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  buildEnterpriseKnowledgePacket,
  type EnterpriseKnowledgeInputs,
} from "@/lib/assistant/enterprise-knowledge-document-intelligence";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireEnterpriseKnowledgeAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  const mode = edit ? "edit" : "view";
  const canSettings = viewerHas(access.grantSet, "org.settings", mode);
  const canReports = viewerHas(access.grantSet, "org.reports", mode);
  if (!canSettings && !canReports) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires settings or reporting access for Sprint 25 Enterprise Knowledge.",
        code: "FORBIDDEN",
        status: 403,
      }),
    };
  }
  return { ok: true as const, access };
}

async function loadEnterpriseKnowledgeInputs(tenantId: string): Promise<EnterpriseKnowledgeInputs> {
  const [evidenceRows, promptItems, reviewExamples, releaseGates] = await Promise.all([
    prisma.assistantEvidenceRecord.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 220,
      select: { id: true, label: true, confidence: true, archivedAt: true, sourceType: true },
    }),
    prisma.assistantPromptLibraryItem.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 140,
      select: { id: true, title: true, status: true, usageCount: true },
    }),
    prisma.assistantReviewExample.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 140,
      select: { id: true, status: true, label: true },
    }),
    prisma.assistantReleaseGate.findMany({
      where: { tenantId },
      orderBy: { evaluatedAt: "desc" },
      take: 40,
      select: { id: true, gateKey: true, status: true, score: true, threshold: true },
    }),
  ]);

  return {
    evidenceRows,
    promptItems,
    reviewExamples,
    releaseGates,
  };
}

async function buildSnapshot(tenantId: string) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantEnterpriseKnowledgePacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        knowledgeScore: true,
        evidenceCitationRiskCount: true,
        promptGovernanceRiskCount: true,
        reviewPipelineGapCount: true,
        releaseGateRiskCount: true,
        sourceSummaryJson: true,
        citationEvidenceJson: true,
        promptGovernanceJson: true,
        reviewPipelineJson: true,
        releaseGateJson: true,
        responsePlanJson: true,
        rollbackPlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        approvalNote: true,
        updatedAt: true,
      },
    }),
    loadEnterpriseKnowledgeInputs(tenantId),
  ]);
  const preview = buildEnterpriseKnowledgePacket(inputs);
  return {
    signals: {
      ...preview.sourceSummary,
      previewKnowledgeScore: preview.knowledgeScore,
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
  const gate = await requireEnterpriseKnowledgeAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id));
}

export async function POST(request: Request) {
  const gate = await requireEnterpriseKnowledgeAccess(true);
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

  if (action === "queue_knowledge_governance_review" || action === "approve_packet") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantEnterpriseKnowledgePacket.findFirst({
      where: { id: packetId, tenantId: gate.access.tenant.id },
    });
    if (!packet) return toApiErrorResponse({ error: "Enterprise knowledge packet not found.", code: "NOT_FOUND", status: 404 });

    if (action === "approve_packet") {
      await prisma.assistantEnterpriseKnowledgePacket.update({
        where: { id: packet.id },
        data: { status: "APPROVED", approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote: note },
      });
      await prisma.assistantAuditEvent.create({
        data: {
          tenantId: gate.access.tenant.id,
          actorUserId,
          surface: "assistant_enterprise_knowledge",
          prompt: "Approve Sprint 25 Enterprise Knowledge packet",
          answerKind: "sprint25_ek_ok",
          message:
            "Enterprise knowledge packet approved after human review. Prompt promotions, KB publications, training exports, citation edits, and extraction reliance were not executed automatically.",
          evidence: { packetId: packet.id, knowledgeScore: packet.knowledgeScore, note } as Prisma.InputJsonObject,
          objectType: "assistant_enterprise_knowledge_packet",
          objectId: packet.id,
        },
      });
      return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id) });
    }

    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_enterprise_knowledge",
        prompt: "Queue Sprint 25 enterprise knowledge governance review",
        answerKind: "sprint25_ek_rev",
        message:
          "Enterprise knowledge governance review queued. The assistant does not publish SOPs, promote prompts, overwrite knowledge articles, export training sets, or trust extracted fields automatically.",
        evidence: { packetId: packet.id, knowledgeScore: packet.knowledgeScore, note } as Prisma.InputJsonObject,
        objectType: "assistant_enterprise_knowledge_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_enterprise_knowledge_packet",
        objectId: packet.id,
        objectHref: "/assistant/enterprise-knowledge-document-intelligence",
        priority: packet.knowledgeScore < 72 || packet.releaseGateRiskCount > 0 ? "HIGH" : "MEDIUM",
        actionId: `sprint25-enterprise-knowledge-${packet.id}`.slice(0, 128),
        actionKind: "knowledge_governance_review",
        label: `Review ${packet.title}`,
        description:
          "Review citation ledger posture, prompt drafts, training-review backlog, and release gate risks before knowledge publications.",
        payload: { packetId: packet.id, knowledgeScore: packet.knowledgeScore, note } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    await prisma.assistantEnterpriseKnowledgePacket.update({
      where: { id: packet.id },
      data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id },
    });
    return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id) });
  }

  if (action !== "create_packet") return toApiErrorResponse({ error: "Unsupported Enterprise Knowledge action.", code: "BAD_INPUT", status: 400 });
  const inputs = await loadEnterpriseKnowledgeInputs(gate.access.tenant.id);
  const built = buildEnterpriseKnowledgePacket(inputs);
  const packet = await prisma.assistantEnterpriseKnowledgePacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      knowledgeScore: built.knowledgeScore,
      evidenceCitationRiskCount: built.evidenceCitationRiskCount,
      promptGovernanceRiskCount: built.promptGovernanceRiskCount,
      reviewPipelineGapCount: built.reviewPipelineGapCount,
      releaseGateRiskCount: built.releaseGateRiskCount,
      sourceSummaryJson: built.sourceSummary as Prisma.InputJsonValue,
      citationEvidenceJson: built.citationEvidenceJson as Prisma.InputJsonValue,
      promptGovernanceJson: built.promptGovernanceJson as Prisma.InputJsonValue,
      reviewPipelineJson: built.reviewPipelineJson as Prisma.InputJsonValue,
      releaseGateJson: built.releaseGateJson as Prisma.InputJsonValue,
      responsePlanJson: built.responsePlan as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, status: true, knowledgeScore: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_enterprise_knowledge",
      prompt: "Create Sprint 25 Enterprise Knowledge packet",
      answerKind: "sprint25_ek_pkt",
      message: built.leadershipSummary,
      evidence:
        {
          knowledgeScore: built.knowledgeScore,
          sourceSummary: built.sourceSummary,
          responsePlan: built.responsePlan,
          rollbackPlan: built.rollbackPlan,
        } as Prisma.InputJsonObject,
      objectType: "assistant_enterprise_knowledge_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id) }, { status: 201 });
}
