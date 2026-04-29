import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  buildStrategicSourcingPacket,
  type StrategicSourcingInputs,
} from "@/lib/assistant/strategic-sourcing-category-intelligence";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function numberValue(value: unknown): number {
  if (value == null) return 0;
  const n = Number(typeof value === "object" && value !== null && "toString" in value ? String(value.toString()) : value);
  return Number.isFinite(n) ? n : 0;
}

async function requireStrategicSourcingAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  const mode = edit ? "edit" : "view";
  const canOpen =
    viewerHas(access.grantSet, "org.suppliers", mode) ||
    viewerHas(access.grantSet, "org.rfq", mode) ||
    viewerHas(access.grantSet, "org.tariffs", mode) ||
    viewerHas(access.grantSet, "org.orders", mode) ||
    viewerHas(access.grantSet, "org.reports", mode);
  if (!canOpen) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires suppliers, RFQ, tariffs, orders, or reports access for Sprint 19.",
        code: "FORBIDDEN",
        status: 403,
      }),
    };
  }
  return { ok: true as const, access };
}

async function loadStrategicSourcingInputs(tenantId: string, grantSet: Set<string>): Promise<StrategicSourcingInputs> {
  const canOrders = viewerHas(grantSet, "org.orders", "view") || viewerHas(grantSet, "org.reports", "view");
  const canSuppliers = viewerHas(grantSet, "org.suppliers", "view") || viewerHas(grantSet, "org.reports", "view");
  const canRfq = viewerHas(grantSet, "org.rfq", "view") || viewerHas(grantSet, "org.reports", "view");
  const canTariffs = viewerHas(grantSet, "org.tariffs", "view") || viewerHas(grantSet, "org.reports", "view");
  const canCompliance = viewerHas(grantSet, "org.reports", "view") || viewerHas(grantSet, "org.suppliers", "view");

  const [
    purchaseOrdersRaw,
    suppliersRaw,
    quoteRequestsRaw,
    tariffVersionsRaw,
    onboardingTasksRaw,
    compliancePacketsRaw,
    procurementPacketsRaw,
  ] = await Promise.all([
    canOrders
      ? prisma.purchaseOrder.findMany({
          where: { tenantId, supplierId: { not: null } },
          orderBy: { updatedAt: "desc" },
          take: 480,
          select: { supplierId: true, totalAmount: true },
        })
      : Promise.resolve([]),
    canSuppliers
      ? prisma.supplier.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 320,
          select: { id: true, name: true, srmCategory: true, approvalStatus: true },
        })
      : Promise.resolve([]),
    canRfq
      ? prisma.quoteRequest.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 140,
          select: {
            id: true,
            title: true,
            status: true,
            quotesDueAt: true,
            responses: { select: { status: true } },
          },
        })
      : Promise.resolve([]),
    canTariffs
      ? prisma.tariffContractVersion.findMany({
          where: { contractHeader: { tenantId } },
          orderBy: { updatedAt: "desc" },
          take: 220,
          select: {
            id: true,
            versionNo: true,
            validTo: true,
            approvalStatus: true,
            status: true,
            contractHeader: { select: { title: true } },
          },
        })
      : Promise.resolve([]),
    canSuppliers
      ? prisma.supplierOnboardingTask.findMany({
          where: { tenantId, done: false },
          orderBy: { updatedAt: "desc" },
          take: 120,
          select: {
            id: true,
            supplierId: true,
            title: true,
            supplier: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    canCompliance
      ? prisma.assistantContractCompliancePacket.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 90,
          select: { id: true, renewalRiskCount: true, complianceGapCount: true },
        })
      : Promise.resolve([]),
    canRfq || viewerHas(grantSet, "org.tariffs", "view") || viewerHas(grantSet, "org.reports", "view")
      ? prisma.assistantTransportCarrierProcurementPacket.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 70,
          select: { id: true, tenderRiskCount: true },
        })
      : Promise.resolve([]),
  ]);

  const purchaseOrders = purchaseOrdersRaw.map((row) => ({
    supplierId: row.supplierId,
    totalAmount: numberValue(row.totalAmount),
  }));

  const suppliers = suppliersRaw.map((supplier) => ({
    id: supplier.id,
    name: supplier.name,
    srmCategory: String(supplier.srmCategory),
    approvalStatus: String(supplier.approvalStatus),
  }));

  const quoteRequests = quoteRequestsRaw.map((qr) => ({
    id: qr.id,
    title: qr.title,
    status: String(qr.status),
    quotesDueAt: qr.quotesDueAt,
    responseStatuses: qr.responses.map((response) => String(response.status)),
  }));

  const tariffVersions = tariffVersionsRaw.map((version) => ({
    id: version.id,
    versionNo: version.versionNo,
    validTo: version.validTo,
    approvalStatus: String(version.approvalStatus),
    status: String(version.status),
    contractTitle: version.contractHeader.title,
  }));

  const onboardingTasksOpen = onboardingTasksRaw.map((task) => ({
    id: task.id,
    supplierId: task.supplierId,
    supplierName: task.supplier.name,
    title: task.title,
  }));

  return {
    purchaseOrders,
    suppliers,
    quoteRequests,
    tariffVersions,
    onboardingTasksOpen,
    compliancePackets: compliancePacketsRaw,
    procurementPackets: procurementPacketsRaw,
  };
}

