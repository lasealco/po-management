import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { PO_AUTH_USER_COOKIE, PO_DEMO_USER_COOKIE } from "@/lib/demo-actor";
import { LEGAL_PUBLIC_HELP_PATHS } from "@/lib/legal-public-paths";
import { MARKETING_PRICING_PATH } from "@/lib/marketing-public-paths";

const PUBLIC_PATHS = new Set([
  "/",
  MARKETING_PRICING_PATH,
  ...LEGAL_PUBLIC_HELP_PATHS,
  "/login",
  "/settings/demo",
]);

/** When `1`, skip redirect to /login and use default demo actor (see getDemoActorEmail). */
function allowUnauthenticated() {
  return process.env.PO_ALLOW_UNAUTHENTICATED === "1";
}

function nextWithPathname(request: NextRequest) {
  const h = new Headers(request.headers);
  h.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: h } });
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const open = allowUnauthenticated();

  /** Legacy: orders board lived at `/` with `?queue=`; now `/orders`. */
  if (pathname === "/" && request.nextUrl.searchParams.has("queue")) {
    const url = request.nextUrl.clone();
    url.pathname = "/orders";
    return NextResponse.redirect(url);
  }

  if (PUBLIC_PATHS.has(pathname)) return nextWithPathname(request);
  if (pathname.startsWith("/api/auth/")) return nextWithPathname(request);
  if (pathname.startsWith("/api/demo-session")) return nextWithPathname(request);
  if (pathname.startsWith("/_next/")) return nextWithPathname(request);
  if (pathname === "/favicon.ico") return nextWithPathname(request);

  const authUser = request.cookies.get(PO_AUTH_USER_COOKIE)?.value;
  const demoUser = request.cookies.get(PO_DEMO_USER_COOKIE)?.value;
  if (authUser || demoUser || open) return nextWithPathname(request);

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};

export default proxy;
