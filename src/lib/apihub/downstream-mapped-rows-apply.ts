import { Prisma } from "@prisma/client";

import type { ApiHubStagingApplyTarget } from "@/lib/apihub/constants";
import { prisma } from "@/lib/prisma";

export type ApiHubStagingApplyRowResult = {
  rowIndex: number;
  ok: boolean;
  entityType?: string;
  entityId?: string;
  error?: string;
};

export type ApiHubStagingApplySummary = {
  target: ApiHubStagingApplyTarget;
  dryRun: boolean;
  rows: ApiHubStagingApplyRowResult[];
};

export type ApiHubMappedApplyRow = {
  rowIndex: number;
  mappedRecord: unknown;
  /** Present for staging CT audit rows (links `CtAuditLog.entityId` to `ApiHubStagingRow.id`). */
  stagingRowId?: string;
};

export type ApiHubCtAuditSource =
  | { kind: "staging_batch"; batchId: string }
  | { kind: "ingestion_run"; runId: string };

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function readStr(rec: Record<string, unknown>, key: string): string | null {
  const x = rec[key];
  return typeof x === "string" ? x.trim() || null : null;
}

function readNum(rec: Record<string, unknown>, key: string): number | null {
  const x = rec[key];
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string" && x.trim()) {
    const n = Number(x.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function nextOrderNumberInTx(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
  const stamp = Date.now().toString().slice(-6);
  let candidate = `PO-${stamp}`;
  for (let i = 0; i < 8; i += 1) {
    const exists = await tx.purchaseOrder.findFirst({
      where: { tenantId, orderNumber: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
    candidate = `PO-${stamp}-${i + 1}`;
  }
  return `PO-${stamp}-${Math.floor(Math.random() * 1000)}`;
}

async function nextSalesOrderNumberInTx(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
  const stamp = Date.now().toString().slice(-6);
  let candidate = `SO-${stamp}`;
  for (let i = 0; i < 8; i += 1) {
    const exists = await tx.salesOrder.findFirst({
      where: { tenantId, soNumber: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
    candidate = `SO-${stamp}-${i + 1}`;
  }
  return `SO-${stamp}-${Math.floor(Math.random() * 1000)}`;
}

async function loadDefaultWorkflowStart(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<{ workflowId: string; statusId: string }> {
  const workflow = await tx.workflow.findFirst({
    where: { tenantId, isDefault: true },
    select: { id: true },
  });
  if (!workflow) {
    throw new Error("No default workflow found for tenant.");
  }
  const startStatus = await tx.workflowStatus.findFirst({
    where: { workflowId: workflow.id, isStart: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  if (!startStatus) {
    throw new Error("Default workflow has no start status.");
  }
  return { workflowId: workflow.id, statusId: startStatus.id };
}

export async function assertNoSalesOrderExternalRefConflict(
  tx: Prisma.TransactionClient,
  tenantId: string,
  externalRef: string,
): Promise<void> {
  const existing = await tx.salesOrder.findFirst({
    where: { tenantId, externalRef },
    select: { id: true },
  });
  if (existing) {
    throw new Error(`Sales order already exists for externalRef=${externalRef}.`);
  }
}

async function applySalesOrderRowLive(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    actorUserId: string;
    row: ApiHubMappedApplyRow;
    enforceExternalRefUnique: boolean;
  },
): Promise<ApiHubStagingApplyRowResult> {
  const { tenantId, actorUserId, row, enforceExternalRefUnique } = input;
  const rec = asRecord(row.mappedRecord);
  if (!rec) {
    return { rowIndex: row.rowIndex, ok: false, error: "mappedRecord must be an object." };
  }
  const customerId = readStr(rec, "customerCrmAccountId");
  if (!customerId) {
    return { rowIndex: row.rowIndex, ok: false, error: "customerCrmAccountId is required." };
  }
  const account = await tx.crmAccount.findFirst({
    where: { id: customerId, tenantId },
    select: { id: true, name: true },
  });
  if (!account) {
    return { rowIndex: row.rowIndex, ok: false, error: "CRM account not found for tenant." };
  }
  const soNumberRaw = readStr(rec, "soNumber");
  const soNumber = soNumberRaw || (await nextSalesOrderNumberInTx(tx, tenantId));
  const externalRef = readStr(rec, "externalRef");
  if (enforceExternalRefUnique && externalRef) {
    try {
      await assertNoSalesOrderExternalRefConflict(tx, tenantId, externalRef);
    } catch {
      return {
        rowIndex: row.rowIndex,
        ok: false,
        error: `Duplicate sales order externalRef for tenant (${externalRef}).`,
      };
    }
  }
  const rddRaw = readStr(rec, "requestedDeliveryDate");
  const requestedDeliveryDate = rddRaw ? new Date(rddRaw) : null;
  if (requestedDeliveryDate && Number.isNaN(requestedDeliveryDate.getTime())) {
    return { rowIndex: row.rowIndex, ok: false, error: "Invalid requestedDeliveryDate." };
  }
  const created = await tx.salesOrder.create({
    data: {
      tenantId,
      soNumber,
      customerName: account.name,
      customerCrmAccountId: account.id,
      externalRef,
      requestedDeliveryDate,
      createdById: actorUserId,
      status: "DRAFT",
    },
    select: { id: true },
  });
  return { rowIndex: row.rowIndex, ok: true, entityType: "SalesOrder", entityId: created.id };
}

async function applyPurchaseOrderRowLive(
  tx: Prisma.TransactionClient,
  input: { tenantId: string; actorUserId: string; row: ApiHubMappedApplyRow },
): Promise<ApiHubStagingApplyRowResult> {
  const { tenantId, actorUserId, row } = input;
  const rec = asRecord(row.mappedRecord);
  if (!rec) {
    return { rowIndex: row.rowIndex, ok: false, error: "mappedRecord must be an object." };
  }
  const supplierId = readStr(rec, "supplierId");
  const productId = readStr(rec, "productId");
  const quantity = readNum(rec, "quantity");
  const unitPrice = readNum(rec, "unitPrice");
  if (!supplierId || !productId || quantity == null || quantity <= 0 || unitPrice == null || unitPrice < 0) {
    return {
      rowIndex: row.rowIndex,
      ok: false,
      error: "supplierId, productId, quantity (>0), and unitPrice (>=0) are required.",
    };
  }
  const supplier = await tx.supplier.findFirst({
    where: { id: supplierId, tenantId, isActive: true },
    select: { id: true },
  });
  if (!supplier) {
    return { rowIndex: row.rowIndex, ok: false, error: "Supplier not found or inactive." };
  }
  const linked = await tx.product.findFirst({
    where: {
      id: productId,
      tenantId,
      isActive: true,
      productSuppliers: { some: { supplierId } },
    },
    select: { id: true, name: true },
  });
  if (!linked) {
    return { rowIndex: row.rowIndex, ok: false, error: "Product not found or not linked to supplier." };
  }
  const { workflowId, statusId } = await loadDefaultWorkflowStart(tx, tenantId);
  const orderNumber = readStr(rec, "orderNumber") || (await nextOrderNumberInTx(tx, tenantId));
  const lineNo = Math.max(1, Math.trunc(readNum(rec, "lineNo") ?? 1));
  const description =
    readStr(rec, "lineDescription") || readStr(rec, "description") || linked.name || "Imported line";
  const subtotal = quantity * unitPrice;
  const tax = subtotal * 0.08;
  const total = subtotal + tax;
  const buyerReference = readStr(rec, "buyerReference");
  const rddRaw = readStr(rec, "requestedDeliveryDate");
  const requestedDeliveryDate = rddRaw ? new Date(`${rddRaw}T00:00:00.000Z`) : null;
  if (requestedDeliveryDate && Number.isNaN(requestedDeliveryDate.getTime())) {
    return { rowIndex: row.rowIndex, ok: false, error: "Invalid requestedDeliveryDate." };
  }
  const created = await tx.purchaseOrder.create({
    data: {
      tenantId,
      workflowId,
      orderNumber,
      title: readStr(rec, "title"),
      requesterId: actorUserId,
      supplierId,
      statusId,
      currency: "USD",
      subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
      taxAmount: new Prisma.Decimal(tax.toFixed(2)),
      totalAmount: new Prisma.Decimal(total.toFixed(2)),
      buyerReference,
      requestedDeliveryDate,
      items: {
        create: [
          {
            lineNo,
            productId,
            description,
            quantity: new Prisma.Decimal(quantity.toFixed(3)),
            unitPrice: new Prisma.Decimal(unitPrice.toFixed(4)),
            lineTotal: new Prisma.Decimal(subtotal.toFixed(2)),
          },
        ],
      },
    },
    select: { id: true },
  });
  return { rowIndex: row.rowIndex, ok: true, entityType: "PurchaseOrder", entityId: created.id };
}

function dryRunPurchaseOrderRow(row: ApiHubMappedApplyRow): ApiHubStagingApplyRowResult {
  const rec = asRecord(row.mappedRecord);
  if (!rec) {
    return { rowIndex: row.rowIndex, ok: false, error: "mappedRecord must be an object." };
  }
  const supplierId = readStr(rec, "supplierId");
  const productId = readStr(rec, "productId");
  const quantity = readNum(rec, "quantity");
  const unitPrice = readNum(rec, "unitPrice");
  if (!supplierId || !productId || quantity == null || quantity <= 0 || unitPrice == null || unitPrice < 0) {
    return {
      rowIndex: row.rowIndex,
      ok: false,
      error: "supplierId, productId, quantity (>0), and unitPrice (>=0) are required.",
    };
  }
  return { rowIndex: row.rowIndex, ok: true, entityType: "PurchaseOrder", entityId: "(dry-run)" };
}

function dryRunSalesOrderRow(row: ApiHubMappedApplyRow): ApiHubStagingApplyRowResult {
  const rec = asRecord(row.mappedRecord);
  if (!rec) {
    return { rowIndex: row.rowIndex, ok: false, error: "mappedRecord must be an object." };
  }
  const customerId = readStr(rec, "customerCrmAccountId");
  if (!customerId) {
    return { rowIndex: row.rowIndex, ok: false, error: "customerCrmAccountId is required." };
  }
  return { rowIndex: row.rowIndex, ok: true, entityType: "SalesOrder", entityId: "(dry-run)" };
}

async function applyCtAuditRowLive(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    actorUserId: string;
    row: ApiHubMappedApplyRow;
    ctSource: ApiHubCtAuditSource;
  },
): Promise<ApiHubStagingApplyRowResult> {
  const { tenantId, actorUserId, row, ctSource } = input;
  const rec = asRecord(row.mappedRecord);
  const shipmentId = rec ? readStr(rec, "shipmentId") : null;
  if (shipmentId) {
    const ship = await tx.shipment.findFirst({
      where: { id: shipmentId, order: { tenantId } },
      select: { id: true },
    });
    if (!ship) {
      return { rowIndex: row.rowIndex, ok: false, error: "Shipment not found for tenant." };
    }
  }

  const action =
    ctSource.kind === "staging_batch" ? "apihub.staging_batch.apply" : "apihub.ingestion_run.apply_downstream";

  const payload: Record<string, unknown> =
    ctSource.kind === "staging_batch"
      ? {
          schemaVersion: 1,
          batchId: ctSource.batchId,
          rowIndex: row.rowIndex,
          target: "control_tower_audit",
          mappedRecord: row.mappedRecord ?? null,
        }
      : {
          schemaVersion: 2,
          runId: ctSource.runId,
          rowIndex: row.rowIndex,
          target: "control_tower_audit",
          mappedRecord: row.mappedRecord ?? null,
        };

  const entityType = ctSource.kind === "staging_batch" ? "ApiHubStagingRow" : "ApiHubIngestionRun";
  const entityId =
    ctSource.kind === "staging_batch"
      ? (row.stagingRowId ?? "")
      : ctSource.runId;
  if (ctSource.kind === "staging_batch" && !row.stagingRowId) {
    return { rowIndex: row.rowIndex, ok: false, error: "stagingRowId is required for staging CT audit apply." };
  }

  const log = await tx.ctAuditLog.create({
    data: {
      tenantId,
      shipmentId,
      entityType,
      entityId,
      action,
      actorUserId,
      payload: payload as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  return { rowIndex: row.rowIndex, ok: true, entityType: "CtAuditLog", entityId: log.id };
}

async function dryRunCtRow(
  row: ApiHubMappedApplyRow,
  tenantId: string,
): Promise<ApiHubStagingApplyRowResult> {
  const rec = asRecord(row.mappedRecord);
  const shipmentId = rec ? readStr(rec, "shipmentId") : null;
  if (shipmentId) {
    const ship = await prisma.shipment.findFirst({
      where: { id: shipmentId, order: { tenantId } },
      select: { id: true },
    });
    if (!ship) {
      return { rowIndex: row.rowIndex, ok: false, error: "Shipment not found for tenant." };
    }
  }
  return { rowIndex: row.rowIndex, ok: true, entityType: "CtAuditLog", entityId: "(dry-run)" };
}

export async function dryRunSalesOrderExternalRefConflicts(
  tenantId: string,
  rows: ApiHubMappedApplyRow[],
): Promise<{ rowIndex: number; externalRef: string } | null> {
  for (const row of rows) {
    const rec = asRecord(row.mappedRecord);
    const externalRef = rec ? readStr(rec, "externalRef") : null;
    if (!externalRef) continue;
    const existing = await prisma.salesOrder.findFirst({
      where: { tenantId, externalRef },
      select: { id: true },
    });
    if (existing) {
      return { rowIndex: row.rowIndex, externalRef };
    }
  }
  return null;
}

/** Apply mapped rows inside an existing transaction (caller commits). */
export async function applyMappedRowsInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    actorUserId: string;
    target: ApiHubStagingApplyTarget;
    rows: ApiHubMappedApplyRow[];
    ctSource: ApiHubCtAuditSource;
    enforceSalesOrderExternalRefUnique: boolean;
  },
): Promise<ApiHubStagingApplySummary> {
  const sorted = [...input.rows].sort((a, b) => a.rowIndex - b.rowIndex);
  const outRows: ApiHubStagingApplyRowResult[] = [];
  for (const row of sorted) {
    let r: ApiHubStagingApplyRowResult;
    if (input.target === "sales_order") {
      r = await applySalesOrderRowLive(tx, {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        row,
        enforceExternalRefUnique: input.enforceSalesOrderExternalRefUnique,
      });
    } else if (input.target === "purchase_order") {
      r = await applyPurchaseOrderRowLive(tx, {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        row,
      });
    } else {
      r = await applyCtAuditRowLive(tx, {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        row,
        ctSource: input.ctSource,
      });
    }
    outRows.push(r);
    if (!r.ok) {
      throw new Error(r.error ?? "Row apply failed.");
    }
  }
  return { target: input.target, dryRun: false, rows: outRows };
}

export async function dryRunMappedRowsPreview(input: {
  tenantId: string;
  target: ApiHubStagingApplyTarget;
  rows: ApiHubMappedApplyRow[];
}): Promise<ApiHubStagingApplySummary> {
  const sorted = [...input.rows].sort((a, b) => a.rowIndex - b.rowIndex);
  const outRows: ApiHubStagingApplyRowResult[] = [];
  for (const row of sorted) {
    if (input.target === "sales_order") {
      outRows.push(dryRunSalesOrderRow(row));
    } else if (input.target === "purchase_order") {
      outRows.push(dryRunPurchaseOrderRow(row));
    } else {
      outRows.push(await dryRunCtRow(row, input.tenantId));
    }
  }
  return { target: input.target, dryRun: true, rows: outRows };
}

export function downstreamSummaryToTargetCounts(summary: ApiHubStagingApplySummary): {
  created: number;
  updated: number;
  skipped: number;
} {
  let created = 0;
  let updated = 0;
  for (const r of summary.rows) {
    if (!r.ok) continue;
    created += 1;
  }
  return { created, updated, skipped: 0 };
}
