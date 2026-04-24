import { NextResponse } from "next/server";

import { getDemoTenant } from "@/lib/demo-tenant";
import { mapRoleAssignmentsToRoles, parseOperatingRolesInput } from "@/lib/org-unit-operating-roles";
import { validateOrgUnitCodeForKind } from "@/lib/org-unit-code-validate";
import { prisma } from "@/lib/prisma";
import { requireApiGrant } from "@/lib/authz";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { OrgUnitKind } from "@prisma/client";

const MAX_NAME = 160;

const KINDS = new Set<OrgUnitKind>([
  "GROUP",
  "LEGAL_ENTITY",
  "REGION",
  "COUNTRY",
  "SITE",
  "OFFICE",
]);

export async function GET() {
  const gate = await requireApiGrant("org.settings", "view");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const orgUnits = await prisma.orgUnit.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      parentId: true,
      name: true,
      code: true,
      kind: true,
      sortOrder: true,
      roleAssignments: { select: { role: true } },
    },
  });
  return NextResponse.json({
    orgUnits: orgUnits.map((u) => ({
      id: u.id,
      parentId: u.parentId,
      name: u.name,
      code: u.code,
      kind: u.kind,
      sortOrder: u.sortOrder,
      operatingRoles: mapRoleAssignmentsToRoles(u.roleAssignments),
    })),
  });
}

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
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const codeRaw = typeof o.code === "string" ? o.code : "";
  const parentId = o.parentId === null || o.parentId === "" ? null : (o.parentId as string);
  const kind = o.kind;
  const sortOrder = typeof o.sortOrder === "number" && Number.isFinite(o.sortOrder) ? o.sortOrder : 0;
  const roleParse = parseOperatingRolesInput("operatingRoles" in o ? o.operatingRoles : []);
  if (!roleParse.ok) {
    return toApiErrorResponse({ error: roleParse.error, code: "BAD_INPUT", status: 400 });
  }

  if (!name.length) {
    return toApiErrorResponse({ error: "name is required.", code: "BAD_INPUT", status: 400 });
  }
  if (name.length > MAX_NAME) {
    return toApiErrorResponse({ error: `name must be at most ${MAX_NAME} characters.`, code: "BAD_INPUT", status: 400 });
  }
  if (typeof kind !== "string" || !KINDS.has(kind as OrgUnitKind)) {
    return toApiErrorResponse({
      error: "kind must be a valid OrgUnitKind (GROUP, LEGAL_ENTITY, REGION, COUNTRY, SITE, OFFICE).",
      code: "BAD_INPUT",
      status: 400,
    });
  }
  const codeRes = await validateOrgUnitCodeForKind(prisma, kind as OrgUnitKind, codeRaw);
  if (!codeRes.ok) {
    return toApiErrorResponse({ error: codeRes.error, code: "BAD_INPUT", status: 400 });
  }

  if (parentId) {
    const p = await prisma.orgUnit.findFirst({
      where: { id: parentId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!p) {
      return toApiErrorResponse({ error: "parent org unit not found in this tenant.", code: "BAD_INPUT", status: 400 });
    }
  }

  try {
    const created = await prisma.orgUnit.create({
      data: {
        tenantId: tenant.id,
        parentId,
        name,
        code: codeRes.code,
        kind: kind as OrgUnitKind,
        sortOrder,
        roleAssignments: {
          create: roleParse.roles.map((role) => ({ role })),
        },
      },
      select: {
        id: true,
        parentId: true,
        name: true,
        code: true,
        kind: true,
        sortOrder: true,
        roleAssignments: { select: { role: true } },
      },
    });
    return NextResponse.json({
      orgUnit: {
        id: created.id,
        parentId: created.parentId,
        name: created.name,
        code: created.code,
        kind: created.kind,
        sortOrder: created.sortOrder,
        operatingRoles: mapRoleAssignmentsToRoles(created.roleAssignments),
      },
    });
  } catch {
    return toApiErrorResponse({
      error: "Could not create org unit (code may already exist in this tenant).",
      code: "BAD_INPUT",
      status: 400,
    });
  }
}
