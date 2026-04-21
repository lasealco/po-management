import { TwinRiskSeverity } from "@prisma/client";
import { z } from "zod";

const twinRiskSignalsCursorPayloadSchema = z.object({
  c: z.string().datetime(),
  i: z.string().min(1),
});

/**
 * GET `/api/supply-chain-twin/risk-signals` — list rows (newest `createdAt` first).
 *
 * Optional **`severity`** — strict {@link TwinRiskSeverity} (case-sensitive; invalid → **400**). Blank / whitespace
 * is treated as omitted. Composes with **`limit`** and opaque **`cursor`** (keyset).
 */
export const twinRiskSignalsListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z
    .string()
    .trim()
    .max(512)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  severity: z.preprocess((val) => {
    if (val === undefined || val === null || val === "") return undefined;
    if (typeof val === "string") {
      const t = val.trim();
      return t.length === 0 ? undefined : t;
    }
    return val;
  }, z.nativeEnum(TwinRiskSeverity).optional()),
});

export type TwinRiskSignalsListQuery = z.infer<typeof twinRiskSignalsListQuerySchema>;

export function encodeTwinRiskSignalsListCursor(payload: { createdAt: Date; id: string }): string {
  const inner = JSON.stringify({ c: payload.createdAt.toISOString(), i: payload.id });
  return Buffer.from(inner, "utf8").toString("base64url");
}

export function decodeTwinRiskSignalsListCursor(
  cursor: string,
): { ok: true; createdAt: Date; id: string } | { ok: false } {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const raw: unknown = JSON.parse(json);
    const parsed = twinRiskSignalsCursorPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false };
    }
    return { ok: true, createdAt: new Date(parsed.data.c), id: parsed.data.i };
  } catch {
    return { ok: false };
  }
}

export function parseTwinRiskSignalsListQuery(searchParams: URLSearchParams): {
  ok: true;
  query: TwinRiskSignalsListQuery;
} | {
  ok: false;
  error: string;
} {
  const raw = Object.fromEntries(searchParams.entries());
  const parsed = twinRiskSignalsListQuerySchema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const first =
      flat.limit?.[0] ??
      flat.cursor?.[0] ??
      flat.severity?.[0] ??
      parsed.error.issues[0]?.message ??
      parsed.error.message;
    return { ok: false, error: first };
  }
  return { ok: true, query: parsed.data };
}
