import { z } from "zod";

import { TWIN_LIST_LIMIT_MAX } from "@/lib/supply-chain-twin/request-budgets";
import { TWIN_ENTITY_KINDS, type TwinEntityKind } from "@/lib/supply-chain-twin/types";

const twinEntitiesCursorPayloadSchema = z.object({
  u: z.string().datetime(),
  i: z.string().min(1),
});

const twinEntityKindEnumSchema = z.enum(
  TWIN_ENTITY_KINDS as unknown as [TwinEntityKind, ...TwinEntityKind[]],
);

const twinEntityCatalogFieldsSchema = z.enum(["summary", "full"]);

/** GET `/api/supply-chain-twin/entities` — search + pagination (API caps `limit` at standard Twin max). */
export const twinEntitiesQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(256)
    .optional()
    .transform((value) => value ?? ""),
  limit: z.coerce.number().int().min(1).max(TWIN_LIST_LIMIT_MAX).optional().default(TWIN_LIST_LIMIT_MAX),
  cursor: z
    .string()
    .trim()
    .max(512)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  /**
   * Optional strict filter on stored `entityKind` (must match {@link TWIN_ENTITY_KINDS}). Composes with `q` and
   * `cursor`; unknown values → **400**.
   */
  entityKind: z.preprocess((val) => {
    if (val === undefined || val === null || val === "") return undefined;
    if (typeof val === "string") {
      const t = val.trim();
      return t.length === 0 ? undefined : t;
    }
    return val;
  }, twinEntityKindEnumSchema.optional()),
  /**
   * Slice 70: `summary` (default) omits `payload` per row (**0** on-wire bytes for that field). `full` includes JSON
   * `payload` with no server-side truncation — keep `limit` small when using `full`. Unknown values → **400**.
   */
  fields: z.preprocess((val) => {
    if (val === undefined || val === null || val === "") return undefined;
    if (typeof val === "string") {
      const t = val.trim().toLowerCase();
      return t.length === 0 ? undefined : t;
    }
    return val;
  }, twinEntityCatalogFieldsSchema.default("summary")),
});

export type TwinEntitiesQuery = z.infer<typeof twinEntitiesQuerySchema>;

export function encodeTwinEntitiesCursor(payload: { updatedAt: Date; id: string }): string {
  const inner = JSON.stringify({ u: payload.updatedAt.toISOString(), i: payload.id });
  return Buffer.from(inner, "utf8").toString("base64url");
}

export function decodeTwinEntitiesCursor(
  cursor: string,
): { ok: true; updatedAt: Date; id: string } | { ok: false } {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const raw: unknown = JSON.parse(json);
    const parsed = twinEntitiesCursorPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false };
    }
    return { ok: true, updatedAt: new Date(parsed.data.u), id: parsed.data.i };
  } catch {
    return { ok: false };
  }
}

export function parseTwinEntitiesQuery(searchParams: URLSearchParams): {
  ok: true;
  query: TwinEntitiesQuery;
} | {
  ok: false;
  error: string;
} {
  const raw = Object.fromEntries(searchParams.entries());
  const parsed = twinEntitiesQuerySchema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const first =
      flat.q?.[0] ??
      flat.limit?.[0] ??
      flat.cursor?.[0] ??
      flat.entityKind?.[0] ??
      flat.fields?.[0] ??
      parsed.error.issues[0]?.message ??
      parsed.error.message;
    return { ok: false, error: first };
  }
  return { ok: true, query: parsed.data };
}
