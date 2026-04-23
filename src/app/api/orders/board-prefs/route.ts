import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import {
  BOARD_QUEUE_FILTERS,
  ORDERS_BOARD_PREF_KEY,
  readBoardPrefsFromJson,
  type BoardQueueFilter,
  type BoardSortMode,
} from "@/lib/orders-board-prefs";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gate = await requireApiGrant("org.orders", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const pref = await prisma.userPreference.findUnique({
    where: { userId_key: { userId: actorId, key: ORDERS_BOARD_PREF_KEY } },
    select: { value: true },
  });
  const parsed = readBoardPrefsFromJson(pref?.value);
  return NextResponse.json({
    queueFilter: parsed.queueFilter,
    sortMode: parsed.sortMode,
    filterSupplierId: parsed.filterSupplierId,
    filterRequesterId: parsed.filterRequesterId,
  });
}

type PatchBody = {
  queueFilter?: string;
  sortMode?: string;
  filterSupplierId?: string | null;
  filterRequesterId?: string | null;
};

function normalizeOptionalId(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t.length ? t : null;
}

export async function PATCH(request: Request) {
  const gate = await requireApiGrant("org.orders", "view");
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

  const existing = await prisma.userPreference.findUnique({
    where: { userId_key: { userId: actorId, key: ORDERS_BOARD_PREF_KEY } },
    select: { id: true, value: true },
  });

  const prev = readBoardPrefsFromJson(existing?.value);
  let nextQueue: BoardQueueFilter | null = prev.queueFilter;
  let nextSort: BoardSortMode | null = prev.sortMode;
  let nextFilterSupplierId = prev.filterSupplierId;
  let nextFilterRequesterId = prev.filterRequesterId;

  if (input.queueFilter !== undefined) {
    if (
      typeof input.queueFilter !== "string" ||
      !(BOARD_QUEUE_FILTERS as readonly string[]).includes(input.queueFilter)
    ) {
      return toApiErrorResponse({ error: "Invalid queueFilter.", code: "BAD_INPUT", status: 400 });
    }
    nextQueue = input.queueFilter as BoardQueueFilter;
  }
  if (input.sortMode !== undefined) {
    if (input.sortMode !== "priority" && input.sortMode !== "newest") {
      return toApiErrorResponse({ error: "Invalid sortMode.", code: "BAD_INPUT", status: 400 });
    }
    nextSort = input.sortMode;
  }
  if (input.filterSupplierId !== undefined) {
    nextFilterSupplierId = normalizeOptionalId(input.filterSupplierId);
  }
  if (input.filterRequesterId !== undefined) {
    nextFilterRequesterId = normalizeOptionalId(input.filterRequesterId);
  }

  const value = {
    queueFilter: nextQueue ?? "needs_my_action",
    sortMode: nextSort ?? "priority",
    filterSupplierId: nextFilterSupplierId,
    filterRequesterId: nextFilterRequesterId,
  };

  if (existing) {
    await prisma.userPreference.update({
      where: { id: existing.id },
      data: { value },
    });
  } else {
    await prisma.userPreference.create({
      data: {
        tenantId: tenant.id,
        userId: actorId,
        key: ORDERS_BOARD_PREF_KEY,
        value,
      },
    });
  }

  return NextResponse.json({ ok: true, ...value });
}
