/**
 * BF-71 — aggregated serial closure per outbound logistics unit (subtree rollup).
 */

export const BF71_MANIFEST_SCHEMA = "wms.outbound_serial_manifest.bf71.v1" as const;

export type Bf71SerialRef = {
  serialId: string;
  serialNo: string;
  productId: string;
};

export type Bf71LuSnapshot = {
  id: string;
  scanCode: string;
  parentUnitId: string | null;
  outboundOrderLineId: string | null;
  containedQty: string | null;
};

export type Bf71ManifestUnitV1 = {
  logisticsUnitId: string;
  scanCode: string;
  parentUnitId: string | null;
  outboundOrderLineId: string | null;
  directSerials: Bf71SerialRef[];
  aggregatedSerials: Bf71SerialRef[];
};

export type Bf71ManifestExportV1 = {
  schema: typeof BF71_MANIFEST_SCHEMA;
  generatedAt: string;
  outboundOrderId: string;
  outboundNo: string;
  warehouseCode: string | null;
  status: string;
  ok: boolean;
  errors: string[];
  warnings: string[];
  units: Bf71ManifestUnitV1[];
};

export type Bf71EvaluationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  units: Bf71ManifestUnitV1[];
};

function sortSerialRefs(refs: Bf71SerialRef[]): Bf71SerialRef[] {
  return [...refs].sort((a, b) => a.serialNo.localeCompare(b.serialNo, undefined, { sensitivity: "base" }));
}

function buildChildrenMap(lus: Bf71LuSnapshot[]): Map<string, string[]> {
  const children = new Map<string, string[]>();
  for (const u of lus) {
    if (!u.parentUnitId) continue;
    const list = children.get(u.parentUnitId) ?? [];
    list.push(u.id);
    children.set(u.parentUnitId, list);
  }
  return children;
}

function aggregateSubtreeSerials(
  rootId: string,
  children: Map<string, string[]>,
  direct: Map<string, Bf71SerialRef[]>,
  errors: string[],
): Map<string, Bf71SerialRef> {
  const byId = new Map<string, Bf71SerialRef>();

  function visit(uid: string, stack: Set<string>): void {
    if (stack.has(uid)) {
      errors.push(`Logistics unit hierarchy cycle detected near unit ${uid}.`);
      return;
    }
    stack.add(uid);
    for (const s of direct.get(uid) ?? []) {
      byId.set(s.serialId, s);
    }
    for (const ch of children.get(uid) ?? []) {
      visit(ch, stack);
    }
    stack.delete(uid);
  }

  visit(rootId, new Set());
  return byId;
}

export function evaluateBf71SerialAggregation(input: {
  lus: Bf71LuSnapshot[];
  links: Array<{ logisticsUnitId: string; serial: Bf71SerialRef }>;
  lineProductByLineId: Map<string, string>;
}): Bf71EvaluationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const luById = new Map(input.lus.map((u) => [u.id, u]));
  const direct = new Map<string, Bf71SerialRef[]>();
  const children = buildChildrenMap(input.lus);

  for (const row of input.links) {
    if (!luById.has(row.logisticsUnitId)) {
      errors.push(`Serial link references unknown logistics unit ${row.logisticsUnitId}.`);
      continue;
    }
    const lu = luById.get(row.logisticsUnitId)!;
    if (lu.outboundOrderLineId) {
      const expectedPid = input.lineProductByLineId.get(lu.outboundOrderLineId);
      if (expectedPid && expectedPid !== row.serial.productId) {
        errors.push(
          `Serial ${row.serial.serialNo} (product ${row.serial.productId}) does not match outbound line product for LU ${lu.scanCode}.`,
        );
      }
    }
    const list = direct.get(row.logisticsUnitId) ?? [];
    list.push(row.serial);
    direct.set(row.logisticsUnitId, list);
  }

  const units: Bf71ManifestUnitV1[] = [];
  for (const u of input.lus) {
    const directSerials = sortSerialRefs(direct.get(u.id) ?? []);
    const aggMap = aggregateSubtreeSerials(u.id, children, direct, errors);
    const aggregatedSerials = sortSerialRefs([...aggMap.values()]);

    if (
      u.outboundOrderLineId &&
      u.containedQty != null &&
      Number(u.containedQty) > 0 &&
      aggregatedSerials.length === 0
    ) {
      warnings.push(
        `LU ${u.scanCode} expects packed quantity but no serials are linked in its subtree (BF-71).`,
      );
    }

    units.push({
      logisticsUnitId: u.id,
      scanCode: u.scanCode,
      parentUnitId: u.parentUnitId,
      outboundOrderLineId: u.outboundOrderLineId,
      directSerials,
      aggregatedSerials,
    });
  }

  const ok = errors.length === 0;
  return { ok, errors, warnings, units };
}

export function buildBf71ManifestExportV1(args: {
  outboundOrderId: string;
  outboundNo: string;
  warehouseCode: string | null;
  status: string;
  generatedAt: Date;
  evaluation: Bf71EvaluationResult;
}): Bf71ManifestExportV1 {
  const { evaluation, generatedAt, ...meta } = args;
  return {
    schema: BF71_MANIFEST_SCHEMA,
    generatedAt: generatedAt.toISOString(),
    outboundOrderId: meta.outboundOrderId,
    outboundNo: meta.outboundNo,
    warehouseCode: meta.warehouseCode,
    status: meta.status,
    ok: evaluation.ok,
    errors: evaluation.errors,
    warnings: evaluation.warnings,
    units: evaluation.units,
  };
}

/** Maps an outbound order subgraph from Prisma into the pure BF-71 evaluator. */
export function bf71EvaluationFromLoadedOrder(order: {
  lines: Array<{ id: string; productId: string }>;
  logisticsUnits: Array<{
    id: string;
    scanCode: string;
    parentUnitId: string | null;
    outboundOrderLineId: string | null;
    containedQty: unknown;
    luSerials: Array<{ serial: { id: string; serialNo: string; productId: string } }>;
  }>;
}): Bf71EvaluationResult {
  const lineProductByLineId = new Map(order.lines.map((l) => [l.id, l.productId]));
  const lus: Bf71LuSnapshot[] = order.logisticsUnits.map((u) => ({
    id: u.id,
    scanCode: u.scanCode,
    parentUnitId: u.parentUnitId,
    outboundOrderLineId: u.outboundOrderLineId,
    containedQty: u.containedQty != null ? String(u.containedQty) : null,
  }));
  const links: Array<{ logisticsUnitId: string; serial: Bf71SerialRef }> = [];
  for (const u of order.logisticsUnits) {
    for (const row of u.luSerials) {
      links.push({
        logisticsUnitId: u.id,
        serial: {
          serialId: row.serial.id,
          serialNo: row.serial.serialNo,
          productId: row.serial.productId,
        },
      });
    }
  }
  return evaluateBf71SerialAggregation({ lus, links, lineProductByLineId });
}
