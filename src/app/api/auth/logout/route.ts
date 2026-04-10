import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PO_AUTH_USER_COOKIE } from "@/lib/demo-actor";

export async function POST() {
  const jar = await cookies();
  jar.set(PO_AUTH_USER_COOKIE, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  return NextResponse.json({ ok: true });
}
