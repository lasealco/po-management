import { NextResponse } from "next/server";
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
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  const pref = await prisma.userPreference.findUnique({
    where: { userId_key: { userId: actorId, key: ORDERS_BOARD_PREF_KEY } },
    select: { value: true },
  });
  const parsed = readBoardPrefsFromJson(pref?.value);
  return NextResponse.json({
    queueFilter: parsed.queueFilter,
    sortMode: parsed.sortMode,
  });
}

type PatchBody = {
  queueFilter?: string;
  sortMode?: string;
};

export async function PATCH(request: Request) {
  const gate = await requireApiGrant("org.orders", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
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

  if (input.queueFilter !== undefined) {
    if (
      typeof input.queueFilter !== "string" ||
      !(BOARD_QUEUE_FILTERS as readonly string[]).includes(input.queueFilter)
    ) {
      return NextResponse.json({ error: "Invalid queueFilter." }, { status: 400 });
    }
    nextQueue = input.queueFilter as BoardQueueFilter;
  }
  if (input.sortMode !== undefined) {
    if (input.sortMode !== "priority" && input.sortMode !== "newest") {
      return NextResponse.json({ error: "Invalid sortMode." }, { status: 400 });
    }
    nextSort = input.sortMode;
  }

  const value = {
    queueFilter: nextQueue ?? "needs_my_action",
    sortMode: nextSort ?? "priority",
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
