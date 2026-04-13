import { NextResponse } from "next/server";

import { requireApiGrant } from "@/lib/authz";
import { handleControlTowerPost } from "@/lib/control-tower/post-actions";
import { getDemoTenant } from "@/lib/demo-tenant";

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.controltower", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  return handleControlTowerPost(tenant.id, obj);
}
