/**
 * BF-76 — deterministic pick path (ordered bin visits) for a wave’s OPEN PICK tasks.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import type { WmsViewReadScope } from "@/lib/wms/wms-read-scope";

export const BF76_SCHEMA_VERSION = "bf76.v1" as const;

export type TopologyBinSortInput = {
  binId: string;
  binCode: string;
  zoneCode: string | null;
  aisleCode: string | null;
  rackCode: string | null;
  bay: string | null;
  level: number | null;
  positionIndex: number | null;
  isCrossDockStaging: boolean;
  isPickFace: boolean;
};

/** Stable warehouse walk order: BF-37 cross-dock staging first → zone → aisle → rack → bay → level → slot → pick-face → code. */
export function compareBinsTopology(a: TopologyBinSortInput, b: TopologyBinSortInput): number {
  const xd = Number(b.isCrossDockStaging) - Number(a.isCrossDockStaging);
  if (xd !== 0) return xd;
  const z = (a.zoneCode ?? "\uFFFF").localeCompare(b.zoneCode ?? "\uFFFF");
  if (z !== 0) return z;
  const ai = (a.aisleCode ?? "\uFFFF").localeCompare(b.aisleCode ?? "\uFFFF");
  if (ai !== 0) return ai;
  const r = (a.rackCode ?? "\uFFFF").localeCompare(b.rackCode ?? "\uFFFF");
  if (r !== 0) return r;
  const bay = (a.bay ?? "\uFFFF").localeCompare(b.bay ?? "\uFFFF");
  if (bay !== 0) return bay;
  const la = a.level ?? Number.MAX_SAFE_INTEGER;
  const lb = b.level ?? Number.MAX_SAFE_INTEGER;
  if (la !== lb) return la - lb;
  const pa = a.positionIndex ?? Number.MAX_SAFE_INTEGER;
  const pb = b.positionIndex ?? Number.MAX_SAFE_INTEGER;
  if (pa !== pb) return pa - pb;
  const pf = Number(b.isPickFace) - Number(a.isPickFace);
  if (pf !== 0) return pf;
  const bc = a.binCode.localeCompare(b.binCode);
  if (bc !== 0) return bc;
  return a.binId.localeCompare(b.binId);
}

export type Bf76PickPathLine = {
  taskId: string;
  outboundOrderId: string | null;
  outboundNo: string | null;
  lineNo: number | null;
  productSku: string | null;
  quantity: string;
  lotCode: string;
  batchGroupKey: string | null;
};

export type Bf76PickPathVisit = {
  visitSeq: number;
  binId: string | null;
  binCode: string | null;
  zoneCode: string | null;
  aisleCode: string | null;
  rackCode: string | null;
  bay: string | null;
  level: number | null;
  positionIndex: number | null;
  batchGroupKey: string | null;
  lines: Bf76PickPathLine[];
};

export type Bf76PickPathExport = {
  schemaVersion: typeof BF76_SCHEMA_VERSION;
  generatedAt: string;
  waveId: string;
  waveNo: string;
  waveStatus: string;
  pickMode: string;
  warehouseId: string;
  warehouseCode: string | null;
  openPickTaskCount: number;
  visitCount: number;
  visits: Bf76PickPathVisit[];
};

