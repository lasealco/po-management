import { z } from "zod";

/** Opaque snapshot row id (Prisma `cuid()` / `cuid2()` — avoid overly strict pattern validation). */
const snapshotIdParam = z.preprocess(
  (v) => (v === "" || v === undefined ? undefined : v),
  z.string().trim().min(1).max(128).optional(),
);

export const twinEdgesQuerySchema = z
  .object({
    fromSnapshotId: snapshotIdParam,
    toSnapshotId: snapshotIdParam,
    snapshotId: snapshotIdParam,
    direction: z.enum(["out", "in", "both"]).optional().default("both"),
    take: z.coerce.number().int().min(1).max(500).optional().default(200),
  })
  .superRefine((data, ctx) => {
    if (data.snapshotId && (data.fromSnapshotId || data.toSnapshotId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["snapshotId"],
        message: "snapshotId cannot be combined with fromSnapshotId or toSnapshotId",
      });
    }
  });

export type TwinEdgesQuery = z.infer<typeof twinEdgesQuerySchema>;

export function parseTwinEdgesQuery(searchParams: URLSearchParams): {
  ok: true;
  query: TwinEdgesQuery;
} | {
  ok: false;
  error: string;
} {
  const raw = Object.fromEntries(searchParams.entries());
  const parsed = twinEdgesQuerySchema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const first =
      flat.fromSnapshotId?.[0] ??
      flat.toSnapshotId?.[0] ??
      flat.snapshotId?.[0] ??
      flat.direction?.[0] ??
      flat.take?.[0] ??
      parsed.error.issues[0]?.message ??
      parsed.error.message;
    return { ok: false, error: first };
  }
  return { ok: true, query: parsed.data };
}
