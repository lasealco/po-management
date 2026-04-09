import { NextResponse } from "next/server";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

const MAX_NAME = 120;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected an object." }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const nameRaw = o.name;
  const activeRaw = o.isActive;

  if (nameRaw === undefined && activeRaw === undefined) {
    return NextResponse.json(
      { error: "Provide name and/or isActive." },
      { status: 400 },
    );
  }

  let name: string | undefined;
  if (nameRaw !== undefined) {
    if (typeof nameRaw !== "string") {
      return NextResponse.json({ error: "name must be a string." }, {
        status: 400,
      });
    }
    const t = nameRaw.trim();
    if (!t.length) {
      return NextResponse.json({ error: "name cannot be empty." }, {
        status: 400,
      });
    }
    if (t.length > MAX_NAME) {
      return NextResponse.json(
        { error: `name must be at most ${MAX_NAME} characters.` },
        { status: 400 },
      );
    }
    name = t;
  }

  let isActive: boolean | undefined;
  if (activeRaw !== undefined) {
    if (typeof activeRaw !== "boolean") {
      return NextResponse.json(
        { error: "isActive must be a boolean." },
        { status: 400 },
      );
    }
    isActive = activeRaw;
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

  const existing = await prisma.user.findFirst({
    where: { id, tenantId: tenant.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      userRoles: {
        select: { role: { select: { id: true, name: true, isSystem: true } } },
      },
    },
  });

  const { userRoles, ...rest } = user;
  return NextResponse.json({
    user: {
      ...rest,
      roles: userRoles.map((ur) => ur.role),
    },
  });
}
