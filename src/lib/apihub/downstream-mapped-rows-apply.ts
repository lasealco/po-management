import { Prisma } from "@prisma/client";

import type { ApiHubPurchaseOrderLineMergeMode, ApiHubStagingApplyTarget } from "@/lib/apihub/constants";
import { prisma } from "@/lib/prisma";

export type ApiHubStagingApplyRowResult = {
  rowIndex: number;
  ok: boolean;
  entityType?: string;
  entityId?: string;
  /** Set for ingestion upsert paths (staging apply is always create-only). */
  applyOp?: "created" | "updated";
  error?: string;
};

/** How to treat duplicate SO `externalRef` when matchKey is `sales_order_external_ref`. */
export type ApiHubSalesOrderExternalRefPolicy = "ignore" | "reject_duplicate" | "upsert";

/** How to treat duplicate PO `buyerReference` when matchKey is `purchase_order_buyer_reference`. */
export type ApiHubPurchaseOrderBuyerRefPolicy = "ignore" | "reject_duplicate" | "upsert";

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

/** Key present in mapped payload (including explicit `null`) — used for partial upsert patches. */
function hasMappedKey(rec: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(rec, key);
}

/** `null` clears to **USD** for optional currency patches (ingestion apply). */
function readIso4217CurrencyField(raw: unknown, fieldLabel: string): string | { error: string } {
  if (raw === null) {
    return "USD";
  }
  if (typeof raw !== "string") {
    return { error: `${fieldLabel} must be a string or null.` };
  }
  const u = raw.trim().toUpperCase();
  if (!u) {
    return { error: `${fieldLabel} cannot be empty when provided.` };
  }
  if (!/^[A-Z]{3}$/.test(u)) {
    return { error: `${fieldLabel} must be a 3-letter ISO code.` };
  }
  return u;
}

/**
 * Optional PO header scalars for ingestion apply (create + upsert). Mutates **`target`**.
 * @returns operator-visible error or `null` when ok.
 */
function appendPurchaseOrderHeaderScalarsFromRecord(
  rec: Record<string, unknown>,
  target: Prisma.PurchaseOrderUpdateInput,
): string | null {
  if (hasMappedKey(rec, "currency")) {
    const r = readIso4217CurrencyField(rec["currency"], "currency");
    if (typeof r === "object") {
      return r.error;
    }
    target.currency = r;
  }
  if (hasMappedKey(rec, "supplierReference")) {
    target.supplierReference = readStr(rec, "supplierReference");
  }
  if (hasMappedKey(rec, "paymentTermsDays")) {
    const v = rec["paymentTermsDays"];
    if (v === null) {
      target.paymentTermsDays = null;
    } else {
      const n = readNum(rec, "paymentTermsDays");
      if (n == null || !Number.isInteger(n) || n < 0) {
        return "paymentTermsDays must be a non-negative integer or null.";
      }
      target.paymentTermsDays = n;
    }
  }
  if (hasMappedKey(rec, "paymentTermsLabel")) {
    target.paymentTermsLabel = readStr(rec, "paymentTermsLabel");
  }
  if (hasMappedKey(rec, "incoterm")) {
    target.incoterm = readStr(rec, "incoterm");
  }
  if (hasMappedKey(rec, "shipToName")) {
    target.shipToName = readStr(rec, "shipToName");
  }
  if (hasMappedKey(rec, "shipToLine1")) {
    target.shipToLine1 = readStr(rec, "shipToLine1");
  }
  if (hasMappedKey(rec, "shipToLine2")) {
    target.shipToLine2 = readStr(rec, "shipToLine2");
  }
  if (hasMappedKey(rec, "shipToCity")) {
    target.shipToCity = readStr(rec, "shipToCity");
  }
  if (hasMappedKey(rec, "shipToRegion")) {
    target.shipToRegion = readStr(rec, "shipToRegion");
  }
  if (hasMappedKey(rec, "shipToPostalCode")) {
    target.shipToPostalCode = readStr(rec, "shipToPostalCode");
  }
  if (hasMappedKey(rec, "shipToCountryCode")) {
    const c = readStr(rec, "shipToCountryCode");
    if (c == null) {
      target.shipToCountryCode = null;
    } else if (!/^[A-Za-z]{2}$/.test(c)) {
      return "shipToCountryCode must be exactly two letters (ISO 3166-1 alpha-2).";
    } else {
      target.shipToCountryCode = c.toUpperCase();
    }
  }
  if (hasMappedKey(rec, "internalNotes")) {
    const v = rec["internalNotes"];
    if (v === null) {
      target.internalNotes = null;
    } else if (typeof v === "string") {
      target.internalNotes = v.trim() || null;
    } else {
      return "internalNotes must be a string or null.";
    }
  }
  if (hasMappedKey(rec, "notesToSupplier")) {
    const v = rec["notesToSupplier"];
    if (v === null) {
      target.notesToSupplier = null;
    } else if (typeof v === "string") {
      target.notesToSupplier = v.trim() || null;
    } else {
      return "notesToSupplier must be a string or null.";
    }
  }
  return null;
}

