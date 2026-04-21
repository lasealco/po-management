import { z } from "zod";

/** Max UTF-8 bytes of `JSON.stringify(draft)` for POST/PATCH bodies (generous for UI drafts; not logged on reject). */
export const TWIN_SCENARIO_DRAFT_MAX_JSON_BYTES = 65_536;

/**
 * Stable machine code when serialized `draft` JSON exceeds {@link TWIN_SCENARIO_DRAFT_MAX_JSON_BYTES} (no PII).
 * Same role as `TWIN_INGEST_PAYLOAD_TOO_LARGE` on twin ingest POST.
 */
export const TWIN_SCENARIO_DRAFT_JSON_TOO_LARGE = "TWIN_SCENARIO_DRAFT_JSON_TOO_LARGE" as const;

const draftObjectSchema = z.record(z.string(), z.unknown());

export const twinScenarioDraftCreateBodySchema = z
  .object({
    title: z
      .string()
      .trim()
      .max(200)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    draft: draftObjectSchema,
  })
  .superRefine((data, ctx) => {
    try {
      const bytes = Buffer.byteLength(JSON.stringify(data.draft), "utf8");
      if (bytes > TWIN_SCENARIO_DRAFT_MAX_JSON_BYTES) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["draft"],
          message: `Draft JSON exceeds maximum size (${TWIN_SCENARIO_DRAFT_MAX_JSON_BYTES} bytes).`,
        });
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["draft"],
        message: "Draft JSON could not be serialized.",
      });
    }
  });

export type TwinScenarioDraftCreateBody = z.infer<typeof twinScenarioDraftCreateBodySchema>;

export function parseTwinScenarioDraftCreateBody(
  raw: unknown,
):
  | { ok: true; body: TwinScenarioDraftCreateBody }
  | { ok: false; error: string } {
  const parsed = twinScenarioDraftCreateBodySchema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const first =
      flat.title?.[0] ??
      flat.draft?.[0] ??
      parsed.error.issues[0]?.message ??
      parsed.error.message;
    return { ok: false, error: first };
  }
  return { ok: true, body: parsed.data };
}
