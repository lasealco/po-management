import { NextResponse } from "next/server";
import { PO_AUTH_USER_COOKIE, PO_DEMO_USER_COOKIE } from "@/lib/demo-actor";
import { httpSessionBase } from "@/lib/http-session-cookie";

export async function POST() {
  const base = httpSessionBase();
  const cleared = { ...base, maxAge: 0 };
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PO_AUTH_USER_COOKIE, "", cleared);
  res.cookies.set(PO_DEMO_USER_COOKIE, "", cleared);
  return res;
}
