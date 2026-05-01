import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  resolveUserForCustomerPortalSso,
  verifyCustomerPortalSsoPayload,
} from "@/lib/auth/customer-portal-sso";
import { PO_AUTH_USER_COOKIE, PO_DEMO_USER_COOKIE } from "@/lib/demo-actor";
import { getDemoTenant } from "@/lib/demo-tenant";
import { httpSessionBase } from "@/lib/http-session-cookie";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * BF-30 customer-portal SSO bridge:
 * - Simulate: `CUSTOMER_PORTAL_SSO_SIMULATE_SECRET` + header `x-customer-portal-sso-secret` + JSON `{ externalSubject?, email? }`
 * - Signed: `CUSTOMER_PORTAL_SSO_HMAC_SECRET` + JSON `{ sub, email, ts, sig }` (see `signCustomerPortalSsoPayload`).
 */
export async function POST(request: Request) {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const simulateSecret = process.env.CUSTOMER_PORTAL_SSO_SIMULATE_SECRET?.trim();
  const hmacSecret = process.env.CUSTOMER_PORTAL_SSO_HMAC_SECRET?.trim();

  let resolved: Awaited<ReturnType<typeof resolveUserForCustomerPortalSso>> = null;

  if (simulateSecret) {
    const hdr = request.headers.get("x-customer-portal-sso-secret")?.trim();
    if (hdr === simulateSecret) {
      const externalSubject = typeof o.externalSubject === "string" ? o.externalSubject : "";
      const email = typeof o.email === "string" ? o.email : "";
      if (!externalSubject.trim() && !email.trim()) {
        return toApiErrorResponse({
          error: "Provide externalSubject and/or email for simulate SSO.",
          code: "BAD_INPUT",
          status: 400,
        });
      }
      resolved = await resolveUserForCustomerPortalSso(tenant.id, {
        externalSubject: externalSubject.trim() || null,
        email: email.trim() || null,
      });
    }
  }

  if (!resolved && hmacSecret) {
    const sub = typeof o.sub === "string" ? o.sub : "";
    const email = typeof o.email === "string" ? o.email : "";
    const tsRaw = o.ts;
    const sig = typeof o.sig === "string" ? o.sig : "";
    const ts = typeof tsRaw === "number" ? tsRaw : typeof tsRaw === "string" ? Number(tsRaw) : NaN;
    if (!verifyCustomerPortalSsoPayload(hmacSecret, sub, email, ts, sig)) {
      return toApiErrorResponse({
        error: "Invalid or expired SSO assertion.",
        code: "UNAUTHORIZED",
        status: 401,
      });
    }
    resolved = await resolveUserForCustomerPortalSso(tenant.id, {
      externalSubject: sub.trim(),
      email: email.trim(),
    });
  }

  if (!resolved) {
    if (!simulateSecret && !hmacSecret) {
      return toApiErrorResponse({
        error:
          "Customer portal SSO is not configured. Set CUSTOMER_PORTAL_SSO_SIMULATE_SECRET and/or CUSTOMER_PORTAL_SSO_HMAC_SECRET.",
        code: "NOT_CONFIGURED",
        status: 501,
      });
    }
    return toApiErrorResponse({
      error: "Unknown portal user or account is missing customer CRM scope (customerCrmAccountId).",
      code: "UNAUTHORIZED",
      status: 401,
    });
  }

  const base = httpSessionBase();
  const res = NextResponse.json({ ok: true, email: resolved.email });
  res.cookies.set(PO_AUTH_USER_COOKIE, resolved.email, { ...base, maxAge: COOKIE_MAX_AGE });
  res.cookies.set(PO_DEMO_USER_COOKIE, "", { ...base, maxAge: 0 });
  return res;
}
