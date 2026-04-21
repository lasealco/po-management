import { z } from "zod";

/**
 * `POST …/scenarios/[id]/duplicate` — optional `titleSuffix` appended to the source title (source trimmed for
 * concatenation only); omit or empty string leaves the title unchanged from the source row.
 */
export const twinScenarioDraftDuplicateBodySchema = z.object({
  titleSuffix: z
    .string()
    .max(200)
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      const t = v.trim();
      return t.length > 0 ? t : undefined;
    }),
});

export type TwinScenarioDraftDuplicateBody = z.infer<typeof twinScenarioDraftDuplicateBodySchema>;

export function parseTwinScenarioDraftDuplicateBody(
  raw: unknown,
): { ok: true; body: TwinScenarioDraftDuplicateBody } | { ok: false; error: string } {
  if (raw == null) {
    const parsed = twinScenarioDraftDuplicateBodySchema.safeParse({});
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? parsed.error.message;
      return { ok: false, error: first };
    }
    return { ok: true, body: parsed.data };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const parsed = twinScenarioDraftDuplicateBodySchema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const first = flat.titleSuffix?.[0] ?? parsed.error.issues[0]?.message ?? parsed.error.message;
    return { ok: false, error: first };
  }
  return { ok: true, body: parsed.data };
}
