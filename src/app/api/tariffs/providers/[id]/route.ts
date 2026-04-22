import { NextResponse } from "next/server";
import { TariffProviderType } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { requireApiGrant } from "@/lib/authz";
import { updateTariffProvider } from "@/lib/tariff/providers";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";

export const dynamic = "force-dynamic";

const PROVIDER_TYPES = new Set(Object.values(TariffProviderType) as TariffProviderType[]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "edit");
  if (gate) return gate;

  const { id } = await context.params;

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

  const patch: Parameters<typeof updateTariffProvider>[1] = {};
  if (typeof o.legalName === "string") patch.legalName = o.legalName;
  if (typeof o.tradingName === "string" || o.tradingName === null) patch.tradingName = o.tradingName as string | null;
  if (typeof o.providerType === "string") {
    if (!PROVIDER_TYPES.has(o.providerType.trim() as TariffProviderType)) {
      return toApiErrorResponse({ error: "Invalid providerType.", code: "BAD_INPUT", status: 400 });
    }
    patch.providerType = o.providerType.trim() as TariffProviderType;
  }
  if (typeof o.countryCode === "string" || o.countryCode === null) patch.countryCode = o.countryCode as string | null;
  if (typeof o.status === "string") patch.status = o.status;

  if (Object.keys(patch).length === 0) {
    return toApiErrorResponse({ error: "No fields to update.", code: "BAD_INPUT", status: 400 });
  }

  try {
    const row = await updateTariffProvider(id, patch);
    return NextResponse.json({ provider: row });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}
