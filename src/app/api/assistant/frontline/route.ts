import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  buildFrontlinePacket,
  type FrontlineEvidenceSignal,
  type FrontlinePermissionSignal,
  type FrontlineWorkSignal,
} from "@/lib/assistant/frontline";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireFrontlineAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  }
  const canWms = viewerHas(access.grantSet, "org.wms", edit ? "edit" : "view");
  const canCt = viewerHas(access.grantSet, "org.controltower", edit ? "edit" : "view");
  const canSuppliers = viewerHas(access.grantSet, "org.suppliers", edit ? "edit" : "view");
  if (!canWms && !canCt && !canSuppliers) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires WMS, Control Tower, or supplier frontline access.",
        code: "FORBIDDEN",
        status: 403,
      }),
    };
  }
  return { ok: true as const, access };
}

function hoursSince(date: Date) {
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 36_000) / 100);
}

function taskPriority(ageHours: number): FrontlineWorkSignal["priority"] {
  if (ageHours >= 48) return "CRITICAL";
  if (ageHours >= 24) return "HIGH";
  if (ageHours >= 8) return "MEDIUM";
  return "LOW";
}

function exceptionPriority(severity: string): FrontlineWorkSignal["priority"] {
  if (severity === "CRITICAL") return "CRITICAL";
  if (severity === "ERROR") return "HIGH";
  if (severity === "WARN") return "MEDIUM";
  return "LOW";
}

