import type { Prisma } from "@prisma/client";
import { z } from "zod";

const twinEventsCursorPayloadSchema = z.object({
  c: z.string().datetime(),
  i: z.string().min(1),
});

/** Hard cap on `until - since` for `GET …/events` (Slice 68). Documented on the route handler. */
export const TWIN_EVENTS_QUERY_MAX_WINDOW_DAYS = 31;

const MS_PER_DAY = 86_400_000;

const optionalIsoDateTime = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
  z.string().datetime({ offset: true }).optional(),
);

/**
 * `GET …/events?type=` — optional filter on `SupplyChainTwinIngestEvent.type`.
 *
 * - **Exact:** `type=entity_upsert` → `type` equals `entity_upsert` (index-friendly with `tenantId`).
 * - **Prefix:** `type=entity_*` → `type` **starts with** `entity_` (uses `@@index([tenantId, type, createdAt])`).
 * - A lone `*` is invalid.
 *
 * Legacy alias **`eventType`** is accepted when **`type`** is omitted; if both are present, **`type`** wins.
 *
 * **`since` / `until` (Slice 68):** optional ISO-8601 bounds on `createdAt` (same wire format as cursor payloads).
 * Both must be sent together; `since` ≤ `until`; span ≤ {@link TWIN_EVENTS_QUERY_MAX_WINDOW_DAYS} days.
 *
 * **`includePayload` (Slice 69):** optional boolean (coerces `true`/`false`/`1`/`0` strings). Default **true** — list rows
 * include `payload`; when **false**, responses omit `payload` and the DB read skips `payloadJson` (lighter over the wire).
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
    since: optionalIsoDateTime,
    until: optionalIsoDateTime,
    includePayload: z.preprocess((val) => {
      if (val === undefined || val === null || val === "") {
        return true;
      }
      if (typeof val === "boolean") {
        return val;
      }
      if (typeof val === "string") {
        const t = val.trim().toLowerCase();
        if (t === "false" || t === "0") {
          return false;
        }
        if (t === "true" || t === "1") {
          return true;
        }
      }
      return val;
    }, z.boolean()),
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
  })
  .superRefine((data, ctx) => {
    const hasSince = data.since != null;
    const hasUntil = data.until != null;
    if (hasSince !== hasUntil) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Parameters `since` and `until` must both be provided together, or both omitted.",
        path: hasSince ? ["until"] : ["since"],
      });
      return;
    }
    if (data.since === undefined || data.until === undefined) {
      return;
    }
    const start = new Date(data.since).getTime();
    const end = new Date(data.until).getTime();
    if (start > end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "`since` must be on or before `until`.",
        path: ["since"],
      });
      return;
    }
    const spanMs = end - start;
    const maxMs = TWIN_EVENTS_QUERY_MAX_WINDOW_DAYS * MS_PER_DAY;
    if (spanMs > maxMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Time window cannot exceed ${TWIN_EVENTS_QUERY_MAX_WINDOW_DAYS} days.`,
        path: ["until"],
      });
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

  const since = searchParams.get("since") ?? undefined;
  const until = searchParams.get("until") ?? undefined;
  const includePayload = searchParams.get("includePayload") ?? undefined;

  const parsed = twinEventsQuerySchema.safeParse({
    limit: raw.limit,
    cursor: raw.cursor,
    type: mergedType,
    since,
    until,
    includePayload,
  });
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const first =
      flat.limit?.[0] ??
      flat.cursor?.[0] ??
      flat.type?.[0] ??
      flat.includePayload?.[0] ??
      flat.since?.[0] ??
      flat.until?.[0] ??
      parsed.error.issues.find((i) => i.path.join(".") === "type")?.message ??
      parsed.error.issues[0]?.message ??
      parsed.error.message;
    return { ok: false, error: first };
  }
  return { ok: true, query: parsed.data };
}
