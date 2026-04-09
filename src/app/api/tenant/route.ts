import { NextResponse } from "next/server";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

const MAX_NAME = 120;

export async function PATCH(request: Request) {
  const gate = await requireApiGrant("org.settings", "edit");
  if (gate) return gate;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected an object." }, { status: 400 });
  }

  const nameRaw = (body as Record<string, unknown>).name;
  if (typeof nameRaw !== "string") {
    return NextResponse.json({ error: "name must be a string." }, { status: 400 });
  }

  const name = nameRaw.trim();
  if (!name.length) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }
  if (name.length > MAX_NAME) {
    return NextResponse.json(
      { error: `name must be at most ${MAX_NAME} characters.` },
      { status: 400 },
    );
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json(
      {
        error:
          "Demo tenant not found. Run `npm run db:seed` to create starter data.",
      },
      { status: 404 },
    );
  }

  const updated = await prisma.tenant.update({
    where: { id: tenant.id },
    data: { name },
    select: { id: true, name: true, slug: true },
  });

  return NextResponse.json({ tenant: updated });
}
