/**
 * BF-66 — vendor-neutral voice pick JSON session stub.
 * `GET /api/wms/voice-pick/session` builds this shape; `POST` submits confirmations.
 */

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { syncOutboundOrderStatusAfterPick } from "@/lib/wms/outbound-workflow";

export const VOICE_PICK_SCHEMA_VERSION = "bf66.v1" as const;

export type VoicePickSessionPickV1 = {
  pickSeq: number;
  taskId: string;
  /** Token the operator should confirm (SKU preferred, else product code). */
  confirmSku: string;
  /** Quantity for voice confirmation (same as pick line qty). */
  qtySpoken: number;
  /** Canonical string decimal from WMS. */
  qtyExpected: string;
  binCode: string;
  binName: string;
  warehouseCode: string | null;
  warehouseName: string;
  productName: string;
  lotCode: string;
  waveId: string | null;
  waveNo: string | null;
  outboundOrderId: string | null;
  outboundOrderNo: string | null;
  outboundLineNo: number | null;
};

/** Choose voice SKU token: non-empty sku, else productCode, else short id hint. */
export function voicePickConfirmToken(product: {
  id: string;
  sku: string | null;
  productCode: string | null;
}): string {
  const sku = product.sku?.trim();
  if (sku) return sku;
  const code = product.productCode?.trim();
  if (code) return code;
  return product.id.slice(0, 8);
}

export function voicePickSkuMatchesConfirm(confirmRaw: string, product: { sku: string | null; productCode: string | null }): boolean {
  const c = confirmRaw.trim().toUpperCase();
  if (!c) return false;
  const sku = (product.sku ?? "").trim().toUpperCase();
  const code = (product.productCode ?? "").trim().toUpperCase();
  return c === sku || (code.length > 0 && c === code);
}

export function voicePickQtyMatchesExpected(taskQty: Prisma.Decimal, spoken: number): boolean {
  if (!Number.isFinite(spoken)) return false;
  const exp = Number(taskQty);
  if (!Number.isFinite(exp)) return false;
  return Math.abs(exp - spoken) < 1e-5;
}

export type VoicePickConfirmInput = { taskId: string; confirmSku: string; qtySpoken: number };

export type ParseVoicePickPostResult =
  | { ok: true; picks: VoicePickConfirmInput[] }
  | { ok: false; message: string };

export function parseVoicePickPostBody(raw: unknown): ParseVoicePickPostResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "Body must be a JSON object." };
  }
  const o = raw as Record<string, unknown>;
  const picksRaw = o.picks;
  if (!Array.isArray(picksRaw) || picksRaw.length === 0) {
    return { ok: false, message: "picks must be a non-empty array." };
  }
  if (picksRaw.length > 80) {
    return { ok: false, message: "At most 80 picks per request." };
  }
  const seen = new Set<string>();
  const picks: VoicePickConfirmInput[] = [];
  for (let i = 0; i < picksRaw.length; i++) {
    const row = picksRaw[i];
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return { ok: false, message: `picks[${i}] must be an object.` };
    }
    const r = row as Record<string, unknown>;
    const taskId = typeof r.taskId === "string" ? r.taskId.trim() : "";
    if (!taskId) {
      return { ok: false, message: `picks[${i}].taskId required.` };
    }
    if (seen.has(taskId)) {
      return { ok: false, message: `Duplicate taskId ${taskId}.` };
    }
    seen.add(taskId);
    const confirmSku = typeof r.confirmSku === "string" ? r.confirmSku : "";
    if (!confirmSku.trim()) {
      return { ok: false, message: `picks[${i}].confirmSku required.` };
    }
    const qtyRaw = r.qtySpoken;
    const qtySpoken = typeof qtyRaw === "number" ? qtyRaw : typeof qtyRaw === "string" ? Number(qtyRaw) : NaN;
    if (!Number.isFinite(qtySpoken) || qtySpoken <= 0) {
      return { ok: false, message: `picks[${i}].qtySpoken must be a positive number.` };
    }
    picks.push({ taskId, confirmSku, qtySpoken });
  }
  return { ok: true, picks };
}

export type VoicePickExecuteResult =
  | { ok: true; completedTaskIds: string[] }
  | { ok: false; message: string; status: number };

/**
 * Validates and completes OPEN pick tasks (same inventory effect as `complete_pick_task`).
 */