async function recomputePurchaseOrderTotalsFromItems(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const items = await tx.purchaseOrderItem.findMany({
    where: { orderId },
    select: { lineTotal: true },
  });
  let subtotal = 0;
  for (const it of items) {
    subtotal += Number(it.lineTotal);
  }
  const tax = subtotal * 0.08;
  const total = subtotal + tax;
  await tx.purchaseOrder.update({
    where: { id: orderId },
    data: {
      subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
      taxAmount: new Prisma.Decimal(tax.toFixed(2)),
      totalAmount: new Prisma.Decimal(total.toFixed(2)),
    },
  });
}

type PoLineParsed =
  | { ok: false; error: string }
  | {
      ok: true;
      lineNo: number;
      supplierId: string;
      productId: string;
      description: string;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      lineTotal: Prisma.Decimal;
      lineSubtotal: number;
    };

async function validatePurchaseOrderLineForApply(
  tx: Prisma.TransactionClient,
  tenantId: string,
  row: ApiHubMappedApplyRow,
): Promise<PoLineParsed> {
  const rec = asRecord(row.mappedRecord);
  if (!rec) {
    return { ok: false, error: "mappedRecord must be an object." };
  }
  const supplierId = readStr(rec, "supplierId");
  const productId = readStr(rec, "productId");
  const quantity = readNum(rec, "quantity");
  const unitPrice = readNum(rec, "unitPrice");
  if (!supplierId || !productId || quantity == null || quantity <= 0 || unitPrice == null || unitPrice < 0) {
    return {
      ok: false,
      error: "supplierId, productId, quantity (>0), and unitPrice (>=0) are required.",
    };
  }
  const supplier = await tx.supplier.findFirst({
    where: { id: supplierId, tenantId, isActive: true },
    select: { id: true },
  });
  if (!supplier) {
    return { ok: false, error: "Supplier not found or inactive." };
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
    return { ok: false, error: "Product not found or not linked to supplier." };
  }
  const lineNo = Math.max(1, Math.trunc(readNum(rec, "lineNo") ?? 1));
  const description =
    readStr(rec, "lineDescription") || readStr(rec, "description") || linked.name || "Imported line";
  const lineSubtotal = quantity * unitPrice;
  return {
    ok: true,
    lineNo,
    supplierId,
    productId,
    description,
    quantity: new Prisma.Decimal(quantity.toFixed(3)),
    unitPrice: new Prisma.Decimal(unitPrice.toFixed(4)),
    lineTotal: new Prisma.Decimal(lineSubtotal.toFixed(2)),
    lineSubtotal,
  };
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

export async function assertNoPurchaseOrderBuyerReferenceConflict(
  tx: Prisma.TransactionClient,
  tenantId: string,
  buyerReference: string,
): Promise<void> {
  const existing = await tx.purchaseOrder.findFirst({
    where: { tenantId, buyerReference },
    select: { id: true },
  });
  if (existing) {
    throw new Error(`Purchase order already exists for buyerReference=${buyerReference}.`);
  }
}

async function applySalesOrderRowLive(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    actorUserId: string;
    row: ApiHubMappedApplyRow;
    externalRefPolicy: ApiHubSalesOrderExternalRefPolicy;
  },
): Promise<ApiHubStagingApplyRowResult> {
  const { tenantId, actorUserId, row, externalRefPolicy } = input;
  const rec = asRecord(row.mappedRecord);
  if (!rec) {
    return { rowIndex: row.rowIndex, ok: false, error: "mappedRecord must be an object." };
  }
  const externalRef = readStr(rec, "externalRef");

  if (externalRefPolicy === "upsert" && externalRef) {
    const existing = await tx.salesOrder.findFirst({
      where: { tenantId, externalRef },
      select: { id: true },
    });
    if (existing) {
      const data: Prisma.SalesOrderUpdateInput = {};
      if (hasMappedKey(rec, "customerCrmAccountId")) {
        const customerId = readStr(rec, "customerCrmAccountId");
        if (!customerId) {
          return {
            rowIndex: row.rowIndex,
            ok: false,
            error: "customerCrmAccountId cannot be empty when provided.",
          };
        }
        const account = await tx.crmAccount.findFirst({
          where: { id: customerId, tenantId },
          select: { id: true, name: true },
        });
        if (!account) {
          return { rowIndex: row.rowIndex, ok: false, error: "CRM account not found for tenant." };
        }
        data.customerName = account.name;
        data.customerCrmAccount = { connect: { id: account.id } };
      }
      if (hasMappedKey(rec, "requestedDeliveryDate")) {
        const rddRaw = readStr(rec, "requestedDeliveryDate");
        const requestedDeliveryDate = rddRaw ? new Date(rddRaw) : null;
        if (requestedDeliveryDate && Number.isNaN(requestedDeliveryDate.getTime())) {
          return { rowIndex: row.rowIndex, ok: false, error: "Invalid requestedDeliveryDate." };
        }
        data.requestedDeliveryDate = requestedDeliveryDate;
      }
      if (hasMappedKey(rec, "notes")) {
        const v = rec["notes"];
        if (v === null) {
          data.notes = null;
        } else if (typeof v === "string") {
          data.notes = v.trim() || null;
        } else {
          return { rowIndex: row.rowIndex, ok: false, error: "notes must be a string or null." };
        }
      }
      if (hasMappedKey(rec, "requestedShipDate")) {
        const raw = readStr(rec, "requestedShipDate");
        const requestedShipDate = raw ? new Date(raw) : null;
        if (requestedShipDate && Number.isNaN(requestedShipDate.getTime())) {
          return { rowIndex: row.rowIndex, ok: false, error: "Invalid requestedShipDate." };
        }
        data.requestedShipDate = requestedShipDate;
      }
      if (hasMappedKey(rec, "currency")) {
        const r = readIso4217CurrencyField(rec["currency"], "currency");
        if (typeof r === "object") {
          return { rowIndex: row.rowIndex, ok: false, error: r.error };
        }
        data.currency = r;
      }
      if (Object.keys(data).length > 0) {
        await tx.salesOrder.update({
          where: { id: existing.id },
          data,
        });
      }
      return {
        rowIndex: row.rowIndex,
        ok: true,
        entityType: "SalesOrder",
        entityId: existing.id,
        applyOp: "updated",
      };
    }
  }

  const customerId = readStr(rec, "customerCrmAccountId");
  if (!customerId) {
    return {
      rowIndex: row.rowIndex,
      ok: false,
      error: "customerCrmAccountId is required for create.",
    };
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
  const rddRaw = readStr(rec, "requestedDeliveryDate");
  const requestedDeliveryDate = rddRaw ? new Date(rddRaw) : null;
  if (requestedDeliveryDate && Number.isNaN(requestedDeliveryDate.getTime())) {
    return { rowIndex: row.rowIndex, ok: false, error: "Invalid requestedDeliveryDate." };
  }
  const rsdRaw = readStr(rec, "requestedShipDate");
  const requestedShipDate = rsdRaw ? new Date(rsdRaw) : null;
  if (requestedShipDate && Number.isNaN(requestedShipDate.getTime())) {
    return { rowIndex: row.rowIndex, ok: false, error: "Invalid requestedShipDate." };
  }
  const notesVal = readStr(rec, "notes");
  let soCurrency = "USD";
  if (hasMappedKey(rec, "currency")) {
    const r = readIso4217CurrencyField(rec["currency"], "currency");
    if (typeof r === "object") {
      return { rowIndex: row.rowIndex, ok: false, error: r.error };
    }
    soCurrency = r;
  }

  if (externalRefPolicy === "reject_duplicate" && externalRef) {
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

  const created = await tx.salesOrder.create({
    data: {
      tenantId,
      soNumber,
      customerName: account.name,
      customerCrmAccountId: account.id,
      externalRef,
      requestedDeliveryDate,
      requestedShipDate,
      currency: soCurrency,
      notes: notesVal,
      createdById: actorUserId,
      status: "DRAFT",
    },
    select: { id: true },
  });
  return {
    rowIndex: row.rowIndex,
    ok: true,
    entityType: "SalesOrder",
    entityId: created.id,
    applyOp: "created",
  };
}

/**
 * PO upsert with `purchaseOrderLineMerge=replace_all`: one apply replaces **all** lines for the PO
 * matched by `buyerReference`, using **all rows in the batch** that share that reference.
 */
async function applyPoBuyerRefReplaceAllGroup(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    actorUserId: string;
    groupRows: ApiHubMappedApplyRow[];
  },
): Promise<ApiHubStagingApplyRowResult[]> {
  const { tenantId, actorUserId, groupRows } = input;
  const sorted = [...groupRows].sort((a, b) => a.rowIndex - b.rowIndex);
  const firstRec = asRecord(sorted[0]?.mappedRecord);
  if (!firstRec) {
    return sorted.map((row) => ({
      rowIndex: row.rowIndex,
      ok: false,
      error: "mappedRecord must be an object.",
    }));
  }
  const buyerReference = readStr(firstRec, "buyerReference");
  if (!buyerReference) {
    return sorted.map((row) => ({
      rowIndex: row.rowIndex,
      ok: false,
      error: "buyerReference is required for replace_all groups.",
    }));
  }
  for (const row of sorted) {
    const rec = asRecord(row.mappedRecord);
    const br = rec ? readStr(rec, "buyerReference") : null;
    if (br !== buyerReference) {
      return sorted.map((r) => ({
        rowIndex: r.rowIndex,
        ok: false,
        error: "Inconsistent buyerReference within replace_all group.",
      }));
    }
  }

  const parsedList: Array<{ row: ApiHubMappedApplyRow; p: Extract<PoLineParsed, { ok: true }> }> = [];
  for (const row of sorted) {
    const p = await validatePurchaseOrderLineForApply(tx, tenantId, row);
    if (!p.ok) {
      return sorted.map((r) => ({
        rowIndex: r.rowIndex,
        ok: false,
        error: p.error,
      }));
    }
    parsedList.push({ row, p });
  }
  const supplierIds = new Set(parsedList.map((x) => x.p.supplierId));
  if (supplierIds.size !== 1) {
    const msg =
      "purchaseOrderLineMerge=replace_all requires the same supplierId on every line in the group.";
    return sorted.map((row) => ({ rowIndex: row.rowIndex, ok: false, error: msg }));
  }
  const supplierId = parsedList[0]!.p.supplierId;

  const existing = await tx.purchaseOrder.findFirst({
    where: { tenantId, buyerReference },
    select: { id: true, supplierId: true },
  });

  if (existing) {
    if (existing.supplierId !== supplierId) {
      const msg = "Line supplierId does not match existing purchase order supplier.";
      return sorted.map((row) => ({ rowIndex: row.rowIndex, ok: false, error: msg }));
    }
    await tx.purchaseOrderItem.deleteMany({ where: { orderId: existing.id } });
    const header: Prisma.PurchaseOrderUpdateInput = {
      requester: { connect: { id: actorUserId } },
      supplier: { connect: { id: supplierId } },
    };
    if (hasMappedKey(firstRec, "title")) {
      header.title = readStr(firstRec, "title");
    }
    if (hasMappedKey(firstRec, "requestedDeliveryDate")) {
      const rddRaw = readStr(firstRec, "requestedDeliveryDate");
      const requestedDeliveryDate = rddRaw ? new Date(`${rddRaw}T00:00:00.000Z`) : null;
      if (requestedDeliveryDate && Number.isNaN(requestedDeliveryDate.getTime())) {
        const err = "Invalid requestedDeliveryDate.";
        return sorted.map((row) => ({ rowIndex: row.rowIndex, ok: false, error: err }));
      }
      header.requestedDeliveryDate = requestedDeliveryDate;
    }
    const herr = appendPurchaseOrderHeaderScalarsFromRecord(firstRec, header);
    if (herr) {
      return sorted.map((row) => ({ rowIndex: row.rowIndex, ok: false, error: herr }));
    }
    await tx.purchaseOrder.update({
      where: { id: existing.id },
      data: {
        ...header,
        items: {
          create: parsedList.map(({ p }) => ({
            lineNo: p.lineNo,
            productId: p.productId,
            description: p.description,
            quantity: p.quantity,
            unitPrice: p.unitPrice,
            lineTotal: p.lineTotal,
          })),
        },
      },
    });
    await recomputePurchaseOrderTotalsFromItems(tx, existing.id);
    return sorted.map((row) => ({
      rowIndex: row.rowIndex,
      ok: true,
      entityType: "PurchaseOrder",
      entityId: existing.id,
      applyOp: "updated" as const,
    }));
  }

  const { workflowId, statusId } = await loadDefaultWorkflowStart(tx, tenantId);
  const orderNumber = readStr(firstRec, "orderNumber") || (await nextOrderNumberInTx(tx, tenantId));
  const title = hasMappedKey(firstRec, "title") ? readStr(firstRec, "title") : null;
  let requestedDeliveryDate: Date | null = null;
  if (hasMappedKey(firstRec, "requestedDeliveryDate")) {
    const rddRaw = readStr(firstRec, "requestedDeliveryDate");
    requestedDeliveryDate = rddRaw ? new Date(`${rddRaw}T00:00:00.000Z`) : null;
    if (requestedDeliveryDate && Number.isNaN(requestedDeliveryDate.getTime())) {
      const err = "Invalid requestedDeliveryDate.";
      return sorted.map((row) => ({ rowIndex: row.rowIndex, ok: false, error: err }));
    }
  }

  let subtotal = 0;
  for (const { p } of parsedList) {
    subtotal += p.lineSubtotal;
  }
  const tax = subtotal * 0.08;
  const total = subtotal + tax;

  const poHeaderPatch: Prisma.PurchaseOrderUpdateInput = {};
  const phErr = appendPurchaseOrderHeaderScalarsFromRecord(firstRec, poHeaderPatch);
  if (phErr) {
    return sorted.map((row) => ({ rowIndex: row.rowIndex, ok: false, error: phErr }));
  }

  const created = await tx.purchaseOrder.create({
    data: {
      tenantId,
      workflowId,
      orderNumber,
      title,
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
        create: parsedList.map(({ p }) => ({
          lineNo: p.lineNo,
          productId: p.productId,
          description: p.description,
          quantity: p.quantity,
          unitPrice: p.unitPrice,
          lineTotal: p.lineTotal,
        })),
      },
      ...(poHeaderPatch as object),
    },
    select: { id: true },
  });
  await recomputePurchaseOrderTotalsFromItems(tx, created.id);
  return sorted.map((row) => ({
    rowIndex: row.rowIndex,
    ok: true,
    entityType: "PurchaseOrder",
    entityId: created.id,
    applyOp: "created" as const,
  }));
}