function csvEscape(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function pickPathExportToCsv(doc: Bf76PickPathExport): string {
  const header = [
    "visitSeq",
    "binCode",
    "zoneCode",
    "aisleCode",
    "rackCode",
    "bay",
    "level",
    "positionIndex",
    "taskId",
    "outboundNo",
    "lineNo",
    "sku",
    "quantity",
    "lotCode",
    "batchGroupKey",
  ].join(",");
  const lines: string[] = [header];
  for (const v of doc.visits) {
    for (const ln of v.lines) {
      lines.push(
        [
          String(v.visitSeq),
          csvEscape(v.binCode ?? ""),
          csvEscape(v.zoneCode ?? ""),
          csvEscape(v.aisleCode ?? ""),
          csvEscape(v.rackCode ?? ""),
          csvEscape(v.bay ?? ""),
          v.level != null ? String(v.level) : "",
          v.positionIndex != null ? String(v.positionIndex) : "",
          csvEscape(ln.taskId),
          csvEscape(ln.outboundNo ?? ""),
          ln.lineNo != null ? String(ln.lineNo) : "",
          csvEscape(ln.productSku ?? ""),
          csvEscape(ln.quantity),
          csvEscape(ln.lotCode),
          csvEscape(ln.batchGroupKey ?? v.batchGroupKey ?? ""),
        ].join(","),
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

type TaskRow = Prisma.WmsTaskGetPayload<{
  include: {
    bin: {
      select: {
        id: true;
        code: true;
        rackCode: true;
        aisle: true;
        bay: true;
        level: true;
        positionIndex: true;
        isCrossDockStaging: true;
        isPickFace: true;
        zone: { select: { code: true } };
        warehouseAisle: { select: { code: true } };
      };
    };
    product: { select: { sku: true; productCode: true } };
  };
}>;

function topologyFromBin(bin: NonNullable<TaskRow["bin"]>): TopologyBinSortInput {
  return {
    binId: bin.id,
    binCode: bin.code,
    zoneCode: bin.zone?.code ?? null,
    aisleCode: bin.warehouseAisle?.code ?? bin.aisle ?? null,
    rackCode: bin.rackCode ?? null,
    bay: bin.bay ?? null,
    level: bin.level ?? null,
    positionIndex: bin.positionIndex ?? null,
    isCrossDockStaging: bin.isCrossDockStaging,
    isPickFace: bin.isPickFace,
  };
}

function skuToken(p: TaskRow["product"]): string | null {
  if (!p) return null;
  const s = p.sku?.trim();
  if (s) return s;
  const c = p.productCode?.trim();
  return c || null;
}

function sortTasksWithinVisit(a: TaskRow, b: TaskRow, lineMeta: Map<string, OutboundLineLite>): number {
  const ma =
    a.referenceType === "OUTBOUND_LINE_PICK" && a.referenceId
      ? lineMeta.get(a.referenceId)
      : undefined;
  const mb =
    b.referenceType === "OUTBOUND_LINE_PICK" && b.referenceId
      ? lineMeta.get(b.referenceId)
      : undefined;
  const na = ma?.outboundOrder.outboundNo ?? "\uFFFF";
  const nb = mb?.outboundOrder.outboundNo ?? "\uFFFF";
  const oc = na.localeCompare(nb);
  if (oc !== 0) return oc;
  const la = ma?.lineNo ?? Number.MAX_SAFE_INTEGER;
  const lb = mb?.lineNo ?? Number.MAX_SAFE_INTEGER;
  if (la !== lb) return la - lb;
  const bg = (a.batchGroupKey ?? "").localeCompare(b.batchGroupKey ?? "");
  if (bg !== 0) return bg;
  return a.id.localeCompare(b.id);
}

type OutboundLineLite = {
  id: string;
  lineNo: number;
  outboundOrder: { id: string; outboundNo: string };
};

export async function loadPickPathExportBf76(
  prisma: PrismaClient,
  tenantId: string,
  waveId: string,
  viewScope: WmsViewReadScope,
): Promise<{ ok: true; doc: Bf76PickPathExport } | { ok: false; error: string; code: string; status: number }> {
  const wave = await prisma.wmsWave.findFirst({
    where: { AND: [{ id: waveId, tenantId }, viewScope.wmsWave] },
    select: {
      id: true,
      waveNo: true,
      status: true,
      pickMode: true,
      warehouseId: true,
      warehouse: { select: { code: true } },
    },
  });

  if (!wave) {
    return { ok: false, error: "Wave not found.", code: "NOT_FOUND", status: 404 };
  }

  const tasks = await prisma.wmsTask.findMany({
    where: {
      AND: [
        { tenantId, waveId, taskType: "PICK", status: "OPEN" },
        viewScope.wmsTask,
      ],
    },
    include: {
      bin: {
        select: {
          id: true,
          code: true,
          rackCode: true,
          aisle: true,
          bay: true,
          level: true,
          positionIndex: true,
          isCrossDockStaging: true,
          isPickFace: true,
          zone: { select: { code: true } },
          warehouseAisle: { select: { code: true } },
        },
      },
      product: { select: { sku: true, productCode: true } },
    },
  });

  const refIds = [
    ...new Set(
      tasks
        .filter((t) => t.referenceType === "OUTBOUND_LINE_PICK" && t.referenceId)
        .map((t) => t.referenceId as string),
    ),
  ];

  const outboundLines: OutboundLineLite[] =
    refIds.length === 0
      ? []
      : await prisma.outboundOrderLine.findMany({
          where: {
            AND: [
              { id: { in: refIds }, tenantId },
              { outboundOrder: { AND: [{ tenantId }, viewScope.outboundOrder] } },
            ],
          },
          select: {
            id: true,
            lineNo: true,
            outboundOrder: { select: { id: true, outboundNo: true } },
          },
        });

  const lineMeta = new Map(outboundLines.map((r) => [r.id, r]));

  const withBin = tasks.filter((t) => t.binId && t.bin);
  const withoutBin = tasks.filter((t) => !t.binId || !t.bin);

  const byBinId = new Map<string, TaskRow[]>();
  for (const t of withBin) {
    const id = t.binId as string;
    const arr = byBinId.get(id) ?? [];
    arr.push(t);
    byBinId.set(id, arr);
  }

  const sortedBinIds = [...byBinId.keys()].sort((a, b) => {
    const ta = byBinId.get(a)?.[0];
    const tb = byBinId.get(b)?.[0];
    if (!ta?.bin || !tb?.bin) return a.localeCompare(b);
    return compareBinsTopology(topologyFromBin(ta.bin), topologyFromBin(tb.bin));
  });

  const visits: Bf76PickPathVisit[] = [];
  let visitSeq = 0;

  const pushVisit = (v: Omit<Bf76PickPathVisit, "visitSeq">) => {
    visitSeq += 1;
    visits.push({ ...v, visitSeq });
  };

  for (const binId of sortedBinIds) {
    const group = byBinId.get(binId);
    if (!group?.length) continue;
    const sorted = [...group].sort((a, b) => sortTasksWithinVisit(a, b, lineMeta));
    const bin = sorted[0]!.bin!;
    const aisleCode = bin.warehouseAisle?.code ?? bin.aisle ?? null;
    const bg =
      sorted.map((t) => t.batchGroupKey).find((k) => k != null && String(k).trim() !== "") ?? null;
    pushVisit({
      binId: bin.id,
      binCode: bin.code,
      zoneCode: bin.zone?.code ?? null,
      aisleCode,
      rackCode: bin.rackCode ?? null,
      bay: bin.bay ?? null,
      level: bin.level ?? null,
      positionIndex: bin.positionIndex ?? null,
      batchGroupKey: bg,
      lines: sorted.map((t) => {
        const line =
          t.referenceType === "OUTBOUND_LINE_PICK" && t.referenceId
            ? lineMeta.get(t.referenceId)
            : undefined;
        return {
          taskId: t.id,
          outboundOrderId: line?.outboundOrder.id ?? null,
          outboundNo: line?.outboundOrder.outboundNo ?? null,
          lineNo: line?.lineNo ?? null,
          productSku: skuToken(t.product),
          quantity: t.quantity.toString(),
          lotCode: t.lotCode,
          batchGroupKey: t.batchGroupKey ?? null,
        };
      }),
    });
  }

  const orphanSorted = [...withoutBin].sort((a, b) => sortTasksWithinVisit(a, b, lineMeta));
  for (const t of orphanSorted) {
    const line =
      t.referenceType === "OUTBOUND_LINE_PICK" && t.referenceId
        ? lineMeta.get(t.referenceId)
        : undefined;
    pushVisit({
      binId: null,
      binCode: t.batchGroupKey?.trim() || null,
      zoneCode: null,
      aisleCode: null,
      rackCode: null,
      bay: null,
      level: null,
      positionIndex: null,
      batchGroupKey: t.batchGroupKey ?? null,
      lines: [
        {
          taskId: t.id,
          outboundOrderId: line?.outboundOrder.id ?? null,
          outboundNo: line?.outboundOrder.outboundNo ?? null,
          lineNo: line?.lineNo ?? null,
          productSku: skuToken(t.product),
          quantity: t.quantity.toString(),
          lotCode: t.lotCode,
          batchGroupKey: t.batchGroupKey ?? null,
        },
      ],
    });
  }

  const doc: Bf76PickPathExport = {
    schemaVersion: BF76_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    waveId: wave.id,
    waveNo: wave.waveNo,
    waveStatus: wave.status,
    pickMode: wave.pickMode,
    warehouseId: wave.warehouseId,
    warehouseCode: wave.warehouse.code ?? null,
    openPickTaskCount: tasks.length,
    visitCount: visits.length,
    visits,
  };

  return { ok: true, doc };
}
