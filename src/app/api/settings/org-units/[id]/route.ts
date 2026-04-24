import { NextResponse } from "next/server";

import { getDemoTenant } from "@/lib/demo-tenant";
import { normalizeOrgUnitCode, orgUnitReparentIsValid } from "@/lib/org-unit";
import { prisma } from "@/lib/prisma";
import { requireApiGrant } from "@/lib/authz";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import type { OrgUnitKind } from "@prisma/client";

const MAX_NAME = 160;
const KINDS = new Set<string>(["GROUP", "LEGAL_ENTITY", "REGION", "COUNTRY", "SITE", "OFFICE"]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.settings", "edit");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON body.", code: "BAD_INPUT", status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const existing = await prisma.orgUnit.findFirst({
    where: { id, tenantId: tenant.id },
    select: { id: true, parentId: true },
  });
  if (!existing) {
    return toApiErrorResponse({ error: "Org unit not found.", code: "NOT_FOUND", status: 404 });
  }

  const updates: {
    name?: string;
    code?: string;
    kind?: OrgUnitKind;
    parentId?: string | null;
    sortOrder?: number;
  } = {};

  if (o.name !== undefined) {
    if (typeof o.name !== "string" || !o.name.trim().length) {
      return toApiErrorResponse({ error: "name cannot be empty.", code: "BAD_INPUT", status: 400 });
    }
    if (o.name.trim().length > MAX_NAME) {
      return toApiErrorResponse({ error: `name must be at most ${MAX_NAME} characters.`, code: "BAD_INPUT", status: 400 });
    }
    updates.name = o.name.trim();
  }
  if (o.code !== undefined) {
    if (typeof o.code !== "string") {
      return toApiErrorResponse({ error: "code must be a string.", code: "BAD_INPUT", status: 400 });
    }
    const codeNorm = normalizeOrgUnitCode(o.code);
    if (!codeNorm.ok) {
      return toApiErrorResponse({ error: codeNorm.error, code: "BAD_INPUT", status: 400 });
    }
    updates.code = codeNorm.code;
  }
  if (o.kind !== undefined) {
    if (typeof o.kind !== "string" || !KINDS.has(o.kind)) {
      return toApiErrorResponse({ error: "Invalid kind.", code: "BAD_INPUT", status: 400 });
    }
    updates.kind = o.kind as OrgUnitKind;
  }
  if (o.sortOrder !== undefined) {
    if (typeof o.sortOrder !== "number" || !Number.isFinite(o.sortOrder)) {
      return toApiErrorResponse({ error: "sortOrder must be a number.", code: "BAD_INPUT", status: 400 });
    }
    updates.sortOrder = o.sortOrder;
  }
  if (o.parentId !== undefined) {
    const p = o.parentId === null || o.parentId === "" ? null : (o.parentId as string);
    if (p) {
      const parentRow = await prisma.orgUnit.findFirst({
        where: { id: p, tenantId: tenant.id },
        select: { id: true },
      });
      if (!parentRow) {
        return toApiErrorResponse({ error: "parent org unit not found.", code: "BAD_INPUT", status: 400 });
      }
    }
    const flat = await prisma.orgUnit.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, parentId: true },
    });
    if (!orgUnitReparentIsValid(flat, id, p)) {
      return toApiErrorResponse({ error: "That parent would create a cycle.", code: "BAD_INPUT", status: 400 });
    }
    updates.parentId = p;
  }

  if (Object.keys(updates).length === 0) {
    return toApiErrorResponse({ error: "No changes provided.", code: "BAD_INPUT", status: 400 });
  }

  try {
    const orgUnit = await prisma.orgUnit.update({
      where: { id },
      data: updates,
      select: { id: true, parentId: true, name: true, code: true, kind: true, sortOrder: true },
    });
    return NextResponse.json({ orgUnit });
  } catch {
    return toApiErrorResponse({
      error: "Update failed (code may already be in use).",
      code: "BAD_INPUT",
      status: 400,
    });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.settings", "edit");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const { id } = await context.params;

  const row = await prisma.orgUnit.findFirst({
    where: { id, tenantId: tenant.id },
    select: { id: true },
  });
  if (!row) {
    return toApiErrorResponse({ error: "Org unit not found.", code: "NOT_FOUND", status: 404 });
  }

  const [child, primaryUsers] = await Promise.all([
    prisma.orgUnit.findFirst({ where: { parentId: id }, select: { id: true } }),
    prisma.user.count({ where: { primaryOrgUnitId: id } }),
  ]);
  if (child) {
    return toApiErrorResponse({
      error: "Remove or move child org units first.",
      code: "BAD_INPUT",
      status: 400,
    });
  }
  if (primaryUsers > 0) {
    return toApiErrorResponse({
      error: `Reassign or clear ${primaryUsers} user(s) with this org as primary before deleting.`,
      code: "BAD_INPUT",
      status: 400,
    });
  }

  await prisma.orgUnit.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
