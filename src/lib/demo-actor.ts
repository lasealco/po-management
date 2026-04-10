import { cookies } from "next/headers";

/** Cookie set by POST /api/demo-session (demo only). */
export const PO_DEMO_USER_COOKIE = "po_demo_user";
export const PO_AUTH_USER_COOKIE = "po_auth_user";

export const DEFAULT_DEMO_USER_EMAIL = "buyer@demo-company.com";

/**
 * Resolved “signed-in” demo user email for server components and route handlers.
 */
export async function getDemoActorEmail(): Promise<string> {
  const jar = await cookies();
  const real = jar.get(PO_AUTH_USER_COOKIE)?.value?.trim().toLowerCase();
  if (real) return real;
  const raw = jar.get(PO_DEMO_USER_COOKIE)?.value?.trim().toLowerCase();
  if (raw) return raw;
  const env = process.env.DEMO_ACTOR_EMAIL?.trim().toLowerCase();
  if (env) return env;
  return DEFAULT_DEMO_USER_EMAIL;
}
