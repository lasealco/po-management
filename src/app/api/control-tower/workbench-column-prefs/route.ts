import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import {
  defaultWorkbenchColumnVisibility,
  parseWorkbenchColumnVisibility,
  CT_WORKBENCH_COLUMN_USER_PREF_KEY,
  type WorkbenchTogglableColumn,
} from "@/lib/control-tower/workbench-column-prefs";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

function readPrefsFromValue(value: unknown): Record<WorkbenchTogglableColumn, boolean> | null {
  if (!value || typeof value !== "object" || !("columnVisibility" in (value as object))) return null;
  const cv = (value as { columnVisibility?: unknown }).columnVisibility;
  if (!cv || typeof cv !== "object") return null;
  const patch = parseWorkbenchColumnVisibility(JSON.stringify(cv));
  if (Object.keys(patch).length === 0) return null;
  return { ...defaultWorkbenchColumnVisibility(), ...patch };
}

export async function GET() {
  const gate = await requireApiGrant("org.controltower", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const pref = await prisma.userPreference.findUnique({
    where: { userId_key: { userId: actorId, key: CT_WORKBENCH_COLUMN_USER_PREF_KEY } },
    select: { value: true },
  });
  const parsed = readPrefsFromValue(pref?.value);
  const columnVisibility = parsed ?? defaultWorkbenchColumnVisibility();
  return NextResponse.json({ columnVisibility });
}

type PatchBody = { columnVisibility?: unknown };

export async function PATCH(request: Request) {
  const gate = await requireApiGrant("org.controltower", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const input = (body && typeof body === "object" ? body : {}) as PatchBody;
  if (input.columnVisibility === undefined) {
    return toApiErrorResponse({ error: "columnVisibility is required", code: "BAD_INPUT", status: 400 });
  }
  if (input.columnVisibility === null || typeof input.columnVisibility !== "object") {
    return toApiErrorResponse({ error: "columnVisibility must be an object", code: "BAD_INPUT", status: 400 });
  }
  const patch = parseWorkbenchColumnVisibility(JSON.stringify(input.columnVisibility));
  if (Object.keys(patch).length === 0) {
    return toApiErrorResponse({
      error: "columnVisibility must set at least one known column",
      code: "BAD_INPUT",
      status: 400,
    });
  }
  const columnVisibility = { ...defaultWorkbenchColumnVisibility(), ...patch };

  await prisma.userPreference.upsert({
    where: { userId_key: { userId: actorId, key: CT_WORKBENCH_COLUMN_USER_PREF_KEY } },
    create: {
      tenantId: tenant.id,
      userId: actorId,
      key: CT_WORKBENCH_COLUMN_USER_PREF_KEY,
      value: { columnVisibility },
    },
    update: {
      value: { columnVisibility },
    },
  });

  return NextResponse.json({ ok: true, columnVisibility });
}
