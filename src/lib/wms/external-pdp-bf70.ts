/**
 * BF-70 — optional HTTP policy decision point before `POST /api/wms` (after BF-06/BF-48 gates).
 * When `WMS_EXTERNAL_PDP_URL` is unset, evaluation is skipped (allow).
 */

export const EXTERNAL_PDP_SCHEMA_VERSION = "bf70.v1";

const SENSITIVE_KEY = /secret|password|token|signing|authorization|credential|apikey/i;

/** Caps + redacts obvious secret fields; tolerates non-plain values. */
export function sanitizeWmsBodyForExternalPdp(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let n = 0;
  const maxKeys = 48;
  for (const [k, v] of Object.entries(body)) {
    if (n >= maxKeys) break;
    if (SENSITIVE_KEY.test(k)) continue;
    if (v === null || typeof v === "boolean" || typeof v === "number") {
      out[k] = v;
    } else if (typeof v === "string") {
      out[k] = v.length > 1024 ? `${v.slice(0, 1024)}…` : v;
    } else {
      try {
        const s = JSON.stringify(v);
        out[k] = s.length > 2048 ? `${s.slice(0, 2048)}…` : JSON.parse(s) as unknown;
      } catch {
        out[k] = "[unserializable]";
      }
    }
    n += 1;
  }
  return out;
}

function externalPdpTimeoutMs(): number {
  const raw = process.env.WMS_EXTERNAL_PDP_TIMEOUT_MS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 3000;
  if (!Number.isFinite(n)) return 3000;
  return Math.min(30_000, Math.max(100, n));
}

export function externalPdpFailOpenFromEnv(): boolean {
  return /^1|true|yes$/i.test(process.env.WMS_EXTERNAL_PDP_FAIL_OPEN?.trim() ?? "");
}

/** Non-secret flags for dashboard / operators (URL host is not exposed). */
export function externalPdpBf70DashboardMeta(): {
  schemaVersion: typeof EXTERNAL_PDP_SCHEMA_VERSION;
  enabled: boolean;
  timeoutMs: number;
  failOpen: boolean;
} {
  return {
    schemaVersion: EXTERNAL_PDP_SCHEMA_VERSION,
    enabled: Boolean(process.env.WMS_EXTERNAL_PDP_URL?.trim()),
    timeoutMs: externalPdpTimeoutMs(),
    failOpen: externalPdpFailOpenFromEnv(),
  };
}

export type ExternalPdpEvaluateResult =
  | { ok: true }
  | { ok: false; httpStatus: number; message: string };

export async function evaluateExternalWmsPolicy(params: {
  tenantId: string;
  actorUserId: string;
  action: string;
  body: Record<string, unknown>;
}): Promise<ExternalPdpEvaluateResult> {
  const url = process.env.WMS_EXTERNAL_PDP_URL?.trim();
  if (!url) return { ok: true };

  const timeoutMs = externalPdpTimeoutMs();
  const failOpen = externalPdpFailOpenFromEnv();

  const payload = {
    schemaVersion: EXTERNAL_PDP_SCHEMA_VERSION,
    tenantId: params.tenantId,
    actorUserId: params.actorUserId,
    action: params.action,
    body: sanitizeWmsBodyForExternalPdp(params.body),
  };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: ac.signal,
    });

    const text = await res.text();

    if (!res.ok) {
      if (failOpen) return { ok: true };
      return {
        ok: false,
        httpStatus: 503,
        message: `External PDP returned HTTP ${res.status}.`,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      if (failOpen) return { ok: true };
      return { ok: false, httpStatus: 503, message: "External PDP response is not valid JSON." };
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      if (failOpen) return { ok: true };
      return {
        ok: false,
        httpStatus: 503,
        message: "External PDP JSON must be an object with allow: boolean.",
      };
    }

    const o = parsed as Record<string, unknown>;
    if (o.allow === true) return { ok: true };

    if (o.allow === false) {
      const reason =
        typeof o.reason === "string" && o.reason.trim()
          ? o.reason.trim().slice(0, 500)
          : "External policy denied this action.";
      return { ok: false, httpStatus: 403, message: reason };
    }

    if (failOpen) return { ok: true };
    return {
      ok: false,
      httpStatus: 503,
      message: "External PDP JSON must include allow: true or allow: false.",
    };
  } catch (e) {
    if (failOpen) return { ok: true };
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      ok: false,
      httpStatus: 503,
      message: aborted ? "External PDP request timed out." : "External PDP request failed.",
    };
  } finally {
    clearTimeout(timer);
  }
}
