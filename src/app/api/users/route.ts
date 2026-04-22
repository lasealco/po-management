import { NextResponse } from "next/server";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


type CreateUserBody = {
  email?: string;
  name?: string;
  password?: string;
  roleIds?: string[];
};

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.settings", "edit");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON body.", code: "BAD_INPUT", status: 400 });
  }
  const input = (body && typeof body === "object" ? body : {}) as CreateUserBody;
  const email = input.email?.trim().toLowerCase() ?? "";
  const name = input.name?.trim() ?? "";
  const password = input.password ?? "";
  const roleIds = Array.isArray(input.roleIds)
    ? [...new Set(input.roleIds.filter((r) => typeof r === "string" && r))]
    : [];
  if (!email || !name || !password) {
    return toApiErrorResponse({ error: "email, name, and password are required.", code: "BAD_INPUT", status: 400 });
  }
  if (password.length < 8) {
    return toApiErrorResponse({ error: "password must be at least 8 characters.", code: "BAD_INPUT", status: 400 });
  }
  if (roleIds.length > 0) {
    const found = await prisma.role.findMany({
      where: { tenantId: tenant.id, id: { in: roleIds } },
      select: { id: true },
    });
    if (found.length !== roleIds.length) {
      return toApiErrorResponse({ error: "One or more roles are invalid for this tenant.", code: "BAD_INPUT", status: 400 });
    }
  }
  try {
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email,
          name,
          passwordHash: hashPassword(password),
        },
        select: { id: true },
      });
      if (roleIds.length > 0) {
        await tx.userRole.createMany({
          data: roleIds.map((roleId) => ({ userId: user.id, roleId })),
        });
      }
      return user;
    });
    return NextResponse.json({ ok: true, id: created.id });
  } catch {
    return toApiErrorResponse({ error: "Could not create user (email may already exist).", code: "BAD_INPUT", status: 400 });
  }
}
