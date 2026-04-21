import { z } from "zod";

const twinScenariosListCursorPayloadSchema = z.object({
  u: z.string().datetime(),
  i: z.string().min(1),
});

/** GET `/api/supply-chain-twin/scenarios` — list drafts (newest `updatedAt` first). */
export const twinScenariosListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z
    .string()
    .trim()
    .max(512)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

export type TwinScenariosListQuery = z.infer<typeof twinScenariosListQuerySchema>;

export function encodeTwinScenariosListCursor(payload: { updatedAt: Date; id: string }): string {
  const inner = JSON.stringify({ u: payload.updatedAt.toISOString(), i: payload.id });
  return Buffer.from(inner, "utf8").toString("base64url");
}

export function decodeTwinScenariosListCursor(
  cursor: string,
): { ok: true; updatedAt: Date; id: string } | { ok: false } {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const raw: unknown = JSON.parse(json);
    const parsed = twinScenariosListCursorPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false };
    }
    return { ok: true, updatedAt: new Date(parsed.data.u), id: parsed.data.i };
  } catch {
    return { ok: false };
  }
}

export function parseTwinScenariosListQuery(searchParams: URLSearchParams): {
  ok: true;
  query: TwinScenariosListQuery;
} | {
  ok: false;
  error: string;
} {
  const raw = Object.fromEntries(searchParams.entries());
  const parsed = twinScenariosListQuerySchema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const first =
      flat.limit?.[0] ??
      flat.cursor?.[0] ??
      parsed.error.issues[0]?.message ??
      parsed.error.message;
    return { ok: false, error: first };
  }
  return { ok: true, query: parsed.data };
}
