import { NextResponse } from "next/server";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


const MAX_NAME = 120;

export async function PATCH(request: Request) {
  const gate = await requireApiGrant("org.settings", "edit");
  if (gate) return gate;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON body.", code: "BAD_INPUT", status: 400 });
  }

  if (!body || typeof body !== "object") {
    return toApiErrorResponse({ error: "Expected an object.", code: "BAD_INPUT", status: 400 });
  }

  const nameRaw = (body as Record<string, unknown>).name;
  if (typeof nameRaw !== "string") {
    return toApiErrorResponse({ error: "name must be a string.", code: "BAD_INPUT", status: 400 });
  }

  const name = nameRaw.trim();
  if (!name.length) {
    return toApiErrorResponse({ error: "name is required.", code: "BAD_INPUT", status: 400 });
  }
  if (name.length > MAX_NAME) {
    return toApiErrorResponse({ error: `name must be at most ${MAX_NAME} characters.`, code: "BAD_INPUT", status: 400 });
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Demo tenant not found. Run `npm run db:seed` to create starter data.", code: "NOT_FOUND", status: 404 });
  }

  const updated = await prisma.tenant.update({
    where: { id: tenant.id },
    data: { name },
    select: { id: true, name: true, slug: true },
  });

  return NextResponse.json({ tenant: updated });
}
