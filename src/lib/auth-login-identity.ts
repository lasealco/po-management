import { DEMO_TENANT_SLUG } from "@/lib/demo-tenant";

/**
 * For **demo-tenant** password login, allow a short **username** in addition to full email.
 * `superuser` → `superuser@demo-company.com` (matches `prisma/seed.mjs`).
 * All other non-email inputs are lowercased and passed through (may 404 on lookup).
 */
export function resolvePasswordLoginEmail(raw: string, tenantSlug: string | null | undefined): string {
  const t = raw.trim();
  if (!t) return t;
  if (t.includes("@")) {
    return t.toLowerCase();
  }
  if (tenantSlug === DEMO_TENANT_SLUG && t.toLowerCase() === "superuser") {
    return "superuser@demo-company.com";
  }
  return t.toLowerCase();
}
