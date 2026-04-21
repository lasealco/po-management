import { z } from "zod";

import { TWIN_INGEST_MAX_PAYLOAD_BYTES } from "@/lib/supply-chain-twin/ingest-writer";

/**
 * `POST /api/supply-chain-twin/events` — append ingest row (`type` + JSON `payload`).
 * Oversize `payload` fails Zod before DB (same byte cap as {@link appendIngestEvent}).
 */
export const twinIngestEventAppendBodySchema = z
  .object({
    type: z
      .string()
      .max(128)
      .transform((s) => s.trim())
      .pipe(z.string().min(1, "type is required after trim")),
    payload: z.unknown(),
  })
  .superRefine((data, ctx) => {
    try {
      const bytes = Buffer.byteLength(JSON.stringify(data.payload), "utf8");
      if (bytes > TWIN_INGEST_MAX_PAYLOAD_BYTES) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["payload"],
          message: `Payload exceeds maximum size (${TWIN_INGEST_MAX_PAYLOAD_BYTES} bytes).`,
        });
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payload"],
        message: "Payload could not be serialized.",
      });
    }
  });

export type TwinIngestEventAppendBody = z.infer<typeof twinIngestEventAppendBodySchema>;

export function parseTwinIngestEventAppendBody(
  raw: unknown,
): { ok: true; body: TwinIngestEventAppendBody } | { ok: false; error: string; payloadTooLarge?: true } {
  const parsed = twinIngestEventAppendBodySchema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const issues = parsed.error.issues;
    const oversize = issues.some(
      (i) => i.path[0] === "payload" && typeof i.message === "string" && i.message.includes("exceeds maximum size"),
    );
    const first =
      flat.type?.[0] ??
      flat.payload?.[0] ??
      issues[0]?.message ??
      parsed.error.message;
    return oversize ? { ok: false, error: first, payloadTooLarge: true } : { ok: false, error: first };
  }
  return { ok: true, body: parsed.data };
}
