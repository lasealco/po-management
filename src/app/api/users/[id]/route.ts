import { NextResponse } from "next/server";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const MAX_NAME = 120;

function strIds(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  if (!v.every((x) => typeof x === "string" && x.length > 0)) return null;
  return [...new Set(v)];
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.settings", "edit");
  if (gate) return gate;

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
  const roleIdsParsed = strIds(o.roleIds);
  const passwordRaw = o.password;

  let roleIds: string[] | undefined;
  if (o.roleIds !== undefined) {
    if (roleIdsParsed === null) {
      return NextResponse.json(
        { error: "roleIds must be an array of non-empty strings." },
        { status: 400 },
      );
    }
    roleIds = roleIdsParsed;
  }

  if (
    nameRaw === undefined &&
    activeRaw === undefined &&
    roleIds === undefined &&
    passwordRaw === undefined
  ) {
    return NextResponse.json(
      { error: "Provide name, isActive, and/or roleIds." },
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
  let passwordHash: string | undefined;
  if (passwordRaw !== undefined) {
    if (typeof passwordRaw !== "string" || passwordRaw.length < 8) {
      return NextResponse.json(
        { error: "password must be a string with at least 8 characters." },
        { status: 400 },
      );
    }
    passwordHash = hashPassword(passwordRaw);
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

  if (roleIds !== undefined && roleIds.length > 0) {
    const found = await prisma.role.findMany({
      where: { tenantId: tenant.id, id: { in: roleIds } },
      select: { id: true },
    });
    if (found.length !== roleIds.length) {
      return NextResponse.json(
        { error: "One or more roles are invalid for this tenant." },
        { status: 400 },
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    if (name !== undefined || isActive !== undefined || passwordHash !== undefined) {
      await tx.user.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
          ...(passwordHash !== undefined ? { passwordHash } : {}),
        },
      });
    }
    if (roleIds !== undefined) {
      await tx.userRole.deleteMany({ where: { userId: id } });
      if (roleIds.length > 0) {
        await tx.userRole.createMany({
          data: roleIds.map((roleId) => ({ userId: id, roleId })),
        });
      }
    }
  });

  const user = await prisma.user.findFirst({
    where: { id, tenantId: tenant.id },
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

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const { userRoles, ...rest } = user;
  return NextResponse.json({
    user: {
      ...rest,
      roles: userRoles.map((ur) => ur.role),
    },
  });
}
