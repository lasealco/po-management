import { z } from "zod";

import { TWIN_SCENARIO_DRAFT_MAX_JSON_BYTES } from "./twin-scenario-draft-create";

const draftObjectSchema = z.record(z.string(), z.unknown());

/** Workflow labels accepted on `PATCH` (narrow allowlist; DB column is plain `String`). */
export const twinScenarioDraftPatchStatusSchema = z.enum(["draft", "archived"]);

export type TwinScenarioDraftPatchStatus = z.infer<typeof twinScenarioDraftPatchStatusSchema>;

/**
 * Partial update: at least one of `title`, `draft`, or `status` must be present.
 * `title: null` clears the stored title; omitted `title` leaves it unchanged.
 * `status` is validated here; allowed transitions are enforced in the repo.
 */
export const twinScenarioDraftPatchBodySchema = z
  .object({
    title: z
      .union([z.string().max(200), z.null()])
      .optional()
      .transform((v) => {
        if (v === undefined) return undefined;
        if (v === null) return null;
        const t = v.trim();
        return t.length > 0 ? t : null;
      }),
    draft: draftObjectSchema.optional(),
    status: twinScenarioDraftPatchStatusSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.title === undefined && data.draft === undefined && data.status === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide at least one of title, draft, or status.",
        path: [],
      });
    }
    if (data.draft !== undefined) {
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
    }
  });

export type TwinScenarioDraftPatchBody = z.infer<typeof twinScenarioDraftPatchBodySchema>;

export function parseTwinScenarioDraftPatchBody(
  raw: unknown,
): { ok: true; body: TwinScenarioDraftPatchBody } | { ok: false; error: string } {
  const parsed = twinScenarioDraftPatchBodySchema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const first =
      flat.draft?.[0] ??
      flat.status?.[0] ??
      parsed.error.issues.find((i) => i.path.length === 0)?.message ??
      parsed.error.issues[0]?.message ??
      parsed.error.message;
    return { ok: false, error: first };
  }
  return { ok: true, body: parsed.data };
}
