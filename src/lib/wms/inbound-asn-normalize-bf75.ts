import type { InboundAsnAdviseLineParsed } from "./inbound-asn-advise";
import { parseInboundAsnAdviseLines } from "./inbound-asn-advise";

export const BF75_SCHEMA_VERSION = "bf75.v1" as const;

/** Explicit translator selection; omit to sniff **`bf59_wrap`** vs **`compact_items_v1`**. */
export type Bf75EnvelopeHint = "bf59_wrap" | "compact_items_v1";

export type Bf75NormalizedDocument = {
  schemaVersion: typeof BF75_SCHEMA_VERSION;
  partnerId: string;
  externalAsnId: string;
  asnReference: string | null;
  /** ISO-8601 or null */
  expectedReceiveAt: string | null;
  lines: InboundAsnAdviseLineParsed[];
};

function trimOpt(raw: unknown, max: number): string | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  return s.slice(0, max);
}

function parseIsoOrNull(raw: unknown): string | null {
  const s = trimOpt(raw, 64);
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

function compactItemsToLineInputs(items: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const row = items[i];
    if (!row || typeof row !== "object") {
      throw new Error(`items[${i}] must be an object.`);
    }
    const o = row as Record<string, unknown>;
    out.push({
      lineNo: o.line ?? o.lineNo ?? i + 1,
      productSku: o.sku ?? o.productSku ?? o.productCode,
      productCode: o.productCode ?? o.sku,
      quantityExpected: o.qty ?? o.quantityExpected ?? o.qtyShipped ?? o.quantityShipped,
      uom: o.uom,
      lotCode: o.lotCode ?? o.lot,
    });
  }
  return out;
}

function detectBf75Hint(rec: Record<string, unknown>): Bf75EnvelopeHint | null {
  const ext = typeof rec.externalAsnId === "string" ? rec.externalAsnId.trim() : "";
  if (ext && Array.isArray(rec.lines)) return "bf59_wrap";
  const asnId = typeof rec.asnId === "string" ? rec.asnId.trim() : "";
  if ((asnId || ext) && Array.isArray(rec.items)) return "compact_items_v1";
  return null;
}

/**
 * Turn an opaque partner **`rawEnvelope`** into **`bf75.v1`** normalized lines (BF-59 compatible).
 * Does not touch the database.
 */
export function normalizeInboundAsnEnvelopeBf75(input: {
  partnerId: string;
  rawEnvelope: unknown;
  envelopeHint?: Bf75EnvelopeHint;
}): { ok: true; doc: Bf75NormalizedDocument } | { ok: false; error: string } {
  const partnerId = input.partnerId.trim();
  if (!partnerId) {
    return { ok: false, error: "partnerId is required." };
  }
  if (partnerId.length > 128) {
    return { ok: false, error: "partnerId must be at most 128 characters." };
  }

  if (!input.rawEnvelope || typeof input.rawEnvelope !== "object") {
    return { ok: false, error: "rawEnvelope must be a JSON object." };
  }
  const rec = input.rawEnvelope as Record<string, unknown>;

  const hint = input.envelopeHint ?? detectBf75Hint(rec);
  if (!hint) {
    return {
      ok: false,
      error:
        "Could not detect envelope shape. Use envelopeHint 'bf59_wrap' ({ externalAsnId, lines }) or 'compact_items_v1' ({ asnId or externalAsnId, items[] }).",
    };
  }

  let externalAsnId: string;
  let linesInput: unknown;
  let asnReference: string | null;
  let expectedReceiveAt: string | null;

  if (hint === "bf59_wrap") {
    externalAsnId = trimOpt(rec.externalAsnId, 256) ?? "";
    if (!externalAsnId) {
      return { ok: false, error: "externalAsnId is required for bf59_wrap." };
    }
    linesInput = rec.lines;
    asnReference = trimOpt(rec.asnReference ?? rec.asnRef, 256);
    expectedReceiveAt =
      parseIsoOrNull(rec.expectedReceiveAt) ??
      parseIsoOrNull(rec.shipNoticeDate) ??
      parseIsoOrNull(rec.eta);
  } else {
    externalAsnId =
      trimOpt(rec.asnId, 256) ?? trimOpt(rec.externalAsnId, 256) ?? "";
    if (!externalAsnId) {
      return { ok: false, error: "asnId or externalAsnId is required for compact_items_v1." };
    }
    const items = rec.items;
    if (!Array.isArray(items)) {
      return { ok: false, error: "items must be a non-empty array for compact_items_v1." };
    }
    try {
      linesInput = compactItemsToLineInputs(items);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Invalid items payload." };
    }
    asnReference = trimOpt(rec.asnReference ?? rec.asnRef ?? rec.asnControlNumber, 256);
    expectedReceiveAt =
      parseIsoOrNull(rec.expectedReceiveAt) ??
      parseIsoOrNull(rec.shipNoticeDate) ??
      parseIsoOrNull(rec.eta);
  }

  if (externalAsnId.length > 256) {
    return { ok: false, error: "externalAsnId must be at most 256 characters." };
  }

  const parsed = parseInboundAsnAdviseLines(linesInput);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  return {
    ok: true,
    doc: {
      schemaVersion: BF75_SCHEMA_VERSION,
      partnerId,
      externalAsnId,
      asnReference,
      expectedReceiveAt,
      lines: parsed.lines,
    },
  };
}