async function applyPurchaseOrderRowLive(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    actorUserId: string;
    row: ApiHubMappedApplyRow;
    buyerRefPolicy: ApiHubPurchaseOrderBuyerRefPolicy;
    /** Only used when `buyerRefPolicy === "upsert"`; **`replace_all` rows are handled by grouping.** */
    purchaseOrderLineMerge?: ApiHubPurchaseOrderLineMergeMode;
  },
): Promise<ApiHubStagingApplyRowResult> {
  const { tenantId, actorUserId, row, buyerRefPolicy, purchaseOrderLineMerge = "merge_by_line_no" } =
    input;
  const rec = asRecord(row.mappedRecord);
  if (!rec) {
    return { rowIndex: row.rowIndex, ok: false, error: "mappedRecord must be an object." };
  }
  const parsed = await validatePurchaseOrderLineForApply(tx, tenantId, row);
  if (!parsed.ok) {
    return { rowIndex: row.rowIndex, ok: false, error: parsed.error };
  }
  const {
    lineNo,
    supplierId,
    productId,
    description,
    quantity,
    unitPrice,
    lineTotal,
    lineSubtotal,
  } = parsed;
  const subtotal = lineSubtotal;
  const tax = subtotal * 0.08;
  const total = subtotal + tax;
  const buyerReference = readStr(rec, "buyerReference");
  const rddRaw = readStr(rec, "requestedDeliveryDate");
  const requestedDeliveryDate = rddRaw ? new Date(`${rddRaw}T00:00:00.000Z`) : null;
  if (requestedDeliveryDate && Number.isNaN(requestedDeliveryDate.getTime())) {
    return { rowIndex: row.rowIndex, ok: false, error: "Invalid requestedDeliveryDate." };
  }

  if (buyerRefPolicy === "upsert" && buyerReference) {
    if (purchaseOrderLineMerge === "replace_all") {
      return {
        rowIndex: row.rowIndex,
        ok: false,
        error: "Internal error: replace_all row was not processed by group apply.",
      };
    }
    const existing = await tx.purchaseOrder.findFirst({
      where: { tenantId, buyerReference },
      select: { id: true, supplierId: true },
    });
    if (existing) {
      let headerSupplierId = existing.supplierId;
      if (hasMappedKey(rec, "supplierId")) {
        const sid = readStr(rec, "supplierId");
        if (!sid) {
          return { rowIndex: row.rowIndex, ok: false, error: "supplierId cannot be empty when provided." };
        }
        const supplier = await tx.supplier.findFirst({
          where: { id: sid, tenantId, isActive: true },
          select: { id: true },
        });
        if (!supplier) {
          return { rowIndex: row.rowIndex, ok: false, error: "Supplier not found or inactive." };
        }
        headerSupplierId = sid;
      }
      if (supplierId !== headerSupplierId) {
        return {
          rowIndex: row.rowIndex,
          ok: false,
          error: "Line supplierId must match purchase order supplier (or header supplierId patch).",
        };
      }

      const existingLine = await tx.purchaseOrderItem.findFirst({
        where: { orderId: existing.id, lineNo },
        select: { id: true },
      });
      if (existingLine) {
        await tx.purchaseOrderItem.update({
          where: { id: existingLine.id },
          data: {
            productId,
            description,
            quantity,
            unitPrice,
            lineTotal,
          },
        });
      } else {
        await tx.purchaseOrderItem.create({
          data: {
            orderId: existing.id,
            lineNo,
            productId,
            description,
            quantity,
            unitPrice,
            lineTotal,
          },
        });
      }

      const header: Prisma.PurchaseOrderUpdateInput = {
        requester: { connect: { id: actorUserId } },
      };
      if (hasMappedKey(rec, "title")) {
        header.title = readStr(rec, "title");
      }
      if (hasMappedKey(rec, "supplierId")) {
        header.supplier = { connect: { id: headerSupplierId } };
      }
      if (hasMappedKey(rec, "requestedDeliveryDate")) {
        const rddKey = readStr(rec, "requestedDeliveryDate");
        const rdd = rddKey ? new Date(`${rddKey}T00:00:00.000Z`) : null;
        if (rdd && Number.isNaN(rdd.getTime())) {
          return { rowIndex: row.rowIndex, ok: false, error: "Invalid requestedDeliveryDate." };
        }
        header.requestedDeliveryDate = rdd;
      }
      const herr = appendPurchaseOrderHeaderScalarsFromRecord(rec, header);
      if (herr) {
        return { rowIndex: row.rowIndex, ok: false, error: herr };
      }
      await tx.purchaseOrder.update({
        where: { id: existing.id },
        data: header,
      });

      await recomputePurchaseOrderTotalsFromItems(tx, existing.id);
      return {
        rowIndex: row.rowIndex,
        ok: true,
        entityType: "PurchaseOrder",
        entityId: existing.id,
        applyOp: "updated",
      };
    }
  }

  if (buyerRefPolicy === "reject_duplicate" && buyerReference) {
    try {
      await assertNoPurchaseOrderBuyerReferenceConflict(tx, tenantId, buyerReference);
    } catch {
      return {
        rowIndex: row.rowIndex,
        ok: false,
        error: `Duplicate purchase order buyerReference for tenant (${buyerReference}).`,
      };
    }
  }

  const { workflowId, statusId } = await loadDefaultWorkflowStart(tx, tenantId);
  const orderNumber = readStr(rec, "orderNumber") || (await nextOrderNumberInTx(tx, tenantId));
  const poHeaderPatch: Prisma.PurchaseOrderUpdateInput = {};
  const phErr = appendPurchaseOrderHeaderScalarsFromRecord(rec, poHeaderPatch);
  if (phErr) {
    return { rowIndex: row.rowIndex, ok: false, error: phErr };
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
            quantity,
            unitPrice,
            lineTotal,
          },
        ],
      },
      ...(poHeaderPatch as object),
    },
    select: { id: true },
  });
  return {
    rowIndex: row.rowIndex,
    ok: true,
    entityType: "PurchaseOrder",
    entityId: created.id,
    applyOp: "created",
  };
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

