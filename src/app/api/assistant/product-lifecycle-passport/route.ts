import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { buildProductLifecyclePacket, type ProductLifecycleInputs } from "@/lib/assistant/product-lifecycle-passport";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireProductLifecycleAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  const mode = edit ? "edit" : "view";
  const canOpen =
    viewerHas(access.grantSet, "org.products", mode) ||
    viewerHas(access.grantSet, "org.suppliers", mode) ||
    viewerHas(access.grantSet, "org.reports", mode) ||
    viewerHas(access.grantSet, "org.wms", mode) ||
    viewerHas(access.grantSet, "org.orders", mode);
  if (!canOpen) {
    return {
      ok: false as const,
      response: toApiErrorResponse({ error: "Forbidden: requires products, suppliers, reports, WMS, or orders access for Product Lifecycle Passport.", code: "FORBIDDEN", status: 403 }),
    };
  }
  return { ok: true as const, access };
}

async function loadProductLifecycleInputs(tenantId: string, grantSet: Set<string>): Promise<ProductLifecycleInputs> {
  const canProducts = viewerHas(grantSet, "org.products", "view") || viewerHas(grantSet, "org.reports", "view");
  const canSuppliers = viewerHas(grantSet, "org.suppliers", "view") || viewerHas(grantSet, "org.reports", "view");
  const [products, supplierDocuments, supplierTasks, sustainabilityPackets, contractCompliancePackets, riskSignals, actionQueue] = await Promise.all([
    canProducts
      ? prisma.product.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 240,
          select: {
            id: true,
            sku: true,
            productCode: true,
            name: true,
            hsCode: true,
            ean: true,
            isActive: true,
            isDangerousGoods: true,
            dangerousGoodsClass: true,
            unNumber: true,
            properShippingName: true,
            msdsUrl: true,
            isTemperatureControlled: true,
            temperatureRangeText: true,
            coolingType: true,
            category: { select: { name: true } },
            division: { select: { name: true } },
            documents: { select: { kind: true } },
            _count: { select: { productSuppliers: true, inventoryBalances: true, wmsTasks: { where: { status: { not: "DONE" } } }, salesOrderLines: true, orderItems: true, outboundOrderLines: true } },
          },
        })
      : Promise.resolve([]),
    canSuppliers
      ? prisma.srmSupplierDocument.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 180,
          select: { id: true, supplierId: true, documentType: true, status: true, title: true, fileName: true, expiresAt: true, supplier: { select: { name: true } } },
        })
      : Promise.resolve([]),
    canSuppliers
      ? prisma.supplierOnboardingTask.findMany({
          where: { tenantId },
          orderBy: [{ done: "asc" }, { dueAt: "asc" }],
          take: 180,
          select: { id: true, supplierId: true, title: true, done: true, dueAt: true, supplier: { select: { name: true } } },
        })
      : Promise.resolve([]),
    prisma.assistantSustainabilityPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: { id: true, title: true, status: true, sustainabilityScore: true, missingDataCount: true, recommendationCount: true },
    }),
    prisma.assistantContractCompliancePacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: { id: true, title: true, status: true, complianceScore: true, expiringDocumentCount: true, complianceGapCount: true, renewalRiskCount: true },
    }),
    prisma.scriExternalEvent.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 120,
      select: {
        id: true,
        title: true,
        eventType: true,
        severity: true,
        confidence: true,
        reviewState: true,
        affectedEntities: {
          where: { objectType: { in: ["PRODUCT", "SUPPLIER"] } },
          take: 3,
          select: { objectType: true, objectId: true },
        },
      },
    }),
    prisma.assistantActionQueueItem.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { id: true, actionKind: true, status: true, priority: true, objectType: true },
    }),
  ]);

  return {
    products: products.map((product) => ({
      id: product.id,
      sku: product.sku,
      productCode: product.productCode,
      name: product.name,
      categoryName: product.category?.name ?? null,
      divisionName: product.division?.name ?? null,
      hsCode: product.hsCode,
      ean: product.ean,
      isActive: product.isActive,
      isDangerousGoods: product.isDangerousGoods,
      hasDangerousGoodsEvidence: Boolean(product.dangerousGoodsClass || product.unNumber || product.properShippingName || product.msdsUrl || product.documents.some((doc) => String(doc.kind) === "MSDS")),
      msdsUrl: product.msdsUrl,
      isTemperatureControlled: product.isTemperatureControlled,
      hasTemperatureEvidence: Boolean(product.temperatureRangeText || product.coolingType),
      supplierCount: product._count.productSuppliers,
      documentKinds: product.documents.map((doc) => String(doc.kind)),
      inventoryBalanceCount: product._count.inventoryBalances,
      openWmsTaskCount: product._count.wmsTasks,
      salesOrderLineCount: product._count.salesOrderLines,
      purchaseOrderLineCount: product._count.orderItems,
      outboundOrderLineCount: product._count.outboundOrderLines,
    })),
    supplierDocuments: supplierDocuments.map((doc) => ({
      id: doc.id,
      supplierId: doc.supplierId,
      supplierName: doc.supplier.name,
      documentType: String(doc.documentType),
      status: String(doc.status),
      title: doc.title ?? doc.fileName,
      expiresAt: doc.expiresAt?.toISOString() ?? null,
    })),
    supplierTasks: supplierTasks.map((task) => ({ id: task.id, supplierId: task.supplierId, supplierName: task.supplier.name, title: task.title, done: task.done, dueAt: task.dueAt?.toISOString() ?? null })),
    sustainabilityPackets,
    contractCompliancePackets,
    riskSignals: riskSignals.map((event) => ({
      id: event.id,
      title: event.title,
      eventType: event.eventType,
      severity: String(event.severity),
      confidence: event.confidence,
      reviewState: String(event.reviewState),
      affectedObjectType: event.affectedEntities[0]?.objectType ?? null,
      affectedObjectId: event.affectedEntities[0]?.objectId ?? null,
    })),
    actionQueue,
  };
}

