import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { buildAgentGovernancePacket, type AgentGovernanceInputs } from "@/lib/assistant/agent-governance";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireAgentGovernanceAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  }
  const canSettings = viewerHas(access.grantSet, "org.settings", edit ? "edit" : "view");
  const canReports = viewerHas(access.grantSet, "org.reports", edit ? "edit" : "view");
  if (!canSettings && !canReports) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires settings or reporting access for agent governance.",
        code: "FORBIDDEN",
        status: 403,
      }),
    };
  }
  return { ok: true as const, access };
}

function evidencePresent(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(value);
}

async function loadAgentGovernanceInputs(tenantId: string): Promise<AgentGovernanceInputs> {
  const [prompts, policies, audits, actionQueue, observabilityIncidents] = await Promise.all([
    prisma.assistantPromptLibraryItem.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, title: true, status: true, domain: true, roleScope: true, usageCount: true },
    }),
    prisma.assistantAutomationPolicy.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, actionKind: true, label: true, status: true, readinessScore: true, threshold: true, rollbackPlan: true },
    }),
    prisma.assistantAuditEvent.findMany({
      where: { tenantId, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, surface: true, answerKind: true, evidence: true, quality: true, feedback: true },
    }),
    prisma.assistantActionQueueItem.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 150,
      select: { id: true, actionKind: true, status: true, priority: true },
    }),
    prisma.assistantObservabilityIncident.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, status: true, severity: true, healthScore: true },
    }),
  ]);

  return {
    prompts,
    policies,
    audits: audits.map((audit) => ({
      id: audit.id,
      surface: audit.surface,
      answerKind: audit.answerKind,
      evidencePresent: evidencePresent(audit.evidence),
      qualityPresent: audit.quality != null,
      feedback: audit.feedback,
    })),
    actionQueue,
    observabilityIncidents,
  };
}

export async function buildAgentGovernanceSnapshot(tenantId: string) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantAgentGovernancePacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        governanceScore: true,
        agentCount: true,
        highRiskAgentCount: true,
        toolScopeCount: true,
        promptAssetCount: true,
        memoryPolicyCount: true,
        observabilitySignalCount: true,
        agentRegistryJson: true,
        toolScopeJson: true,
        promptSupplyChainJson: true,
        memoryGovernanceJson: true,
        observabilityJson: true,
        certificationPlanJson: true,
        rollbackPlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        certifiedAt: true,
        certificationNote: true,
        updatedAt: true,
      },
    }),
    loadAgentGovernanceInputs(tenantId),
  ]);
  const preview = buildAgentGovernancePacket(inputs);
  return {
    signals: {
      agents: preview.agentRegistry.agents.length,
      highRiskAgents: preview.agentRegistry.highRiskAgents.length,
      toolScopes: preview.toolScopes.scopes.length,
      promptAssets: preview.promptSupplyChain.promptCount,
      memoryCandidates: preview.memoryGovernance.weakEvidenceCount,
      observabilitySignals: preview.observability.signalCount,
      previewScore: preview.governanceScore,
    },
    preview,
    packets: packets.map((packet) => ({
      ...packet,
      certifiedAt: packet.certifiedAt?.toISOString() ?? null,
      updatedAt: packet.updatedAt.toISOString(),
    })),
  };
}

export async function GET() {
  const gate = await requireAgentGovernanceAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildAgentGovernanceSnapshot(gate.access.tenant.id));
}

export async function POST(request: Request) {
  const gate = await requireAgentGovernanceAccess(true);
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

  if (action === "queue_certification" || action === "certify_packet") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantAgentGovernancePacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Agent governance packet not found.", code: "NOT_FOUND", status: 404 });

    if (action === "certify_packet") {
      await prisma.assistantAgentGovernancePacket.update({
        where: { id: packet.id },
        data: {
          status: "CERTIFIED",
          certifiedByUserId: actorUserId,
          certifiedAt: new Date(),
          certificationNote: note,
        },
      });
      await prisma.assistantAuditEvent.create({
        data: {
          tenantId: gate.access.tenant.id,
          actorUserId,
          surface: "assistant_agent_governance",
          prompt: "Certify agent governance packet",
          answerKind: "agent_governance_certified",
          message: "Agent governance packet marked certified after human review. Agent scopes, tools, prompts, memories, and automation policies were not changed automatically.",
          evidence: { packetId: packet.id, governanceScore: packet.governanceScore, note } as Prisma.InputJsonObject,
          objectType: "assistant_agent_governance_packet",
          objectId: packet.id,
        },
      });
      return NextResponse.json({ ok: true, snapshot: await buildAgentGovernanceSnapshot(gate.access.tenant.id) });
    }

    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_agent_governance",
        prompt: "Queue agent governance certification review",
        answerKind: "agent_governance_review",
        message: "Agent governance certification queued for human review. Agent scopes, tools, prompts, memories, and automation policies were not changed automatically.",
        evidence: { packetId: packet.id, governanceScore: packet.governanceScore, note } as Prisma.InputJsonObject,
        objectType: "assistant_agent_governance_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_agent_governance_packet",
        objectId: packet.id,
        objectHref: "/assistant/agent-governance",
        priority: packet.highRiskAgentCount > 0 || packet.governanceScore < 70 ? "HIGH" : "MEDIUM",
        actionId: `sprint1-agent-governance-${packet.id}`.slice(0, 128),
        actionKind: "assistant_agent_governance_certification",
        label: `Review ${packet.title}`,
        description: "Review agent registry, tool scopes, prompt supply chain, memory policy, observability, and rollback controls before certification.",
        payload: { packetId: packet.id, governanceScore: packet.governanceScore, note } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    await prisma.assistantAgentGovernancePacket.update({
      where: { id: packet.id },
      data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id },
    });
    return NextResponse.json({ ok: true, snapshot: await buildAgentGovernanceSnapshot(gate.access.tenant.id) });
  }

  if (action !== "create_packet") {
    return toApiErrorResponse({ error: "Unsupported agent governance action.", code: "BAD_INPUT", status: 400 });
  }

  const inputs = await loadAgentGovernanceInputs(gate.access.tenant.id);
  const built = buildAgentGovernancePacket(inputs);
  const packet = await prisma.assistantAgentGovernancePacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      governanceScore: built.governanceScore,
      agentCount: built.agentRegistry.agents.length,
      highRiskAgentCount: built.agentRegistry.highRiskAgents.length,
      toolScopeCount: built.toolScopes.scopes.length,
      promptAssetCount: built.promptSupplyChain.promptCount,
      memoryPolicyCount: built.memoryGovernance.policyCount,
      observabilitySignalCount: built.observability.signalCount,
      agentRegistryJson: built.agentRegistry as Prisma.InputJsonValue,
      toolScopeJson: built.toolScopes as Prisma.InputJsonValue,
      promptSupplyChainJson: built.promptSupplyChain as Prisma.InputJsonValue,
      memoryGovernanceJson: built.memoryGovernance as Prisma.InputJsonValue,
      observabilityJson: built.observability as Prisma.InputJsonValue,
      certificationPlanJson: built.certificationPlan as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, status: true, governanceScore: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_agent_governance",
      prompt: "Create Sprint 1 agent governance packet",
      answerKind: "agent_governance_packet",
      message: built.leadershipSummary,
      evidence: {
        governanceScore: built.governanceScore,
        certificationPlan: built.certificationPlan,
        rollbackPlan: built.rollbackPlan,
      } as Prisma.InputJsonObject,
      objectType: "assistant_agent_governance_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildAgentGovernanceSnapshot(gate.access.tenant.id) }, { status: 201 });
}
