import { NextResponse } from "next/server";
import { TariffProviderType } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { requireApiGrant } from "@/lib/authz";
import { createTariffProvider, listTariffProviders } from "@/lib/tariff/providers";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";

export const dynamic = "force-dynamic";

const PROVIDER_TYPES = new Set(Object.values(TariffProviderType) as TariffProviderType[]);

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.tariffs", "view");
  if (gate) return gate;

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor")?.trim() || undefined;
  const takeRaw = searchParams.get("take");
  let take: number | undefined;
  if (takeRaw != null && takeRaw !== "") {
    const n = Number(takeRaw);
    if (!Number.isInteger(n) || n < 1) {
      return toApiErrorResponse({ error: "Query take must be a positive integer.", code: "BAD_INPUT", status: 400 });
    }
    take = n;
  }
  const status = searchParams.get("status")?.trim() || undefined;

  const { items, nextCursor } = await listTariffProviders({
    take,
    cursor,
    status,
  });
  return NextResponse.json({ providers: items, nextCursor });
}

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.tariffs", "edit");
  if (gate) return gate;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return toApiErrorResponse({ error: "Expected object body.", code: "BAD_INPUT", status: 400 });
  }
  const o = body as Record<string, unknown>;
  const legalName = typeof o.legalName === "string" ? o.legalName.trim() : "";
  const providerType = typeof o.providerType === "string" ? o.providerType.trim() : "";
  if (!legalName) {
    return toApiErrorResponse({ error: "legalName is required.", code: "BAD_INPUT", status: 400 });
  }
  if (!PROVIDER_TYPES.has(providerType as TariffProviderType)) {
    return toApiErrorResponse({ error: "Invalid providerType.", code: "BAD_INPUT", status: 400 });
  }

  try {
    const row = await createTariffProvider({
      legalName,
      tradingName: typeof o.tradingName === "string" ? o.tradingName : null,
      providerType: providerType as TariffProviderType,
      countryCode: typeof o.countryCode === "string" ? o.countryCode : null,
      status: typeof o.status === "string" ? o.status : "ACTIVE",
    });
    return NextResponse.json({ provider: row });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}
