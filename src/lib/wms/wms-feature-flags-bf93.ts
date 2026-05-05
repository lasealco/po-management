/**
 * BF-93 — tenant WMS feature-flag bundle (`Tenant.wmsFeatureFlagsJsonBf93`).
 */

export const WMS_FEATURE_FLAGS_BF93_SCHEMA_VERSION = "bf93.v1" as const;

export type WmsFeatureFlagsBf93FlagValue = boolean | number | string | null;

export type WmsFeatureFlagsBf93Stored = {
  schemaVersion: typeof WMS_FEATURE_FLAGS_BF93_SCHEMA_VERSION;
  flags: Record<string, WmsFeatureFlagsBf93FlagValue>;
};

const MAX_FLAG_KEYS = 256;
const MAX_KEY_LENGTH = 64;
const MAX_STRING_LENGTH = 256;
const MAX_JSON_BYTES = 24_576;

const FLAG_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;

export type WmsFeatureFlagsBf93PayloadView = {
  schemaVersion: typeof WMS_FEATURE_FLAGS_BF93_SCHEMA_VERSION;
  flags: Record<string, WmsFeatureFlagsBf93FlagValue>;
  /** Present when stored JSON does not match bf93.v1 (manual DB edit / migration glitch). */
  parseError?: string;
};

function jsonByteLength(obj: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(obj)).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function validateFlagEntries(flags: Record<string, unknown>): { ok: true; flags: Record<string, WmsFeatureFlagsBf93FlagValue> } | { ok: false; error: string } {
  const keys = Object.keys(flags);
  if (keys.length > MAX_FLAG_KEYS) {
    return { ok: false, error: `At most ${MAX_FLAG_KEYS} feature-flag keys allowed.` };
  }
  const out: Record<string, WmsFeatureFlagsBf93FlagValue> = {};
  for (const key of keys) {
    if (!FLAG_KEY_PATTERN.test(key)) {
      const shown = key.length > 48 ? `${key.slice(0, 48)}…` : key;
      return {
        ok: false,
        error: `Invalid flag key "${shown}". Keys must start with a letter and be at most ${MAX_KEY_LENGTH} characters (letters, digits, underscore, dot, hyphen).`,
      };
    }
    const v = flags[key];
    if (v === null || typeof v === "boolean") {
      out[key] = v;
      continue;
    }
    if (typeof v === "number") {
      if (!Number.isFinite(v)) {
        return { ok: false, error: `Flag "${key}" must be a finite number when numeric.` };
      }
      out[key] = v;
      continue;
    }
    if (typeof v === "string") {
      if (v.length > MAX_STRING_LENGTH) {
        return { ok: false, error: `Flag "${key}" string value exceeds ${MAX_STRING_LENGTH} characters.` };
      }
      out[key] = v;
      continue;
    }
    return {
      ok: false,
      error: `Flag "${key}" must be boolean, number, string, or null (nested structures are not supported).`,
    };
  }
  return { ok: true, flags: out };
}

/** Extract flat flag record from POST body: `{ flags: { … } }` or shallow bag (minus schemaVersion). */
export function extractWmsFeatureFlagsBf93FlagBag(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(o, "flags")) {
    const f = o.flags;
    if (!f || typeof f !== "object" || Array.isArray(f)) return null;
    return { ...(f as Record<string, unknown>) };
  }
  const bag = { ...o };
  delete bag.schemaVersion;
  delete bag.flags;
  return bag;
}

export function validateWmsFeatureFlagsBf93FromPost(
  raw: unknown,
): { ok: true; doc: WmsFeatureFlagsBf93Stored } | { ok: false; error: string } {
  const bag = extractWmsFeatureFlagsBf93FlagBag(raw);
  if (bag === null) {
    return {
      ok: false,
      error: "wmsFeatureFlagsBf93 must be a JSON object (use { \"flags\": { … } } or a flat key/value bag).",
    };
  }
  const vr = validateFlagEntries(bag);
  if (!vr.ok) return vr;

  const doc: WmsFeatureFlagsBf93Stored = {
    schemaVersion: WMS_FEATURE_FLAGS_BF93_SCHEMA_VERSION,
    flags: vr.flags,
  };
  if (jsonByteLength(doc) > MAX_JSON_BYTES) {
    return {
      ok: false,
      error: `Feature flags document exceeds ${MAX_JSON_BYTES} bytes when serialized.`,
    };
  }
  return { ok: true, doc };
}

/** Strict read shape from DB / tenant JSON column. */
export function validateWmsFeatureFlagsBf93StoredDocument(
  raw: unknown,
): { ok: true; doc: WmsFeatureFlagsBf93Stored } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Stored feature flags must be a JSON object." };
  }
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== WMS_FEATURE_FLAGS_BF93_SCHEMA_VERSION) {
    return { ok: false, error: `Unexpected schemaVersion for BF-93 (expected ${WMS_FEATURE_FLAGS_BF93_SCHEMA_VERSION}).` };
  }
  const flagsRaw = o.flags;
  if (!flagsRaw || typeof flagsRaw !== "object" || Array.isArray(flagsRaw)) {
    return { ok: false, error: "Stored BF-93 document must include a flags object." };
  }
  const vr = validateFlagEntries(flagsRaw as Record<string, unknown>);
  if (!vr.ok) return vr;
  const doc: WmsFeatureFlagsBf93Stored = {
    schemaVersion: WMS_FEATURE_FLAGS_BF93_SCHEMA_VERSION,
    flags: vr.flags,
  };
  return { ok: true, doc };
}

export function mapWmsFeatureFlagsBf93ForPayload(raw: unknown): WmsFeatureFlagsBf93PayloadView | null {
  if (raw === null || raw === undefined) return null;
  const v = validateWmsFeatureFlagsBf93StoredDocument(raw);
  if (v.ok) {
    return { schemaVersion: v.doc.schemaVersion, flags: v.doc.flags };
  }
  return {
    schemaVersion: WMS_FEATURE_FLAGS_BF93_SCHEMA_VERSION,
    flags: {},
    parseError: v.error,
  };
}