function dryRunSalesOrderRow(
  row: ApiHubMappedApplyRow,
  opts?: { upsert?: boolean },
): ApiHubStagingApplyRowResult {
  const rec = asRecord(row.mappedRecord);
  if (!rec) {
    return { rowIndex: row.rowIndex, ok: false, error: "mappedRecord must be an object." };
  }
  const customerId = readStr(rec, "customerCrmAccountId");
  const externalRef = readStr(rec, "externalRef");
  if (opts?.upsert) {
    if (!externalRef) {
      return { rowIndex: row.rowIndex, ok: false, error: "externalRef is required." };
    }
    if (!customerId) {
      return { rowIndex: row.rowIndex, ok: true, entityType: "SalesOrder", entityId: "(dry-run)" };
    }
  } else if (!customerId) {
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

export async function dryRunPurchaseOrderBuyerReferenceConflicts(
  tenantId: string,
  rows: ApiHubMappedApplyRow[],
): Promise<{ rowIndex: number; buyerReference: string } | null> {
  for (const row of rows) {
    const rec = asRecord(row.mappedRecord);
    const buyerReference = rec ? readStr(rec, "buyerReference") : null;
    if (!buyerReference) continue;
    const existing = await prisma.purchaseOrder.findFirst({
      where: { tenantId, buyerReference },
      select: { id: true },
    });
    if (existing) {
      return { rowIndex: row.rowIndex, buyerReference };
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
    salesOrderExternalRefPolicy: ApiHubSalesOrderExternalRefPolicy;
    purchaseOrderBuyerRefPolicy: ApiHubPurchaseOrderBuyerRefPolicy;
    /**
     * PO upsert only (ignored otherwise). Defaults to **`merge_by_line_no`**.
     * **`replace_all`** groups rows by `buyerReference` and replaces all lines per PO in one step.
     */
    purchaseOrderLineMerge?: ApiHubPurchaseOrderLineMergeMode;
  },
): Promise<ApiHubStagingApplySummary> {
  const sorted = [...input.rows].sort((a, b) => a.rowIndex - b.rowIndex);
  const outRows: ApiHubStagingApplyRowResult[] = [];
  const consumed = new Set<number>();

  const lineMerge = input.purchaseOrderLineMerge ?? "merge_by_line_no";
  const poReplaceAll =
    input.target === "purchase_order" &&
    input.purchaseOrderBuyerRefPolicy === "upsert" &&
    lineMerge === "replace_all";

  if (poReplaceAll) {
    const groups = new Map<string, ApiHubMappedApplyRow[]>();
    for (const row of sorted) {
      const rec = asRecord(row.mappedRecord);
      const br = rec ? readStr(rec, "buyerReference") : null;
      if (!br) continue;
      const arr = groups.get(br) ?? [];
      arr.push(row);
      groups.set(br, arr);
    }
    for (const [, groupRows] of groups) {
      const gr = [...groupRows].sort((a, b) => a.rowIndex - b.rowIndex);
      const groupResults = await applyPoBuyerRefReplaceAllGroup(tx, {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        groupRows: gr,
      });
      for (const r of groupResults) {
        outRows.push(r);
        if (!r.ok) {
          throw new Error(r.error ?? "Row apply failed.");
        }
        consumed.add(r.rowIndex);
      }
    }
  }

  for (const row of sorted) {
    if (consumed.has(row.rowIndex)) continue;
    let r: ApiHubStagingApplyRowResult;
    if (input.target === "sales_order") {
      r = await applySalesOrderRowLive(tx, {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        row,
        externalRefPolicy: input.salesOrderExternalRefPolicy,
      });
    } else if (input.target === "purchase_order") {
      r = await applyPurchaseOrderRowLive(tx, {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        row,
        buyerRefPolicy: input.purchaseOrderBuyerRefPolicy,
        purchaseOrderLineMerge: poReplaceAll ? "merge_by_line_no" : lineMerge,
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
  outRows.sort((a, b) => a.rowIndex - b.rowIndex);
  return { target: input.target, dryRun: false, rows: outRows };
}

export async function dryRunMappedRowsPreview(input: {
  tenantId: string;
  target: ApiHubStagingApplyTarget;
  rows: ApiHubMappedApplyRow[];
  /** When true, SO rows may omit `customerCrmAccountId` if `externalRef` is set (upsert patch). */
  salesOrderUpsert?: boolean;
}): Promise<ApiHubStagingApplySummary> {
  const sorted = [...input.rows].sort((a, b) => a.rowIndex - b.rowIndex);
  const outRows: ApiHubStagingApplyRowResult[] = [];
  for (const row of sorted) {
    if (input.target === "sales_order") {
      outRows.push(dryRunSalesOrderRow(row, { upsert: input.salesOrderUpsert === true }));
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
    if (r.applyOp === "updated") {
      updated += 1;
    } else {
      created += 1;
    }
  }
  return { created, updated, skipped: 0 };
}
