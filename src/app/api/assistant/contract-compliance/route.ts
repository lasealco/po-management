import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  buildContractCompliancePacket,
  type ContractDocumentSignal,
  type RfqCommitmentSignal,
  type TariffContractSignal,
} from "@/lib/assistant/contract-compliance";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireContractComplianceAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  }
  const canSupplier = viewerHas(access.grantSet, "org.suppliers", edit ? "edit" : "view");
  const canCommercial = viewerHas(access.grantSet, "org.rfq", edit ? "edit" : "view") || viewerHas(access.grantSet, "org.tariffs", edit ? "edit" : "view");
  if (!canSupplier && !canCommercial) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires supplier, RFQ, or tariff contract/compliance access.",
        code: "FORBIDDEN",
        status: 403,
      }),
    };
  }
  return { ok: true as const, access };
}

async function loadContractInputs(tenantId: string, grantSet: Set<string>) {
  const [documents, tariffs, rfqs, procurementPlans] = await Promise.all([
    viewerHas(grantSet, "org.suppliers", "view")
      ? prisma.srmSupplierDocument.findMany({
          where: { tenantId },
          orderBy: [{ expiresAt: "asc" }, { updatedAt: "desc" }],
          take: 120,
          select: {
            id: true,
            supplierId: true,
            documentType: true,
            title: true,
            fileName: true,
            status: true,
            expiresAt: true,
            updatedAt: true,
            supplier: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.tariffs", "view")
      ? prisma.tariffContractHeader.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 80,
          include: {
            provider: { select: { legalName: true, tradingName: true } },
            versions: {
              orderBy: { versionNo: "desc" },
              take: 1,
              select: {
                id: true,
                validFrom: true,
                validTo: true,
                _count: { select: { rateLines: true, chargeLines: true, freeTimeRules: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.rfq", "view")
      ? prisma.quoteRequest.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 80,
          select: {
            id: true,
            title: true,
            status: true,
            transportMode: true,
            quotesDueAt: true,
            responses: { select: { status: true, validityTo: true } },
          },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.rfq", "view")
      ? prisma.transportationProcurementPlan.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 80,
          select: { quoteRequestId: true, recommendedCarrier: true, allocationScore: true },
        })
      : Promise.resolve([]),
  ]);

  const procurementByRfq = new Map(procurementPlans.map((plan) => [plan.quoteRequestId, plan]));
  const documentSignals: ContractDocumentSignal[] = documents.map((doc) => ({
    id: doc.id,
    supplierId: doc.supplierId,
    supplierLabel: doc.supplier.name,
    documentType: String(doc.documentType),
    title: doc.title ?? doc.fileName,
    status: String(doc.status),
    expiresAt: doc.expiresAt?.toISOString() ?? null,
    updatedAt: doc.updatedAt.toISOString(),
  }));
  const tariffSignals: TariffContractSignal[] = tariffs.map((tariff) => {
    const version = tariff.versions[0];
    return {
      id: tariff.id,
      title: tariff.title,
      providerLabel: tariff.provider.tradingName ?? tariff.provider.legalName,
      contractNumber: tariff.contractNumber,
      status: String(tariff.status),
      transportMode: String(tariff.transportMode),
      validFrom: version?.validFrom?.toISOString() ?? null,
      validTo: version?.validTo?.toISOString() ?? null,
      tradeScope: tariff.tradeScope,
      rateLineCount: version?._count.rateLines ?? 0,
      chargeLineCount: version?._count.chargeLines ?? 0,
      freeTimeRuleCount: version?._count.freeTimeRules ?? 0,
    };
  });
  const rfqSignals: RfqCommitmentSignal[] = rfqs.map((rfq) => {
    const plan = procurementByRfq.get(rfq.id);
    const submitted = rfq.responses.filter((response) => String(response.status) === "SUBMITTED" || String(response.status) === "REVIEWED");
    const validityTimes = rfq.responses.map((response) => response.validityTo?.getTime() ?? 0).filter((value) => value > 0);
    return {
      id: rfq.id,
      title: rfq.title,
      status: String(rfq.status),
      transportMode: String(rfq.transportMode),
      quotesDueAt: rfq.quotesDueAt?.toISOString() ?? null,
      responseCount: rfq.responses.length,
      submittedResponseCount: submitted.length,
      validityTo: validityTimes.length ? new Date(Math.min(...validityTimes)).toISOString() : null,
      recommendedCarrier: plan?.recommendedCarrier ?? null,
    };
  });
  return { documents: documentSignals, tariffContracts: tariffSignals, rfqCommitments: rfqSignals };
}

async function buildSnapshot(tenantId: string, grantSet: Set<string>) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantContractCompliancePacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        complianceScore: true,
        obligationCount: true,
        expiringDocumentCount: true,
        renewalRiskCount: true,
        complianceGapCount: true,
        sourceSummaryJson: true,
        obligationJson: true,
        renewalRiskJson: true,
        documentRiskJson: true,
        complianceGapJson: true,
        actionPlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        updatedAt: true,
      },
    }),
    loadContractInputs(tenantId, grantSet),
  ]);
  const preview = buildContractCompliancePacket(inputs);
  return {
    signals: {
      supplierDocuments: inputs.documents.length,
      tariffContracts: inputs.tariffContracts.length,
      rfqCommitments: inputs.rfqCommitments.length,
      previewComplianceScore: preview.complianceScore,
      previewRiskItems: preview.expiringDocumentCount + preview.renewalRiskCount + preview.complianceGapCount,
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
  const gate = await requireContractComplianceAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id, gate.access.grantSet));
}

