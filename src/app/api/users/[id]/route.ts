import { NextResponse } from "next/server";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


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
    return toApiErrorResponse({ error: "Invalid JSON body.", code: "BAD_INPUT", status: 400 });
  }

  if (!body || typeof body !== "object") {
    return toApiErrorResponse({ error: "Expected an object.", code: "BAD_INPUT", status: 400 });
  }

  const o = body as Record<string, unknown>;
  const nameRaw = o.name;
  const activeRaw = o.isActive;
  const roleIdsParsed = strIds(o.roleIds);
  const passwordRaw = o.password;

  let roleIds: string[] | undefined;
  if (o.roleIds !== undefined) {
    if (roleIdsParsed === null) {
      return toApiErrorResponse({ error: "roleIds must be an array of non-empty strings.", code: "BAD_INPUT", status: 400 });
    }
    roleIds = roleIdsParsed;
  }

  if (
    nameRaw === undefined &&
    activeRaw === undefined &&
    roleIds === undefined &&
    passwordRaw === undefined
  ) {
    return toApiErrorResponse({ error: "Provide name, isActive, and/or roleIds.", code: "BAD_INPUT", status: 400 });
  }

  let name: string | undefined;
  if (nameRaw !== undefined) {
    if (typeof nameRaw !== "string") {
      return toApiErrorResponse({ error: "name must be a string.", code: "BAD_INPUT", status: 400 });
    }
    const t = nameRaw.trim();
    if (!t.length) {
      return toApiErrorResponse({ error: "name cannot be empty.", code: "BAD_INPUT", status: 400 });
    }
    if (t.length > MAX_NAME) {
      return toApiErrorResponse({ error: `name must be at most ${MAX_NAME} characters.`, code: "BAD_INPUT", status: 400 });
    }
    name = t;
  }

  let isActive: boolean | undefined;
  if (activeRaw !== undefined) {
    if (typeof activeRaw !== "boolean") {
      return toApiErrorResponse({ error: "isActive must be a boolean.", code: "BAD_INPUT", status: 400 });
    }
    isActive = activeRaw;
  }

  if (isActive === false) {
    const actorId = await getActorUserId();
    if (actorId && actorId === id) {
      return toApiErrorResponse({
        error: "You cannot deactivate your own account.",
        code: "BAD_INPUT",
        status: 400,
      });
    }
  }
  let passwordHash: string | undefined;
  if (passwordRaw !== undefined) {
    if (typeof passwordRaw !== "string" || passwordRaw.length < 8) {
      return toApiErrorResponse({ error: "password must be a string with at least 8 characters.", code: "BAD_INPUT", status: 400 });
    }
    passwordHash = hashPassword(passwordRaw);
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Demo tenant not found. Run `npm run db:seed` to create starter data.", code: "NOT_FOUND", status: 404 });
  }

  const existing = await prisma.user.findFirst({
    where: { id, tenantId: tenant.id },
    select: { id: true },
  });
  if (!existing) {
    return toApiErrorResponse({ error: "User not found.", code: "NOT_FOUND", status: 404 });
  }

  if (roleIds !== undefined && roleIds.length > 0) {
    const found = await prisma.role.findMany({
      where: { tenantId: tenant.id, id: { in: roleIds } },
      select: { id: true },
    });
    if (found.length !== roleIds.length) {
      return toApiErrorResponse({ error: "One or more roles are invalid for this tenant.", code: "BAD_INPUT", status: 400 });
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
    return toApiErrorResponse({ error: "User not found.", code: "NOT_FOUND", status: 404 });
  }

  const { userRoles, ...rest } = user;
  return NextResponse.json({
    user: {
      ...rest,
      roles: userRoles.map((ur) => ur.role),
    },
  });
}
