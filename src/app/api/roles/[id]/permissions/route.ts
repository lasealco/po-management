import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { validateRolePermissionGrants } from "@/lib/delegation-guard";
import {
  GLOBAL_PERMISSION_CATALOG,
  isValidGlobalPermission,
} from "@/lib/permission-catalog";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.settings", "view");
  if (gate) return gate;

  const { id: roleId } = await context.params;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Demo tenant not found. Run `npm run db:seed` to create starter data.", code: "NOT_FOUND", status: 404 });
  }

  const role = await prisma.role.findFirst({
    where: { id: roleId, tenantId: tenant.id },
    select: { id: true, name: true },
  });
  if (!role) {
    return toApiErrorResponse({ error: "Role not found.", code: "NOT_FOUND", status: 404 });
  }

  const permissions = await prisma.rolePermission.findMany({
    where: { roleId, workflowStatusId: null },
    select: { resource: true, action: true, effect: true },
  });

  const catalog = [...GLOBAL_PERMISSION_CATALOG].map((c) => ({
    resource: c.resource,
    action: c.action,
    label: c.label,
    description: c.description,
    granted: permissions.some(
      (p) =>
        p.resource === c.resource &&
        p.action === c.action &&
        p.effect === "allow",
    ),
  }));

  return NextResponse.json({ role, catalog });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.settings", "edit");
  if (gate) return gate;

  const { id: roleId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON body.", code: "BAD_INPUT", status: 400 });
  }

  if (!body || typeof body !== "object") {
    return toApiErrorResponse({ error: "Expected an object.", code: "BAD_INPUT", status: 400 });
  }

  const grantsRaw = (body as Record<string, unknown>).grants;
  if (!Array.isArray(grantsRaw)) {
    return toApiErrorResponse({ error: "grants must be an array of { resource, action }.", code: "BAD_INPUT", status: 400 });
  }

  const pairs: { resource: string; action: string }[] = [];
  for (const g of grantsRaw) {
    if (!g || typeof g !== "object") {
      return toApiErrorResponse({ error: "Invalid grant entry.", code: "BAD_INPUT", status: 400 });
    }
    const o = g as Record<string, unknown>;
    if (typeof o.resource !== "string" || typeof o.action !== "string") {
      return toApiErrorResponse({ error: "Each grant needs resource and action strings.", code: "BAD_INPUT", status: 400 });
    }
    if (!isValidGlobalPermission(o.resource, o.action)) {
      return toApiErrorResponse({ error: `Unknown permission: ${o.resource} / ${o.action}`, code: "BAD_INPUT", status: 400 });
    }
    pairs.push({ resource: o.resource, action: o.action });
  }

  const unique = new Map<string, { resource: string; action: string }>();
  for (const p of pairs) {
    unique.set(`${p.resource}\0${p.action}`, p);
  }
  const grants = [...unique.values()];

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Demo tenant not found. Run `npm run db:seed` to create starter data.", code: "NOT_FOUND", status: 404 });
  }

  const role = await prisma.role.findFirst({
    where: { id: roleId, tenantId: tenant.id },
    select: { id: true, name: true },
  });
  if (!role) {
    return toApiErrorResponse({ error: "Role not found.", code: "NOT_FOUND", status: 404 });
  }

  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({
      error: "No active session user to evaluate delegation.",
      code: "FORBIDDEN",
      status: 403,
    });
  }
  const del = await validateRolePermissionGrants(actorId, role, grants);
  if (!del.ok) {
    return toApiErrorResponse({ error: del.error, code: "FORBIDDEN", status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({
      where: { roleId, workflowStatusId: null },
    });
    if (grants.length > 0) {
      await tx.rolePermission.createMany({
        data: grants.map((g) => ({
          roleId,
          resource: g.resource,
          action: g.action,
          effect: "allow",
        })),
      });
    }
  });

  const permissions = await prisma.rolePermission.findMany({
    where: { roleId, workflowStatusId: null },
    select: { resource: true, action: true, effect: true },
  });

  const catalog = [...GLOBAL_PERMISSION_CATALOG].map((c) => ({
    resource: c.resource,
    action: c.action,
    label: c.label,
    description: c.description,
    granted: permissions.some(
      (p) =>
        p.resource === c.resource &&
        p.action === c.action &&
        p.effect === "allow",
    ),
  }));

  return NextResponse.json({ role, catalog });
}