export async function POST(request: Request) {
  const gate = await requireContractComplianceAccess(true);
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

  if (action === "queue_compliance_review") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const approvalNote = typeof body.approvalNote === "string" ? body.approvalNote.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantContractCompliancePacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Contract compliance packet not found.", code: "NOT_FOUND", status: 404 });
    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_contract_compliance",
        prompt: "Queue contract compliance review",
        answerKind: "contract_compliance_review",
        message: "Contract compliance packet queued for human review. Source documents, tariffs, RFQs, bookings, and messages were not mutated.",
        evidence: { packetId: packet.id, complianceScore: packet.complianceScore, approvalNote } as Prisma.InputJsonObject,
        objectType: "assistant_contract_compliance_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_contract_compliance_packet",
        objectId: packet.id,
        objectHref: "/assistant/contract-compliance",
        priority: packet.complianceScore < 65 ? "HIGH" : "MEDIUM",
        actionId: `amp23-contract-${packet.id}`.slice(0, 128),
        actionKind: "contract_compliance_review",
        label: `Review contract compliance: ${packet.title}`,
        description: "Approve obligation, renewal, and document compliance work before changing source contract records.",
        payload: { packetId: packet.id, complianceScore: packet.complianceScore, approvalNote } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    const updated = await prisma.assistantContractCompliancePacket.update({
      where: { id: packet.id },
      data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id, approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote },
      select: { id: true, status: true, actionQueueItemId: true },
    });
    return NextResponse.json({ ok: true, packet: updated, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
  }

  if (action !== "create_packet") {
    return toApiErrorResponse({ error: "Unsupported contract compliance action.", code: "BAD_INPUT", status: 400 });
  }

  const inputs = await loadContractInputs(gate.access.tenant.id, gate.access.grantSet);
  const built = buildContractCompliancePacket(inputs);
  const packet = await prisma.assistantContractCompliancePacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      complianceScore: built.complianceScore,
      obligationCount: built.obligationCount,
      expiringDocumentCount: built.expiringDocumentCount,
      renewalRiskCount: built.renewalRiskCount,
      complianceGapCount: built.complianceGapCount,
      sourceSummaryJson: built.sourceSummary as Prisma.InputJsonValue,
      obligationJson: built.obligations as Prisma.InputJsonValue,
      renewalRiskJson: built.renewalRisks as Prisma.InputJsonValue,
      documentRiskJson: built.documentRisks as Prisma.InputJsonValue,
      complianceGapJson: built.complianceGaps as Prisma.InputJsonValue,
      actionPlanJson: built.actionPlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, complianceScore: true, status: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_contract_compliance",
      prompt: "Create contract compliance packet",
      answerKind: "contract_compliance_packet",
      message: built.leadershipSummary,
      evidence: { complianceScore: built.complianceScore, sourceSummary: built.sourceSummary } as Prisma.InputJsonObject,
      objectType: "assistant_contract_compliance_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) }, { status: 201 });
}
