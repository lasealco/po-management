import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { buildMasterDataQualityRun, type MasterDataDomain, type MasterDataRecord, type StagingConflictSignal } from "@/lib/assistant/master-data-quality";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireMasterDataQualityAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  }
  const canAny =
    viewerHas(access.grantSet, "org.products", edit ? "edit" : "view") ||
    viewerHas(access.grantSet, "org.suppliers", edit ? "edit" : "view") ||
    viewerHas(access.grantSet, "org.crm", edit ? "edit" : "view") ||
    viewerHas(access.grantSet, "org.apihub", edit ? "edit" : "view") ||
    viewerHas(access.grantSet, "org.settings", edit ? "edit" : "view");
  if (!canAny) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires product, supplier, CRM, API Hub, or settings master-data access.",
        code: "FORBIDDEN",
        status: 403,
      }),
    };
  }
  return { ok: true as const, access };
}

function textFromJson(value: Prisma.JsonValue | null | undefined, key: string): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const next = (value as Record<string, unknown>)[key];
  return typeof next === "string" ? next : null;
}

function issuesFromJson(value: Prisma.JsonValue | null | undefined): string[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  const raw = (value as Record<string, unknown>).issues ?? (value as Record<string, unknown>).errors ?? (value as Record<string, unknown>).warnings;
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : [];
}

function targetDomain(value: string | null): MasterDataDomain | "UNKNOWN" {
  if (value === "PRODUCT" || value === "SUPPLIER" || value === "CUSTOMER" || value === "LOCATION" || value === "INTEGRATION") return value;
  return "UNKNOWN";
}

async function loadMasterDataInputs(tenantId: string, grantSet: Set<string>) {
  const [products, suppliers, customers, warehouses, stagingRows] = await Promise.all([
    viewerHas(grantSet, "org.products", "view")
      ? prisma.product.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 250,
          select: { id: true, sku: true, productCode: true, name: true, unit: true, ean: true, hsCode: true, updatedAt: true, isActive: true },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.suppliers", "view")
      ? prisma.supplier.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 250,
          select: {
            id: true,
            code: true,
            name: true,
            legalName: true,
            email: true,
            website: true,
            registeredCountryCode: true,
            taxId: true,
            updatedAt: true,
            isActive: true,
          },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.crm", "view")
      ? prisma.crmAccount.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 250,
          select: { id: true, name: true, legalName: true, website: true, ownerUserId: true, lifecycle: true, updatedAt: true },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.settings", "view") || viewerHas(grantSet, "org.wms", "view")
      ? prisma.warehouse.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 120,
          select: { id: true, code: true, name: true, city: true, countryCode: true, isActive: true, updatedAt: true },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.apihub", "view")
      ? prisma.apiHubStagingRow.findMany({
          where: { tenantId, OR: [{ issues: { not: Prisma.DbNull } }, { mappedRecord: { not: Prisma.DbNull } }] },
          orderBy: { createdAt: "desc" },
          take: 120,
          select: { id: true, batchId: true, rowIndex: true, mappedRecord: true, issues: true },
        })
      : Promise.resolve([]),
  ]);

  const records: MasterDataRecord[] = [
    ...products.map((product) => ({
      id: product.id,
      domain: "PRODUCT" as const,
      label: product.name,
      code: product.productCode ?? product.sku,
      secondaryKey: product.ean,
      updatedAt: product.updatedAt.toISOString(),
      fields: { unit: product.unit, sku: product.sku, hsCode: product.hsCode, isActive: product.isActive },
    })),
    ...suppliers.map((supplier) => ({
      id: supplier.id,
      domain: "SUPPLIER" as const,
      label: supplier.name,
      code: supplier.code,
      secondaryKey: supplier.website ?? supplier.legalName ?? supplier.taxId,
      updatedAt: supplier.updatedAt.toISOString(),
      fields: {
        email: supplier.email,
        website: supplier.website,
        registeredCountryCode: supplier.registeredCountryCode,
        legalName: supplier.legalName,
        isActive: supplier.isActive,
      },
    })),
    ...customers.map((customer) => ({
      id: customer.id,
      domain: "CUSTOMER" as const,
      label: customer.name,
      code: null,
      secondaryKey: customer.website ?? customer.legalName,
      updatedAt: customer.updatedAt.toISOString(),
      fields: { website: customer.website, owner: customer.ownerUserId, legalName: customer.legalName, lifecycle: customer.lifecycle },
    })),
    ...warehouses.map((warehouse) => ({
      id: warehouse.id,
      domain: "LOCATION" as const,
      label: warehouse.name,
      code: warehouse.code,
      secondaryKey: `${warehouse.city ?? ""}:${warehouse.countryCode ?? ""}`,
      updatedAt: warehouse.updatedAt.toISOString(),
      fields: { city: warehouse.city, countryCode: warehouse.countryCode, isActive: warehouse.isActive },
    })),
  ];

  const stagingConflicts: StagingConflictSignal[] = stagingRows
    .map((row) => {
      const issues = issuesFromJson(row.issues);
      const mapped = row.mappedRecord && typeof row.mappedRecord === "object" && !Array.isArray(row.mappedRecord) ? (row.mappedRecord as Record<string, unknown>) : null;
      const target = textFromJson(row.mappedRecord, "target") ?? textFromJson(row.mappedRecord, "domain") ?? "UNKNOWN";
      const label = textFromJson(row.mappedRecord, "name") ?? textFromJson(row.mappedRecord, "label") ?? `Staging row ${row.rowIndex}`;
      return {
        id: row.id,
        batchId: row.batchId,
        rowIndex: row.rowIndex,
        targetDomain: targetDomain(target),
        label,
        issues,
        mappedRecord: mapped,
      };
    })
    .filter((row) => row.issues.length > 0);

  return { records, stagingConflicts };
}