export async function executeVoicePickConfirmations(
  tenantId: string,
  actorId: string,
  confirmations: VoicePickConfirmInput[],
): Promise<VoicePickExecuteResult> {
  if (confirmations.length === 0) {
    return { ok: false, message: "No picks to confirm.", status: 400 };
  }

  const taskIds = confirmations.map((c) => c.taskId);
  const tasks = await prisma.wmsTask.findMany({
    where: {
      id: { in: taskIds },
      tenantId,
      status: "OPEN",
      taskType: "PICK",
    },
    include: {
      product: { select: { id: true, sku: true, productCode: true, name: true } },
      bin: { select: { id: true, code: true, name: true } },
    },
  });
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  if (tasks.length !== taskIds.length) {
    return { ok: false, message: "One or more pick tasks not found or not OPEN.", status: 404 };
  }

  for (let i = 0; i < confirmations.length; i++) {
    const c = confirmations[i]!;
    const task = taskMap.get(c.taskId)!;
    if (!task.productId || !task.binId || !task.product) {
      return { ok: false, message: `Task ${c.taskId} missing product or bin.`, status: 400 };
    }
    if (!voicePickSkuMatchesConfirm(c.confirmSku, task.product)) {
      return {
        ok: false,
        message: `picks[${i}] confirmSku does not match task product.`,
        status: 400,
      };
    }
    if (!voicePickQtyMatchesExpected(task.quantity, c.qtySpoken)) {
      return {
        ok: false,
        message: `picks[${i}] qtySpoken does not match task quantity.`,
        status: 400,
      };
    }
  }

  const balances = await prisma.inventoryBalance.findMany({
    where: {
      tenantId,
      OR: tasks.map((t) => ({
        warehouseId: t.warehouseId,
        binId: t.binId!,
        productId: t.productId!,
        lotCode: t.lotCode,
      })),
    },
    select: { id: true, warehouseId: true, binId: true, productId: true, lotCode: true, onHandQty: true, allocatedQty: true, onHold: true },
  });
  const balKey = (w: string, b: string, p: string, l: string) => `${w}|${b}|${p}|${l}`;
  const balByKey = new Map(balances.map((b) => [balKey(b.warehouseId, b.binId, b.productId, b.lotCode), b]));

  const qtySumByBal = new Map<string, number>();
  for (const task of tasks) {
    const key = balKey(task.warehouseId, task.binId!, task.productId!, task.lotCode);
    const prev = qtySumByBal.get(key) ?? 0;
    qtySumByBal.set(key, prev + Number(task.quantity));
  }

  for (const task of tasks) {
    const key = balKey(task.warehouseId, task.binId!, task.productId!, task.lotCode);
    const bal = balByKey.get(key);
    if (!bal) {
      return { ok: false, message: `No inventory balance for task ${task.id}.`, status: 400 };
    }
    if (bal.onHold) {
      return { ok: false, message: `Bin/product on hold for task ${task.id}.`, status: 400 };
    }
  }

  for (const [key, sumQty] of qtySumByBal) {
    const bal = balByKey.get(key);
    if (!bal) continue;
    if (Number(bal.onHandQty) < sumQty) {
      return {
        ok: false,
        message: `Insufficient on-hand stock for combined voice picks (balance ${key}).`,
        status: 400,
      };
    }
    if (Number(bal.allocatedQty) < sumQty) {
      return {
        ok: false,
        message: `Insufficient allocated stock for combined voice picks (balance ${key}).`,
        status: 400,
      };
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const c of confirmations) {
      const task = taskMap.get(c.taskId)!;
      const key = balKey(task.warehouseId, task.binId!, task.productId!, task.lotCode);
      const balPre = balByKey.get(key)!;
      await tx.wmsTask.update({
        where: { id: task.id },
        data: { status: "DONE", completedAt: new Date(), completedById: actorId },
      });
      await tx.inventoryBalance.update({
        where: { id: balPre.id },
        data: {
          onHandQty: { decrement: task.quantity },
          allocatedQty: { decrement: task.quantity },
        },
      });
      await tx.inventoryMovement.create({
        data: {
          tenantId,
          warehouseId: task.warehouseId,
          binId: task.binId!,
          productId: task.productId!,
          movementType: "PICK",
          quantity: task.quantity,
          referenceType: "OUTBOUND_LINE_PICK",
          referenceId: task.referenceId,
          createdById: actorId,
        },
      });
      if (task.referenceId) {
        await tx.outboundOrderLine.updateMany({
          where: { id: task.referenceId, tenantId },
          data: { pickedQty: { increment: task.quantity } },
        });
      }
    }
  });

  const lineIds = [...new Set(tasks.map((t) => t.referenceId).filter(Boolean))] as string[];
  for (const lineId of lineIds) {
    await syncOutboundOrderStatusAfterPick(tenantId, lineId);
  }

  return { ok: true, completedTaskIds: confirmations.map((c) => c.taskId) };
}
