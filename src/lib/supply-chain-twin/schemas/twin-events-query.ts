import type { Prisma } from "@prisma/client";
import { z } from "zod";

const twinEventsCursorPayloadSchema = z.object({
  c: z.string().datetime(),
  i: z.string().min(1),
});

/**
 * `GET …/events?type=` — optional filter on `SupplyChainTwinIngestEvent.type`.
 *
 * - **Exact:** `type=entity_upsert` → `type` equals `entity_upsert` (index-friendly with `tenantId`).
 * - **Prefix:** `type=entity_*` → `type` **starts with** `entity_` (uses `@@index([tenantId, type, createdAt])`).
 * - A lone `*` is invalid.
 *
 * Legacy alias **`eventType`** is accepted when **`type`** is omitted; if both are present, **`type`** wins.
 */
export const twinEventsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    cursor: z
      .string()
      .trim()
      .max(512)
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined)),
    type: z
      .string()
      .trim()
      .max(128)
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined)),
  })
  .superRefine((data, ctx) => {
    if (data.type === "*") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Type filter cannot be `*` alone.",
        path: ["type"],
      });
      return;
    }
    if (data.type?.endsWith("*")) {
      const prefix = data.type.slice(0, -1);
      if (prefix.trim().length === 0 || !/[^*]/.test(prefix)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Prefix before `*` must contain at least one non-`*` character.",
          path: ["type"],
        });
      }
    }
  });

export type TwinEventsQuery = z.infer<typeof twinEventsQuerySchema>;

/** Maps public `type` / `type=prefix*` query strings to a Prisma `StringFilter` on `SupplyChainTwinIngestEvent.type`. */
export function twinEventsTypePrismaFilter(type: string): Prisma.StringFilter {
  if (type.endsWith("*") && type.length > 1) {
    return { startsWith: type.slice(0, -1) };
  }
  return { equals: type };
}

export function encodeTwinEventsCursor(payload: { createdAt: Date; id: string }): string {
  const inner = JSON.stringify({ c: payload.createdAt.toISOString(), i: payload.id });
  return Buffer.from(inner, "utf8").toString("base64url");
}

export function decodeTwinEventsCursor(
  cursor: string,
): { ok: true; createdAt: Date; id: string } | { ok: false } {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const raw: unknown = JSON.parse(json);
    const parsed = twinEventsCursorPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false };
    }
    return { ok: true, createdAt: new Date(parsed.data.c), id: parsed.data.i };
  } catch {
    return { ok: false };
  }
}

export function parseTwinEventsQuery(searchParams: URLSearchParams): {
  ok: true;
  query: TwinEventsQuery;
} | {
  ok: false;
  error: string;
} {
  const raw = Object.fromEntries(searchParams.entries());
  const typePrimary =
    typeof raw.type === "string" && raw.type.trim().length > 0 ? raw.type.trim() : undefined;
  const typeLegacy =
    typeof raw.eventType === "string" && raw.eventType.trim().length > 0 ? raw.eventType.trim() : undefined;
  const mergedType = typePrimary ?? typeLegacy;

  const parsed = twinEventsQuerySchema.safeParse({
    limit: raw.limit,
    cursor: raw.cursor,
    type: mergedType,
  });
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const first =
      flat.limit?.[0] ??
      flat.cursor?.[0] ??
      flat.type?.[0] ??
      parsed.error.issues.find((i) => i.path.join(".") === "type")?.message ??
      parsed.error.issues[0]?.message ??
      parsed.error.message;
    return { ok: false, error: first };
  }
  return { ok: true, query: parsed.data };
}
