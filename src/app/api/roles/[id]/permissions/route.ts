import { NextResponse } from "next/server";
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
  const { id: roleId } = await context.params;

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

  const role = await prisma.role.findFirst({
    where: { id: roleId, tenantId: tenant.id },
    select: { id: true, name: true },
  });
  if (!role) {
    return NextResponse.json({ error: "Role not found." }, { status: 404 });
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
  const { id: roleId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected an object." }, { status: 400 });
  }

  const grantsRaw = (body as Record<string, unknown>).grants;
  if (!Array.isArray(grantsRaw)) {
    return NextResponse.json(
      { error: "grants must be an array of { resource, action }." },
      { status: 400 },
    );
  }

  const pairs: { resource: string; action: string }[] = [];
  for (const g of grantsRaw) {
    if (!g || typeof g !== "object") {
      return NextResponse.json({ error: "Invalid grant entry." }, {
        status: 400,
      });
    }
    const o = g as Record<string, unknown>;
    if (typeof o.resource !== "string" || typeof o.action !== "string") {
      return NextResponse.json(
        { error: "Each grant needs resource and action strings." },
        { status: 400 },
      );
    }
    if (!isValidGlobalPermission(o.resource, o.action)) {
      return NextResponse.json(
        { error: `Unknown permission: ${o.resource} / ${o.action}` },
        { status: 400 },
      );
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
    return NextResponse.json(
      {
        error:
          "Demo tenant not found. Run `npm run db:seed` to create starter data.",
      },
      { status: 404 },
    );
  }

  const role = await prisma.role.findFirst({
    where: { id: roleId, tenantId: tenant.id },
    select: { id: true, name: true },
  });
  if (!role) {
    return NextResponse.json({ error: "Role not found." }, { status: 404 });
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