async function buildSnapshot(tenantId: string, grantSet: Set<string>) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantProductLifecyclePacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        lifecycleScore: true,
        productCount: true,
        passportGapCount: true,
        documentRiskCount: true,
        supplierComplianceGapCount: true,
        sustainabilityGapCount: true,
        lifecycleActionCount: true,
        sourceSummaryJson: true,
        catalogReadinessJson: true,
        passportEvidenceJson: true,
        supplierComplianceJson: true,
        sustainabilityPassportJson: true,
        lifecycleRiskJson: true,
        releaseChecklistJson: true,
        responsePlanJson: true,
        rollbackPlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        approvalNote: true,
        updatedAt: true,
      },
    }),
    loadProductLifecycleInputs(tenantId, grantSet),
  ]);
  const preview = buildProductLifecyclePacket(inputs);
  return {
    signals: { ...preview.sourceSummary, previewLifecycleScore: preview.lifecycleScore },
    preview,
    packets: packets.map((packet) => ({ ...packet, approvedAt: packet.approvedAt?.toISOString() ?? null, updatedAt: packet.updatedAt.toISOString() })),
  };
}

export async function GET() {
  const gate = await requireProductLifecycleAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id, gate.access.grantSet));
}

export async function POST(request: Request) {
  const gate = await requireProductLifecycleAccess(true);
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

  if (action === "queue_passport_review" || action === "approve_packet") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantProductLifecyclePacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Product lifecycle packet not found.", code: "NOT_FOUND", status: 404 });

    if (action === "approve_packet") {
      await prisma.assistantProductLifecyclePacket.update({ where: { id: packet.id }, data: { status: "APPROVED", approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote: note } });
      await prisma.assistantAuditEvent.create({
        data: {
          tenantId: gate.access.tenant.id,
          actorUserId,
          surface: "assistant_product_lifecycle_passport",
          prompt: "Approve Sprint 13 Product Lifecycle Passport packet",
          answerKind: "product_lifecycle_passport_approved",
          message: "Product Lifecycle & Compliance Passport packet approved after human review. Product records, supplier compliance records, documents, labels, public passports, ESG claims, recalls, and customer communications were not changed automatically.",
          evidence: { packetId: packet.id, lifecycleScore: packet.lifecycleScore, note } as Prisma.InputJsonObject,
          objectType: "assistant_product_lifecycle_packet",
          objectId: packet.id,
        },
      });
      return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
    }

    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_product_lifecycle_passport",
        prompt: "Queue Sprint 13 product passport review",
        answerKind: "product_lifecycle_passport_review",
        message: "Product passport review queued. The assistant does not activate products, publish passports, change supplier documents, send certificates, make ESG claims, launch recalls, or update customer communications.",
        evidence: { packetId: packet.id, lifecycleScore: packet.lifecycleScore, note } as Prisma.InputJsonObject,
        objectType: "assistant_product_lifecycle_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_product_lifecycle_packet",
        objectId: packet.id,
        objectHref: "/assistant/product-lifecycle-passport",
        priority: packet.lifecycleScore < 75 || packet.passportGapCount > 0 || packet.supplierComplianceGapCount > 0 ? "HIGH" : "MEDIUM",
        actionId: `sprint13-product-passport-${packet.id}`.slice(0, 128),
        actionKind: "product_lifecycle_passport_review",
        label: `Review ${packet.title}`,
        description: "Review catalog readiness, passport evidence, supplier compliance, sustainability assumptions, lifecycle risks, and release checklist before product lifecycle action.",
        payload: { packetId: packet.id, lifecycleScore: packet.lifecycleScore, note } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    await prisma.assistantProductLifecyclePacket.update({ where: { id: packet.id }, data: { status: "PASSPORT_REVIEW_QUEUED", actionQueueItemId: queue.id } });
    return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
  }

  if (action !== "create_packet") return toApiErrorResponse({ error: "Unsupported Product Lifecycle Passport action.", code: "BAD_INPUT", status: 400 });
  const inputs = await loadProductLifecycleInputs(gate.access.tenant.id, gate.access.grantSet);
  const built = buildProductLifecyclePacket(inputs);
  const packet = await prisma.assistantProductLifecyclePacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      lifecycleScore: built.lifecycleScore,
      productCount: built.productCount,
      passportGapCount: built.passportGapCount,
      documentRiskCount: built.documentRiskCount,
      supplierComplianceGapCount: built.supplierComplianceGapCount,
      sustainabilityGapCount: built.sustainabilityGapCount,
      lifecycleActionCount: built.lifecycleActionCount,
      sourceSummaryJson: built.sourceSummary as Prisma.InputJsonValue,
      catalogReadinessJson: built.catalogReadiness as Prisma.InputJsonValue,
      passportEvidenceJson: built.passportEvidence as Prisma.InputJsonValue,
      supplierComplianceJson: built.supplierCompliance as Prisma.InputJsonValue,
      sustainabilityPassportJson: built.sustainabilityPassport as Prisma.InputJsonValue,
      lifecycleRiskJson: built.lifecycleRisk as Prisma.InputJsonValue,
      releaseChecklistJson: built.releaseChecklist as Prisma.InputJsonValue,
      responsePlanJson: built.responsePlan as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, status: true, lifecycleScore: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_product_lifecycle_passport",
      prompt: "Create Sprint 13 Product Lifecycle Passport packet",
      answerKind: "product_lifecycle_passport_packet",
      message: built.leadershipSummary,
      evidence: { lifecycleScore: built.lifecycleScore, sourceSummary: built.sourceSummary, responsePlan: built.responsePlan, rollbackPlan: built.rollbackPlan } as Prisma.InputJsonObject,
      objectType: "assistant_product_lifecycle_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) }, { status: 201 });
}