async function buildSnapshot(tenantId: string, grantSet: Set<string>) {
  const [runs, inputs] = await Promise.all([
    prisma.assistantMasterDataQualityRun.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        qualityScore: true,
        duplicateCount: true,
        gapCount: true,
        staleCount: true,
        conflictCount: true,
        summaryJson: true,
        duplicateGroupsJson: true,
        gapAnalysisJson: true,
        staleRecordsJson: true,
        conflictJson: true,
        enrichmentPlanJson: true,
        actionQueueItemId: true,
        approvedAt: true,
        updatedAt: true,
      },
    }),
    loadMasterDataInputs(tenantId, grantSet),
  ]);
  const preview = buildMasterDataQualityRun(inputs);
  return {
    signals: {
      records: inputs.records.length,
      stagingConflicts: inputs.stagingConflicts.length,
      previewQualityScore: preview.qualityScore,
      previewBlockers: preview.duplicateCount + preview.gapCount + preview.staleCount + preview.conflictCount,
    },
    preview,
    runs: runs.map((run) => ({
      ...run,
      approvedAt: run.approvedAt?.toISOString() ?? null,
      updatedAt: run.updatedAt.toISOString(),
    })),
  };
}

export async function GET() {
  const gate = await requireMasterDataQualityAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id, gate.access.grantSet));
}

export async function POST(request: Request) {
  const gate = await requireMasterDataQualityAccess(true);
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

  if (action === "queue_review") {
    const runId = typeof body.runId === "string" ? body.runId.trim() : "";
    const approvalNote = typeof body.approvalNote === "string" ? body.approvalNote.trim().slice(0, 4000) : "";
    if (!runId) return toApiErrorResponse({ error: "runId is required.", code: "BAD_INPUT", status: 400 });
    const run = await prisma.assistantMasterDataQualityRun.findFirst({ where: { id: runId, tenantId: gate.access.tenant.id } });
    if (!run) return toApiErrorResponse({ error: "Master data quality run not found.", code: "NOT_FOUND", status: 404 });
    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_master_data_quality",
        prompt: "Queue master data quality review",
        answerKind: "master_data_quality_review",
        message: "Master-data cleanup queued for human review. Canonical records and API Hub rows were not overwritten.",
        evidence: { runId: run.id, qualityScore: run.qualityScore, approvalNote } as Prisma.InputJsonObject,
        objectType: "assistant_master_data_quality_run",
        objectId: run.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_master_data_quality_run",
        objectId: run.id,
        objectHref: "/assistant/master-data-quality",
        priority: run.qualityScore < 65 ? "HIGH" : "MEDIUM",
        actionId: `amp21-mdq-${run.id}`.slice(0, 128),
        actionKind: "master_data_quality_review",
        label: `Review master data quality: ${run.qualityScore}/100`,
        description: "Approve dedupe, enrichment, and integration cleanup proposals. No canonical master data is changed automatically.",
        payload: {
          runId: run.id,
          qualityScore: run.qualityScore,
          duplicateCount: run.duplicateCount,
          gapCount: run.gapCount,
          staleCount: run.staleCount,
          conflictCount: run.conflictCount,
          approvalNote,
        } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    const updated = await prisma.assistantMasterDataQualityRun.update({
      where: { id: run.id },
      data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id, approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote },
      select: { id: true, status: true, actionQueueItemId: true },
    });
    return NextResponse.json({ ok: true, run: updated, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
  }

  if (action !== "create_scan") {
    return toApiErrorResponse({ error: "Unsupported master data quality action.", code: "BAD_INPUT", status: 400 });
  }

  const inputs = await loadMasterDataInputs(gate.access.tenant.id, gate.access.grantSet);
  const built = buildMasterDataQualityRun(inputs);
  const run = await prisma.assistantMasterDataQualityRun.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      qualityScore: built.qualityScore,
      duplicateCount: built.duplicateCount,
      gapCount: built.gapCount,
      staleCount: built.staleCount,
      conflictCount: built.conflictCount,
      summaryJson: built.summary as Prisma.InputJsonValue,
      duplicateGroupsJson: built.duplicateGroups as Prisma.InputJsonValue,
      gapAnalysisJson: built.gapAnalysis as Prisma.InputJsonValue,
      staleRecordsJson: built.staleRecords as Prisma.InputJsonValue,
      conflictJson: built.conflicts as Prisma.InputJsonValue,
      enrichmentPlanJson: built.enrichmentPlan as Prisma.InputJsonValue,
    },
    select: { id: true, title: true, qualityScore: true, status: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_master_data_quality",
      prompt: "Create master data quality scan",
      answerKind: "master_data_quality_run",
      message: `Master data quality scan scored ${built.qualityScore}/100. Assistant proposed review work only; no canonical records were overwritten.`,
      evidence: built.summary as Prisma.InputJsonObject,
      objectType: "assistant_master_data_quality_run",
      objectId: run.id,
    },
  });
  return NextResponse.json({ ok: true, run, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) }, { status: 201 });
}