async function buildSnapshot(tenantId: string, grantSet: Set<string>) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantStrategicSourcingPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        sourcingScore: true,
        concentrationRiskCount: true,
        rfqPipelineRiskCount: true,
        tariffCoverageRiskCount: true,
        supplierPanelRiskCount: true,
        compliancePortfolioRiskCount: true,
        savingsPipelineRiskCount: true,
        sourceSummaryJson: true,
        spendCategoryJson: true,
        rfqPipelineJson: true,
        tariffCoverageJson: true,
        supplierPanelJson: true,
        compliancePortfolioJson: true,
        savingsPipelineJson: true,
        responsePlanJson: true,
        rollbackPlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        approvalNote: true,
        updatedAt: true,
      },
    }),
    loadStrategicSourcingInputs(tenantId, grantSet),
  ]);
  const preview = buildStrategicSourcingPacket(inputs);
  return {
    signals: {
      ...preview.sourceSummary,
      previewSourcingScore: preview.sourcingScore,
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
  const gate = await requireStrategicSourcingAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id, gate.access.grantSet));
}

export async function POST(request: Request) {
  const gate = await requireStrategicSourcingAccess(true);
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

  if (action === "queue_sourcing_review" || action === "approve_packet") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantStrategicSourcingPacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Strategic sourcing packet not found.", code: "NOT_FOUND", status: 404 });

    if (action === "approve_packet") {
      await prisma.assistantStrategicSourcingPacket.update({
        where: { id: packet.id },
        data: { status: "APPROVED", approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote: note },
      });
      await prisma.assistantAuditEvent.create({
        data: {
          tenantId: gate.access.tenant.id,
          actorUserId,
          surface: "assistant_strategic_sourcing",
          prompt: "Approve Sprint 19 Strategic Sourcing packet",
          answerKind: "sprint19_ss_ok",
          message:
            "Strategic sourcing packet approved after human review. RFQs, tariff contracts, supplier approvals, sourcing events, awards, and spend commits were not executed automatically.",
          evidence: { packetId: packet.id, sourcingScore: packet.sourcingScore, note } as Prisma.InputJsonObject,
          objectType: "assistant_strategic_sourcing_packet",
          objectId: packet.id,
        },
      });
      return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
    }

    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_strategic_sourcing",
        prompt: "Queue Sprint 19 strategic sourcing category review",
        answerKind: "sprint19_ss_rev",
        message:
          "Strategic sourcing review queued. The assistant does not launch sourcing events, change awards, extend tariff validity, approve suppliers, alter contracts, or reallocate spend automatically.",
        evidence: { packetId: packet.id, sourcingScore: packet.sourcingScore, note } as Prisma.InputJsonObject,
        objectType: "assistant_strategic_sourcing_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_strategic_sourcing_packet",
        objectId: packet.id,
        objectHref: "/assistant/strategic-sourcing-category-intelligence",
        priority: packet.sourcingScore < 72 || packet.supplierPanelRiskCount > 2 ? "HIGH" : "MEDIUM",
        actionId: `sprint19-strategic-sourcing-${packet.id}`.slice(0, 128),
        actionKind: "strategic_sourcing_review",
        label: `Review ${packet.title}`,
        description:
          "Review spend concentration, RFQ pipeline/tariff readiness, supplier onboarding gaps, compliance portfolio cues, and savings backlog before sourcing execution.",
        payload: { packetId: packet.id, sourcingScore: packet.sourcingScore, note } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    await prisma.assistantStrategicSourcingPacket.update({ where: { id: packet.id }, data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id } });
    return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
  }

  if (action !== "create_packet") return toApiErrorResponse({ error: "Unsupported Strategic Sourcing action.", code: "BAD_INPUT", status: 400 });
  const inputs = await loadStrategicSourcingInputs(gate.access.tenant.id, gate.access.grantSet);
  const built = buildStrategicSourcingPacket(inputs);
  const packet = await prisma.assistantStrategicSourcingPacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      sourcingScore: built.sourcingScore,
      concentrationRiskCount: built.concentrationRiskCount,
      rfqPipelineRiskCount: built.rfqPipelineRiskCount,
      tariffCoverageRiskCount: built.tariffCoverageRiskCount,
      supplierPanelRiskCount: built.supplierPanelRiskCount,
      compliancePortfolioRiskCount: built.compliancePortfolioRiskCount,
      savingsPipelineRiskCount: built.savingsPipelineRiskCount,
      sourceSummaryJson: built.sourceSummary as Prisma.InputJsonValue,
      spendCategoryJson: built.spendCategory as Prisma.InputJsonValue,
      rfqPipelineJson: built.rfqPipeline as Prisma.InputJsonValue,
      tariffCoverageJson: built.tariffCoverage as Prisma.InputJsonValue,
      supplierPanelJson: built.supplierPanel as Prisma.InputJsonValue,
      compliancePortfolioJson: built.compliancePortfolio as Prisma.InputJsonValue,
      savingsPipelineJson: built.savingsPipeline as Prisma.InputJsonValue,
      responsePlanJson: built.responsePlan as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, status: true, sourcingScore: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_strategic_sourcing",
      prompt: "Create Sprint 19 Strategic Sourcing packet",
      answerKind: "sprint19_ss_pkt",
      message: built.leadershipSummary,
      evidence:
        {
          sourcingScore: built.sourcingScore,
          sourceSummary: built.sourceSummary,
          responsePlan: built.responsePlan,
          rollbackPlan: built.rollbackPlan,
        } as Prisma.InputJsonObject,
      objectType: "assistant_strategic_sourcing_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) }, { status: 201 });
}