async function loadFrontlineInputs(tenantId: string, grantSet: Set<string>) {
  const [wmsTasks, exceptions, supplierTasks, shipmentDocuments, shipmentNotes, supplierDocuments] = await Promise.all([
    viewerHas(grantSet, "org.wms", "view")
      ? prisma.wmsTask.findMany({
          where: { tenantId, status: { in: ["OPEN"] } },
          orderBy: { updatedAt: "asc" },
          take: 80,
          select: {
            id: true,
            taskType: true,
            status: true,
            note: true,
            shipmentId: true,
            updatedAt: true,
            warehouse: { select: { code: true, name: true } },
            product: { select: { name: true, sku: true } },
          },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.controltower", "view")
      ? prisma.ctException.findMany({
          where: { tenantId, status: "OPEN" },
          orderBy: { updatedAt: "asc" },
          take: 80,
          select: {
            id: true,
            type: true,
            severity: true,
            status: true,
            customerImpact: true,
            shipmentId: true,
            updatedAt: true,
            shipment: { select: { shipmentNo: true } },
          },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.suppliers", "view")
      ? prisma.supplierOnboardingTask.findMany({
          where: { tenantId, done: false },
          orderBy: [{ dueAt: "asc" }, { updatedAt: "asc" }],
          take: 80,
          select: { id: true, title: true, dueAt: true, updatedAt: true, supplier: { select: { name: true } } },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.controltower", "view")
      ? prisma.ctShipmentDocument.findMany({
          where: { tenantId },
          orderBy: { createdAt: "desc" },
          take: 80,
          select: { id: true, shipmentId: true, docType: true, fileName: true, createdAt: true },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.controltower", "view")
      ? prisma.ctShipmentNote.findMany({
          where: { tenantId },
          orderBy: { createdAt: "desc" },
          take: 80,
          select: { id: true, shipmentId: true, body: true, createdAt: true },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.suppliers", "view")
      ? prisma.srmSupplierDocument.findMany({
          where: { tenantId },
          orderBy: { createdAt: "desc" },
          take: 80,
          select: { id: true, supplierId: true, title: true, fileName: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);

  const evidenceKeys = new Set<string>([
    ...shipmentDocuments.map((doc) => doc.shipmentId),
    ...shipmentNotes.map((note) => note.shipmentId),
    ...supplierDocuments.map((doc) => doc.supplierId),
  ]);
  const work: FrontlineWorkSignal[] = [
    ...wmsTasks.map((task) => {
      const ageHours = hoursSince(task.updatedAt);
      return {
        id: task.id,
        sourceType: "WMS_TASK" as const,
        title: `${String(task.taskType)} ${task.product?.sku ?? task.product?.name ?? "task"} at ${task.warehouse.code ?? task.warehouse.name}`,
        status: String(task.status),
        role: "WAREHOUSE" as const,
        priority: taskPriority(ageHours),
        objectHref: task.shipmentId ? `/control-tower/shipments/${task.shipmentId}` : "/wms",
        ageHours,
        hasEvidence: Boolean(task.note),
        requiresNetwork: true,
      };
    }),
    ...exceptions.map((exception) => {
      const ageHours = hoursSince(exception.updatedAt);
      return {
        id: exception.id,
        sourceType: "CT_EXCEPTION" as const,
        title: `${exception.type} on ${exception.shipment.shipmentNo ?? exception.shipmentId}`,
        status: String(exception.status),
        role: "DRIVER" as const,
        priority: exceptionPriority(String(exception.severity)),
        objectHref: `/control-tower/shipments/${exception.shipmentId}`,
        ageHours,
        hasEvidence: evidenceKeys.has(exception.shipmentId),
        requiresNetwork: true,
      };
    }),
    ...supplierTasks.map((task) => {
      const dueAge = task.dueAt ? hoursSince(task.dueAt) : hoursSince(task.updatedAt);
      return {
        id: task.id,
        sourceType: "SUPPLIER_TASK" as const,
        title: `${task.supplier.name}: ${task.title}`,
        status: "OPEN",
        role: "SUPPLIER" as const,
        priority: task.dueAt && task.dueAt.getTime() < Date.now() ? "HIGH" : taskPriority(dueAge),
        objectHref: "/srm/portal",
        ageHours: Math.max(0, dueAge),
        hasEvidence: false,
        requiresNetwork: false,
      };
    }),
  ];
  const evidence: FrontlineEvidenceSignal[] = [
    ...shipmentDocuments.map((doc) => ({
      id: doc.id,
      sourceType: "SHIPMENT_DOCUMENT" as const,
      objectId: doc.shipmentId,
      label: `${doc.docType}: ${doc.fileName}`,
      capturedAt: doc.createdAt.toISOString(),
      mobileFriendly: true,
    })),
    ...shipmentNotes.map((note) => ({
      id: note.id,
      sourceType: "SHIPMENT_NOTE" as const,
      objectId: note.shipmentId,
      label: note.body.slice(0, 80),
      capturedAt: note.createdAt.toISOString(),
      mobileFriendly: true,
    })),
    ...supplierDocuments.map((doc) => ({
      id: doc.id,
      sourceType: "SUPPLIER_DOCUMENT" as const,
      objectId: doc.supplierId,
      label: doc.title ?? doc.fileName,
      capturedAt: doc.createdAt.toISOString(),
      mobileFriendly: true,
    })),
  ];
  const permissions: FrontlinePermissionSignal[] = [
    { role: "WAREHOUSE", canView: viewerHas(grantSet, "org.wms", "view"), canAct: viewerHas(grantSet, "org.wms", "edit") },
    { role: "DRIVER", canView: viewerHas(grantSet, "org.controltower", "view"), canAct: viewerHas(grantSet, "org.controltower", "edit") },
    { role: "SUPPLIER", canView: viewerHas(grantSet, "org.suppliers", "view"), canAct: viewerHas(grantSet, "org.suppliers", "edit") },
    { role: "OPS", canView: viewerHas(grantSet, "org.controltower", "view"), canAct: viewerHas(grantSet, "org.controltower", "edit") },
  ];
  return { work, evidence, permissions };
}

async function buildSnapshot(tenantId: string, grantSet: Set<string>) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantFrontlinePacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        readinessScore: true,
        frontlineTaskCount: true,
        exceptionCount: true,
        quickActionCount: true,
        evidenceGapCount: true,
        offlineRiskCount: true,
        sourceSummaryJson: true,
        frontlineQueueJson: true,
        quickActionJson: true,
        evidenceChecklistJson: true,
        offlineRiskJson: true,
        permissionScopeJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        updatedAt: true,
      },
    }),
    loadFrontlineInputs(tenantId, grantSet),
  ]);
  const preview = buildFrontlinePacket(inputs);
  return {
    signals: {
      workItems: inputs.work.length,
      evidenceItems: inputs.evidence.length,
      actionReadyRoles: preview.permissionScope.roles.filter((role) => role.state === "ACTION_READY").length,
      previewReadinessScore: preview.readinessScore,
      previewEvidenceGaps: preview.evidenceGapCount,
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
  const gate = await requireFrontlineAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id, gate.access.grantSet));
}

export async function POST(request: Request) {
  const gate = await requireFrontlineAccess(true);
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

  if (action === "queue_frontline_review") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const approvalNote = typeof body.approvalNote === "string" ? body.approvalNote.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantFrontlinePacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Frontline packet not found.", code: "NOT_FOUND", status: 404 });
    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_frontline",
        prompt: "Queue frontline quick-action review",
        answerKind: "frontline_review",
        message: "Frontline packet queued for human review. WMS tasks, shipment exceptions, supplier tasks, and evidence records were not mutated automatically.",
        evidence: { packetId: packet.id, readinessScore: packet.readinessScore, approvalNote } as Prisma.InputJsonObject,
        objectType: "assistant_frontline_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_frontline_packet",
        objectId: packet.id,
        objectHref: "/assistant/frontline",
        priority: packet.readinessScore < 65 || packet.evidenceGapCount > 4 ? "HIGH" : "MEDIUM",
        actionId: `amp26-frontline-${packet.id}`.slice(0, 128),
        actionKind: "frontline_quick_action_review",
        label: `Review frontline actions: ${packet.title}`,
        description: "Approve mobile quick actions, evidence capture, and offline reconciliation before source-system updates.",
        payload: { packetId: packet.id, readinessScore: packet.readinessScore, approvalNote } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    const updated = await prisma.assistantFrontlinePacket.update({
      where: { id: packet.id },
      data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id, approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote },
      select: { id: true, status: true, actionQueueItemId: true },
    });
    return NextResponse.json({ ok: true, packet: updated, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
  }

  if (action !== "create_packet") {
    return toApiErrorResponse({ error: "Unsupported frontline action.", code: "BAD_INPUT", status: 400 });
  }

  const inputs = await loadFrontlineInputs(gate.access.tenant.id, gate.access.grantSet);
  const built = buildFrontlinePacket(inputs);
  const packet = await prisma.assistantFrontlinePacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      readinessScore: built.readinessScore,
      frontlineTaskCount: built.frontlineTaskCount,
      exceptionCount: built.exceptionCount,
      quickActionCount: built.quickActionCount,
      evidenceGapCount: built.evidenceGapCount,
      offlineRiskCount: built.offlineRiskCount,
      sourceSummaryJson: built.sourceSummary as Prisma.InputJsonValue,
      frontlineQueueJson: built.frontlineQueue as Prisma.InputJsonValue,
      quickActionJson: built.quickActions as Prisma.InputJsonValue,
      evidenceChecklistJson: built.evidenceChecklist as Prisma.InputJsonValue,
      offlineRiskJson: built.offlineRisks as Prisma.InputJsonValue,
      permissionScopeJson: built.permissionScope as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, readinessScore: true, status: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_frontline",
      prompt: "Create frontline packet",
      answerKind: "frontline_packet",
      message: built.leadershipSummary,
      evidence: { readinessScore: built.readinessScore, sourceSummary: built.sourceSummary } as Prisma.InputJsonObject,
      objectType: "assistant_frontline_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) }, { status: 201 });
}
