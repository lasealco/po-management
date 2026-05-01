import crypto from "node:crypto";

import { NextResponse } from "next/server";

import {
  buildAuthorizationUrl,
  CP_OIDC_CTX_COOKIE,
  fetchOidcDiscovery,
  generatePkceVerifier,
  pkceChallengeS256,
  readCustomerPortalOidcEnv,
  sealOidcCookiePayload,
} from "@/lib/auth/customer-portal-oidc";
import { httpSessionBase } from "@/lib/http-session-cookie";

export const dynamic = "force-dynamic";

const OIDC_COOKIE_MAX_AGE_SEC = 600;

/**
 * BF-46 — begin OIDC authorization code + PKCE flow for customer portal.
 * Requires env from {@link readCustomerPortalOidcEnv}.
 */
export async function GET(request: Request) {
  const cfg = readCustomerPortalOidcEnv();
  if (!cfg) {
    return NextResponse.redirect(
      new URL("/login?error=customer_portal_oidc_not_configured", request.url),
    );
  }

  let discovery;
  try {
    discovery = await fetchOidcDiscovery(cfg.issuer);
  } catch {
    return NextResponse.redirect(
      new URL("/login?error=customer_portal_oidc_discovery_failed", request.url),
    );
  }

  const st = crypto.randomBytes(24).toString("base64url");
  const nv = crypto.randomBytes(24).toString("base64url");
  const cv = generatePkceVerifier();
  const challenge = pkceChallengeS256(cv);
  const exp = Date.now() + OIDC_COOKIE_MAX_AGE_SEC * 1000;

  const sealed = sealOidcCookiePayload(cfg.cookieSecret, { st, nv, cv, exp });

  const authorize = buildAuthorizationUrl({
    authorizationEndpoint: discovery.authorization_endpoint,
    clientId: cfg.clientId,
    redirectUri: cfg.redirectUri,
    state: st,
    nonce: nv,
    codeChallenge: challenge,
    scope: cfg.scope,
  });

  const res = NextResponse.redirect(authorize);
  const base = httpSessionBase();
  res.cookies.set(CP_OIDC_CTX_COOKIE, sealed, {
    ...base,
    maxAge: OIDC_COOKIE_MAX_AGE_SEC,
    httpOnly: true,
  });
  return res;
}
