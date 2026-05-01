import { cookies } from "next/headers";

import { NextResponse } from "next/server";

import {
  CP_OIDC_CTX_COOKIE,
  exchangeAuthorizationCode,
  fetchOidcDiscovery,
  openOidcCookiePayload,
  readCustomerPortalOidcEnv,
  verifyCustomerPortalOidcIdToken,
} from "@/lib/auth/customer-portal-oidc";
import { resolveUserForCustomerPortalSso } from "@/lib/auth/customer-portal-sso";
import { PO_AUTH_USER_COOKIE, PO_DEMO_USER_COOKIE } from "@/lib/demo-actor";
import { getDemoTenant } from "@/lib/demo-tenant";
import { httpSessionBase } from "@/lib/http-session-cookie";

export const dynamic = "force-dynamic";

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;

function redirectWithError(request: Request, code: string): NextResponse {
  const u = new URL("/login", request.url);
  u.searchParams.set("error", code);
  return NextResponse.redirect(u);
}

/**
 * BF-46 — OIDC redirect_uri target: exchanges code, verifies id_token (JWKS, iss, aud, nonce).
 */
export async function GET(request: Request) {
  const cfg = readCustomerPortalOidcEnv();
  if (!cfg) {
    return redirectWithError(request, "customer_portal_oidc_not_configured");
  }

  const url = new URL(request.url);
  if (url.searchParams.get("error")) {
    return redirectWithError(request, "customer_portal_oidc_denied");
  }

  const code = url.searchParams.get("code")?.trim();
  const state = url.searchParams.get("state")?.trim();
  if (!code || !state) {
    return redirectWithError(request, "customer_portal_oidc_missing_code");
  }

  const jar = await cookies();
  const sealed = jar.get(CP_OIDC_CTX_COOKIE)?.value ?? "";
  const payload = openOidcCookiePayload(cfg.cookieSecret, sealed);
  if (!payload || payload.st !== state) {
    return redirectWithError(request, "customer_portal_oidc_bad_state");
  }

  let discovery;
  try {
    discovery = await fetchOidcDiscovery(cfg.issuer);
  } catch {
    return redirectWithError(request, "customer_portal_oidc_discovery_failed");
  }

  let tokens: { id_token: string };
  try {
    tokens = await exchangeAuthorizationCode({
      tokenEndpoint: discovery.token_endpoint,
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      redirectUri: cfg.redirectUri,
      code,
      codeVerifier: payload.cv,
    });
  } catch {
    return redirectWithError(request, "customer_portal_oidc_token_failed");
  }

  let claims: { sub: string; email: string | null };
  try {
    claims = await verifyCustomerPortalOidcIdToken({
      idToken: tokens.id_token,
      issuer: discovery.issuer,
      audience: cfg.audience,
      jwksUri: discovery.jwks_uri,
      expectedNonce: payload.nv,
      emailClaim: cfg.emailClaim,
    });
  } catch {
    return redirectWithError(request, "customer_portal_oidc_id_token_invalid");
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return redirectWithError(request, "customer_portal_oidc_tenant_missing");
  }

  const resolved = await resolveUserForCustomerPortalSso(tenant.id, {
    externalSubject: claims.sub,
    email: claims.email,
  });

  if (!resolved) {
    return redirectWithError(request, "customer_portal_oidc_user_unknown");
  }

  const base = httpSessionBase();
  const dest = new URL(cfg.successPath, request.url);
  const res = NextResponse.redirect(dest);
  res.cookies.set(CP_OIDC_CTX_COOKIE, "", { ...base, maxAge: 0 });
  res.cookies.set(PO_AUTH_USER_COOKIE, resolved.email, { ...base, maxAge: SESSION_MAX_AGE_SEC });
  res.cookies.set(PO_DEMO_USER_COOKIE, "", { ...base, maxAge: 0 });
  return res;
}
