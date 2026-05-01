/**
 * BF-45 — authenticate partner `GET /api/wms/partner/v1/*` via Bearer or X-WMS-Partner-Key.
 */

import type { WmsPartnerApiKeyScope } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { hashPartnerApiKey } from "./partner-api-key";

export type AuthenticatedPartnerApiKey = {
  tenantId: string;
  tenantSlug: string;
  keyId: string;
  scopes: WmsPartnerApiKeyScope[];
};

function extractPartnerApiToken(request: Request): string | null {
  const auth = request.headers.get("authorization")?.trim();
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const t = auth.slice(7).trim();
    if (t.length > 0) return t;
  }
  const x = request.headers.get("x-wms-partner-key")?.trim();
  return x && x.length > 0 ? x : null;
}

export async function authenticatePartnerApiRequest(
  request: Request,
): Promise<AuthenticatedPartnerApiKey | null> {
  const token = extractPartnerApiToken(request);
  if (!token) return null;

  const keyHash = hashPartnerApiKey(token);
  const row = await prisma.wmsPartnerApiKey.findFirst({
    where: { keyHash, isActive: true },
    select: {
      id: true,
      tenantId: true,
      scopes: true,
      tenant: { select: { slug: true } },
    },
  });
  if (!row || row.scopes.length === 0) return null;

  void prisma.wmsPartnerApiKey
    .update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});

  return {
    keyId: row.id,
    tenantId: row.tenantId,
    tenantSlug: row.tenant.slug,
    scopes: [...row.scopes],
  };
}

export function partnerHasScope(auth: AuthenticatedPartnerApiKey, scope: WmsPartnerApiKeyScope): boolean {
  return auth.scopes.includes(scope);
}
