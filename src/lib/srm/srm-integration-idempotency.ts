import { createHash } from "crypto";
import type { PrismaClient } from "@prisma/client";

import { srmIntegrationStableStringify } from "./srm-integration-stable-stringify";

export const SRM_INTEGRATION_IDEMPOTENCY_KEY_MAX = 256;
export const SRM_INTEGRATION_UPSERT_SUPPLIER_V1 = "supplier_upsert_v1" as const;

export function srmBodySha256(body: unknown): string {
  return createHash("sha256").update(srmIntegrationStableStringify(body), "utf8").digest("hex");
}

export function parseSrmIdempotencyKeyHeader(
  request: Request,
): { ok: true; key: string | null } | { ok: false; error: string } {
  const raw = request.headers.get("Idempotency-Key")?.trim() ?? request.headers.get("idempotency-key")?.trim() ?? null;
  if (raw == null || raw.length === 0) return { ok: true, key: null };
  if (raw.length > SRM_INTEGRATION_IDEMPOTENCY_KEY_MAX) {
    return { ok: false, error: `Idempotency-Key exceeds ${SRM_INTEGRATION_IDEMPOTENCY_KEY_MAX} characters.` };
  }
  return { ok: true, key: raw };
}

export type SrmIdempotencyCheckResult =
  | { type: "miss" }
  | { type: "replay"; statusCode: number; bodyText: string }
  | { type: "conflict" };

export async function checkSrmIdempotency(
  prisma: PrismaClient,
  args: { tenantId: string; surface: string; idempotencyKey: string; bodyHash: string },
): Promise<SrmIdempotencyCheckResult> {
  const row = await prisma.srmIntegrationIdempotency.findUnique({
    where: {
      tenantId_surface_key: {
        tenantId: args.tenantId,
        surface: args.surface,
        key: args.idempotencyKey,
      },
    },
  });
  if (!row) return { type: "miss" };
  if (row.bodySha256 !== args.bodyHash) return { type: "conflict" };
  return { type: "replay", statusCode: row.statusCode, bodyText: row.responseBody };
}

export async function storeSrmIdempotency(
  prisma: PrismaClient,
  args: {
    tenantId: string;
    surface: string;
    idempotencyKey: string;
    bodyHash: string;
    statusCode: number;
    responseBody: string;
  },
): Promise<void> {
  try {
    await prisma.srmIntegrationIdempotency.create({
      data: {
        tenantId: args.tenantId,
        surface: args.surface,
        key: args.idempotencyKey,
        bodySha256: args.bodyHash,
        statusCode: args.statusCode,
        responseBody: args.responseBody,
      },
    });
  } catch (e: unknown) {
    const code = typeof e === "object" && e !== null && "code" in e ? (e as { code: string }).code : null;
    if (code === "P2002") {
      // Lost race: treat as idempotent re-read
      return;
    }
    throw e;
  }
}
