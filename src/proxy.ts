import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PO_AUTH_USER_COOKIE, PO_DEMO_USER_COOKIE } from "@/lib/demo-actor";

const PUBLIC_PATHS = new Set(["/login"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  if (pathname.startsWith("/api/auth/")) return NextResponse.next();
  if (pathname.startsWith("/api/demo-session")) return NextResponse.next();
  if (pathname.startsWith("/_next/")) return NextResponse.next();
  if (pathname === "/favicon.ico") return NextResponse.next();

  const authUser = request.cookies.get(PO_AUTH_USER_COOKIE)?.value;
  const demoUser = request.cookies.get(PO_DEMO_USER_COOKIE)?.value;
  if (authUser || demoUser) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
