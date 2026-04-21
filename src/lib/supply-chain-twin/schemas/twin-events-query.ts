import { z } from "zod";

const twinEventsCursorPayloadSchema = z.object({
  c: z.string().datetime(),
  i: z.string().min(1),
});

export const twinEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z
    .string()
    .trim()
    .max(512)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  /** Optional filter on `SupplyChainTwinIngestEvent.type`. */
  eventType: z
    .string()
    .trim()
    .max(128)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

export type TwinEventsQuery = z.infer<typeof twinEventsQuerySchema>;

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
  const parsed = twinEventsQuerySchema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const first =
      flat.limit?.[0] ??
      flat.cursor?.[0] ??
      flat.eventType?.[0] ??
      parsed.error.issues[0]?.message ??
      parsed.error.message;
    return { ok: false, error: first };
  }
  return { ok: true, query: parsed.data };
}
