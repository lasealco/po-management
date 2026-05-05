/**
 * BF-92 — optional denied-party / sanctions-style HTTP screening before `mark_outbound_shipped`.
 * When `WMS_DENIED_PARTY_SCREENING_URL` is unset, evaluation is skipped (allow).
 */

export const DENIED_PARTY_SCREENING_SCHEMA_VERSION = "bf92.v1";

export type DeniedPartyScreeningPartyBf92 =
  | {
      role: "SHIP_TO";
      name: string | null;
      line1: string | null;
      city: string | null;
      countryCode: string | null;
    }
  | {
      role: "CRM_ACCOUNT";
      accountId: string;
      name: string | null;
      legalName: string | null;
    };

export type DeniedPartyScreeningPayloadBf92 = {
  schemaVersion: typeof DENIED_PARTY_SCREENING_SCHEMA_VERSION;
  action: "mark_outbound_shipped";
  tenantId: string;
  actorUserId: string;
  outboundOrderId: string;
  outboundNo: string;
  warehouseId: string;
  customerRef: string | null;
  parties: DeniedPartyScreeningPartyBf92[];
};

function deniedPartyScreeningTimeoutMs(): number {
  const raw = process.env.WMS_DENIED_PARTY_SCREENING_TIMEOUT_MS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 3000;
  if (!Number.isFinite(n)) return 3000;
  return Math.min(30_000, Math.max(100, n));
}

export function deniedPartyScreeningFailOpenFromEnv(): boolean {
  return /^1|true|yes$/i.test(process.env.WMS_DENIED_PARTY_SCREENING_FAIL_OPEN?.trim() ?? "");
}

/** Operator-visible flags only (no URLs or secrets). */
export function deniedPartyScreeningBf92DashboardMeta(): {
  schemaVersion: typeof DENIED_PARTY_SCREENING_SCHEMA_VERSION;
  enabled: boolean;
  timeoutMs: number;
  failOpen: boolean;
  bearerConfigured: boolean;
} {
  return {
    schemaVersion: DENIED_PARTY_SCREENING_SCHEMA_VERSION,
    enabled: Boolean(process.env.WMS_DENIED_PARTY_SCREENING_URL?.trim()),
    timeoutMs: deniedPartyScreeningTimeoutMs(),
    failOpen: deniedPartyScreeningFailOpenFromEnv(),
    bearerConfigured: Boolean(process.env.WMS_DENIED_PARTY_SCREENING_BEARER_TOKEN?.trim()),
  };
}

function truncPartyField(s: string | null | undefined, max: number): string | null {
  const t = String(s ?? "").trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

export function buildDeniedPartyScreeningPayloadBf92(params: {
  tenantId: string;
  actorUserId: string;
  order: {
    id: string;
    outboundNo: string;
    warehouseId: string;
    customerRef: string | null;
    shipToName: string | null;
    shipToLine1: string | null;
    shipToCity: string | null;
    shipToCountryCode: string | null;
    crmAccount: { id: string; name: string; legalName: string | null } | null;
  };
}): DeniedPartyScreeningPayloadBf92 {
  const parties: DeniedPartyScreeningPartyBf92[] = [];

  const shipName = truncPartyField(params.order.shipToName, 240);
  const shipLine1 = truncPartyField(params.order.shipToLine1, 240);
  const shipCity = truncPartyField(params.order.shipToCity, 120);
  const shipCcRaw = String(params.order.shipToCountryCode ?? "").trim().toUpperCase();
  const shipCc = shipCcRaw.length >= 2 ? shipCcRaw.slice(0, 2) : null;

  if (shipName || shipLine1 || shipCity || shipCc) {
    parties.push({
      role: "SHIP_TO",
      name: shipName,
      line1: shipLine1,
      city: shipCity,
      countryCode: shipCc,
    });
  }

  if (params.order.crmAccount) {
    const ca = params.order.crmAccount;
    parties.push({
      role: "CRM_ACCOUNT",
      accountId: ca.id,
      name: truncPartyField(ca.name, 240),
      legalName: truncPartyField(ca.legalName, 240),
    });
  }

  return {
    schemaVersion: DENIED_PARTY_SCREENING_SCHEMA_VERSION,
    action: "mark_outbound_shipped",
    tenantId: params.tenantId,
    actorUserId: params.actorUserId,
    outboundOrderId: params.order.id,
    outboundNo: params.order.outboundNo,
    warehouseId: params.order.warehouseId,
    customerRef: truncPartyField(params.order.customerRef, 160),
    parties,
  };
}

export type DeniedPartyScreeningEvaluateResult =
  | { ok: true }
  | { ok: false; httpStatus: number; message: string };

function interpretAllowDenyJson(parsed: unknown, failOpen: boolean): DeniedPartyScreeningEvaluateResult {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    if (failOpen) return { ok: true };
    return {
      ok: false,
      httpStatus: 503,
      message: "Denied-party screening response must be a JSON object with allow: boolean.",
    };
  }

  const o = parsed as Record<string, unknown>;
  if (o.allow === true) return { ok: true };

  if (o.allow === false) {
    const reason =
      typeof o.reason === "string" && o.reason.trim()
        ? o.reason.trim().slice(0, 500)
        : "Denied-party screening blocked this shipment.";
    return { ok: false, httpStatus: 403, message: reason };
  }

  if (failOpen) return { ok: true };
  return {
    ok: false,
    httpStatus: 503,
    message: "Denied-party screening JSON must include allow: true or allow: false.",
  };
}

export async function evaluateDeniedPartyScreeningBf92(
  payload: DeniedPartyScreeningPayloadBf92,
): Promise<DeniedPartyScreeningEvaluateResult> {
  const url = process.env.WMS_DENIED_PARTY_SCREENING_URL?.trim();
  if (!url) return { ok: true };

  const timeoutMs = deniedPartyScreeningTimeoutMs();
  const failOpen = deniedPartyScreeningFailOpenFromEnv();
  const bearer = process.env.WMS_DENIED_PARTY_SCREENING_BEARER_TOKEN?.trim();

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (bearer) headers.Authorization = `Bearer ${bearer}`;

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: ac.signal,
    });

    const text = await res.text();

    if (!res.ok) {
      if (failOpen) return { ok: true };
      return {
        ok: false,
        httpStatus: 503,
        message: `Denied-party screening returned HTTP ${res.status}.`,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      if (failOpen) return { ok: true };
      return {
        ok: false,
        httpStatus: 503,
        message: "Denied-party screening response is not valid JSON.",
      };
    }

    return interpretAllowDenyJson(parsed, failOpen);
  } catch (e) {
    if (failOpen) return { ok: true };
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      ok: false,
      httpStatus: 503,
      message: aborted ? "Denied-party screening request timed out." : "Denied-party screening request failed.",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function evaluateDeniedPartyScreeningBf92ForMarkOutboundShipped(params: {
  tenantId: string;
  actorUserId: string;
  order: {
    id: string;
    outboundNo: string;
    warehouseId: string;
    customerRef: string | null;
    shipToName: string | null;
    shipToLine1: string | null;
    shipToCity: string | null;
    shipToCountryCode: string | null;
    crmAccount: { id: string; name: string; legalName: string | null } | null;
  };
}): Promise<DeniedPartyScreeningEvaluateResult> {
  const payload = buildDeniedPartyScreeningPayloadBf92(params);
  return evaluateDeniedPartyScreeningBf92(payload);
}
