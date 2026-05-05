/**
 * BF-81 — RFID commissioning scan bridge: normalize TID/EPC-style payloads before BF-29 multiset verify.
 */

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { normalizePackScanToken, primaryPackScanCode } from "./pack-scan-verify";

export const RFID_ENCODING_TABLE_SCHEMA_VERSION = "bf81.v1" as const;

export type WmsRfidEncodingTableBf81V1 = {
  schemaVersion: typeof RFID_ENCODING_TABLE_SCHEMA_VERSION;
  enabled: boolean;
  /** Strip these hex prefixes (case-insensitive) from TID scans before map lookups (longest first). */
  tidHexPrefixStrip: string[];
  /** Full TID hex (after stripping non-hex and prefixes, uppercase) → pack token (SKU-style primary expected slot). */
  tidHexToPackToken: Record<string, string>;
  /** TID suffix hex (uppercase) → pack token (longest suffix wins). */
  tidSuffixHexToPackToken: Record<string, string>;
};

export type ParsedRfidEncodingTableBf81 = {
  table: WmsRfidEncodingTableBf81V1 | null;
  notice?: string;
};

function clampHexPrefixList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const h = x.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
    if (h.length > 0) out.push(h);
  }
  return [...new Set(out)].sort((a, b) => b.length - a.length);
}

function clampHexToTokenMap(raw: unknown): Record<string, string> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    const hk = String(k).replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
    if (!hk || typeof v !== "string") continue;
    const tok = normalizePackScanToken(v);
    if (tok) out[hk] = tok;
  }
  return out;
}

/** Parse tenant JSON → resolved table + optional notice (invalid shape disables BF-81 TID maps only). */
export function parseRfidEncodingTableBf81Json(raw: unknown): ParsedRfidEncodingTableBf81 {
  if (raw == null) {
    return { table: null };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { table: null, notice: "RFID encoding JSON must be an object — BF-81 TID maps ignored." };
  }
  const src = raw as Record<string, unknown>;
  const enabled = typeof src.enabled === "boolean" ? src.enabled : false;

  const table: WmsRfidEncodingTableBf81V1 = {
    schemaVersion: RFID_ENCODING_TABLE_SCHEMA_VERSION,
    enabled,
    tidHexPrefixStrip: clampHexPrefixList(src.tidHexPrefixStrip),
    tidHexToPackToken: clampHexToTokenMap(src.tidHexToPackToken),
    tidSuffixHexToPackToken: clampHexToTokenMap(src.tidSuffixHexToPackToken),
  };

  const sv = typeof src.schemaVersion === "string" ? src.schemaVersion.trim() : "";
  if (sv && sv !== RFID_ENCODING_TABLE_SCHEMA_VERSION) {
    return {
      table: enabled ? table : null,
      notice: `Unsupported schemaVersion "${sv}" — treated as ${RFID_ENCODING_TABLE_SCHEMA_VERSION}.`,
    };
  }

  return { table: enabled ? table : null };
}

/** Normalize draft from POST → JSON suitable for `Tenant.wmsRfidEncodingTableJsonBf81`. */
export function rfidEncodingTableBf81ToStoredJson(table: WmsRfidEncodingTableBf81V1): Prisma.InputJsonValue {
  return table as unknown as Prisma.InputJsonValue;
}

export function validateRfidEncodingTableBf81DraftFromPost(input: unknown):
  | { ok: true; value: WmsRfidEncodingTableBf81V1 }
  | { ok: false; error: string } {
  if (input === null) {
    return { ok: false, error: "Body must be an object — use clear flag to remove policy." };
  }
  if (typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "RFID encoding draft must be a JSON object." };
  }
  const src = input as Record<string, unknown>;
  const enabled = typeof src.enabled === "boolean" ? src.enabled : false;
  const value: WmsRfidEncodingTableBf81V1 = {
    schemaVersion: RFID_ENCODING_TABLE_SCHEMA_VERSION,
    enabled,
    tidHexPrefixStrip: clampHexPrefixList(src.tidHexPrefixStrip),
    tidHexToPackToken: clampHexToTokenMap(src.tidHexToPackToken),
    tidSuffixHexToPackToken: clampHexToTokenMap(src.tidSuffixHexToPackToken),
  };
  return { ok: true, value };
}

/** GS1 pure-identity SSCC tag URI → last 18 digits for LU / multiset hooks. */
export function parseSsccDigitsFromEpcUrn(raw: string): string | null {
  const u = raw.trim();
  const m = /^urn:epc:id:sscc:\s*([0-9.]+)\s*$/i.exec(u);
  if (!m) return null;
  const digits = m[1].replace(/\./g, "").replace(/\D/g, "");
  if (digits.length < 18) return null;
  return digits.slice(-18);
}

function normalizeGtin14Digits(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length < 8 || d.length > 14) return null;
  return d.padStart(14, "0").slice(-14);
}

function productGtin14(product: { ean: string | null }): string | null {
  if (!product.ean?.trim()) return null;
  return normalizeGtin14Digits(product.ean.trim());
}

function stripTidPrefixes(hexUpper: string, prefixes: string[]): string {
  let h = hexUpper;
  for (const p of prefixes) {
    if (p && h.startsWith(p)) h = h.slice(p.length);
  }
  return h;
}

/**
 * Expand one raw wedge token into normalized multiset candidates (order preserved, deduped).
 * When `table` is null, still recognizes numeric GTIN-ish scans vs outbound line `Product.ean` and SSCC URNs.
 */
export function expandOutboundPackScanCandidatesBf81(
  raw: string,
  table: WmsRfidEncodingTableBf81V1 | null,
  lineProducts: Array<{ id: string; sku: string | null; productCode: string | null; ean: string | null }>,
): string[] {
  const s = raw.trim();
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (tok: string) => {
    const n = normalizePackScanToken(tok);
    if (!n || seen.has(n)) return;
    seen.add(n);
    out.push(n);
  };

  push(s);

  const sscc = parseSsccDigitsFromEpcUrn(s);
  if (sscc) push(sscc);

  const digitsOnly = s.replace(/\D/g, "");
  if (digitsOnly.length >= 8 && digitsOnly.length <= 14 && /^\d+$/.test(digitsOnly)) {
    const g14 = normalizeGtin14Digits(digitsOnly);
    if (g14) {
      for (const p of lineProducts) {
        const pg = productGtin14(p);
        if (pg && pg === g14) push(primaryPackScanCode(p));
      }
    }
  }

  if (!table?.enabled) return out;

  const hexRaw = s.replace(/[^0-9A-Fa-f]/gi, "");
  if (hexRaw.length >= 8 && /^[0-9A-F]+$/i.test(hexRaw)) {
    let h = hexRaw.toUpperCase();
    h = stripTidPrefixes(h, table.tidHexPrefixStrip);

    const fullTok = table.tidHexToPackToken[h];
    if (fullTok) push(fullTok);

    const suffixKeys = Object.keys(table.tidSuffixHexToPackToken).sort((a, b) => b.length - a.length);
    for (const suf of suffixKeys) {
      if (suf && h.endsWith(suf)) {
        push(table.tidSuffixHexToPackToken[suf] ?? "");
        break;
      }
    }
  }

  return out;
}

export async function fetchParsedRfidEncodingBf81ForTenant(tenantId: string): Promise<ParsedRfidEncodingTableBf81> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { wmsRfidEncodingTableJsonBf81: true },
  });
  return parseRfidEncodingTableBf81Json(row?.wmsRfidEncodingTableJsonBf81 ?? null);
}
