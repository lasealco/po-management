/**
 * BF-46 — Customer portal OIDC (authorization code + PKCE, JWKS id_token verify).
 */

import crypto from "node:crypto";

import * as jose from "jose";

export const CP_OIDC_CTX_COOKIE = "cp_oidc_ctx";

export type CustomerPortalOidcEnv = {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  cookieSecret: string;
  successPath: string;
  emailClaim: string;
  scope: string;
  /** JWT `aud` — defaults to client id; set when IdP uses a distinct resource indicator (e.g. some Azure setups). */
  audience: string;
};

export function normalizeOidcIssuer(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/** Non-null when all required env vars are present (single-tenant IdP per deployment). */
export function readCustomerPortalOidcEnv(): CustomerPortalOidcEnv | null {
  const issuerRaw = process.env.CUSTOMER_PORTAL_OIDC_ISSUER?.trim();
  const clientId = process.env.CUSTOMER_PORTAL_OIDC_CLIENT_ID?.trim();
  const clientSecret = process.env.CUSTOMER_PORTAL_OIDC_CLIENT_SECRET?.trim();
  const redirectUri = process.env.CUSTOMER_PORTAL_OIDC_REDIRECT_URI?.trim();
  const cookieSecret = process.env.CUSTOMER_PORTAL_OIDC_COOKIE_SECRET?.trim();
  if (!issuerRaw || !clientId || !clientSecret || !redirectUri || !cookieSecret) return null;
  if (cookieSecret.length < 16) return null;

  const issuer = normalizeOidcIssuer(issuerRaw);
  const rawSuccess = process.env.CUSTOMER_PORTAL_OIDC_SUCCESS_REDIRECT?.trim();
  const successPath =
    rawSuccess && rawSuccess.startsWith("/") ? rawSuccess : "/wms/vas-intake";
  const emailClaim = process.env.CUSTOMER_PORTAL_OIDC_EMAIL_CLAIM?.trim() || "email";
  const scope =
    process.env.CUSTOMER_PORTAL_OIDC_SCOPES?.trim() || "openid email profile";
  const audience =
    process.env.CUSTOMER_PORTAL_OIDC_AUDIENCE?.trim() || clientId;

  return {
    issuer,
    clientId,
    clientSecret,
    redirectUri,
    cookieSecret,
    successPath,
    emailClaim,
    scope,
    audience,
  };
}

export type OidcDiscoveryDocument = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
};

let discoveryMemo: { issuerKey: string; at: number; doc: OidcDiscoveryDocument } | null = null;
const DISCOVERY_TTL_MS = 300_000;

export async function fetchOidcDiscovery(issuer: string): Promise<OidcDiscoveryDocument> {
  const now = Date.now();
  if (
    discoveryMemo &&
    discoveryMemo.issuerKey === issuer &&
    now - discoveryMemo.at < DISCOVERY_TTL_MS
  ) {
    return discoveryMemo.doc;
  }

  const url = `${issuer}/.well-known/openid-configuration`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(12_000),
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`oidc_discovery_failed:${String(res.status)}`);
  }
  const doc = (await res.json()) as OidcDiscoveryDocument;
  if (
    !doc?.issuer ||
    !doc.authorization_endpoint ||
    !doc.token_endpoint ||
    !doc.jwks_uri
  ) {
    throw new Error("oidc_discovery_invalid");
  }
  discoveryMemo = { issuerKey: issuer, at: now, doc };
  return doc;
}

export function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}

export function generatePkceVerifier(): string {
  return base64UrlEncode(crypto.randomBytes(32));
}

export function pkceChallengeS256(verifier: string): string {
  const hash = crypto.createHash("sha256").update(verifier, "utf8").digest();
  return base64UrlEncode(Buffer.from(hash));
}

export type OidcCookiePayload = {
  st: string;
  nv: string;
  cv: string;
  exp: number;
};

export function sealOidcCookiePayload(secret: string, payload: OidcCookiePayload): string {
  const json = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", secret).update(json, "utf8").digest("hex");
  const enc = Buffer.from(json, "utf8").toString("base64url");
  return `${enc}.${sig}`;
}

export function openOidcCookiePayload(secret: string, sealed: string): OidcCookiePayload | null {
  const dot = sealed.lastIndexOf(".");
  if (dot <= 0) return null;
  const enc = sealed.slice(0, dot);
  const sig = sealed.slice(dot + 1);
  let json: string;
  try {
    json = Buffer.from(enc, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = crypto.createHmac("sha256", secret).update(json, "utf8").digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(sig, "hex");
    if (a.length !== b.length) return null;
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const p = JSON.parse(json) as OidcCookiePayload;
    if (
      typeof p.st !== "string" ||
      typeof p.nv !== "string" ||
      typeof p.cv !== "string" ||
      typeof p.exp !== "number"
    ) {
      return null;
    }
    if (Date.now() > p.exp) return null;
    return p;
  } catch {
    return null;
  }
}

export function buildAuthorizationUrl(params: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
  scope: string;
}): string {
  const u = new URL(params.authorizationEndpoint);
  u.searchParams.set("client_id", params.clientId);
  u.searchParams.set("redirect_uri", params.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", params.scope);
  u.searchParams.set("state", params.state);
  u.searchParams.set("nonce", params.nonce);
  u.searchParams.set("code_challenge", params.codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

export async function exchangeAuthorizationCode(params: {
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}): Promise<{ id_token: string }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code_verifier: params.codeVerifier,
  });
  const res = await fetch(params.tokenEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`oidc_token_exchange_failed:${String(res.status)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("oidc_token_invalid_json");
  }
  const o = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const id_token = typeof o.id_token === "string" ? o.id_token : "";
  if (!id_token) throw new Error("oidc_missing_id_token");
  return { id_token };
}

function stringClaim(payload: jose.JWTPayload, claim: string): string | null {
  const v = payload[claim];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function verifyCustomerPortalOidcIdToken(params: {
  idToken: string;
  /** Expected `iss` — prefer discovery document issuer string. */
  issuer: string;
  audience: string;
  jwksUri: string;
  expectedNonce: string;
  emailClaim: string;
  clockToleranceSec?: number;
}): Promise<{ sub: string; email: string | null }> {
  const JWKS = jose.createRemoteJWKSet(new URL(params.jwksUri));
  const { payload } = await jose.jwtVerify(params.idToken, JWKS, {
    issuer: params.issuer,
    audience: params.audience,
    clockTolerance: params.clockToleranceSec ?? 60,
  });

  if (payload.nonce !== params.expectedNonce) {
    throw new Error("oidc_nonce_mismatch");
  }

  const sub = typeof payload.sub === "string" ? payload.sub.trim() : "";
  if (!sub) throw new Error("oidc_missing_sub");

  let email = stringClaim(payload, params.emailClaim);
  if (!email && params.emailClaim !== "email") {
    email = stringClaim(payload, "email");
  }
  if (!email) {
    email = stringClaim(payload, "preferred_username");
  }

  return { sub, email };
}
