import { z } from "zod";

/** Opaque snapshot row id (Prisma `cuid()` / `cuid2()` — avoid overly strict pattern validation). */
const snapshotIdParam = z.preprocess(
  (v) => (v === "" || v === undefined ? undefined : v),
  z.string().trim().min(1).max(128).optional(),
);

const twinEdgesQueryInputSchema = z.object({
  fromSnapshotId: snapshotIdParam,
  toSnapshotId: snapshotIdParam,
  snapshotId: snapshotIdParam,
  /**
   * Slice 75: graph-friendly alias for `fromSnapshotId` (Prisma `SupplyChainTwinEntitySnapshot` PK). Mutually exclusive
   * with `fromSnapshotId`; do not combine with `snapshotId`.
   */
  fromEntityId: snapshotIdParam,
  /**
   * Slice 75: graph-friendly alias for `toSnapshotId`. Mutually exclusive with `toSnapshotId` and with `fromEntityId`
   * (use `fromSnapshotId` + `toSnapshotId` when filtering both endpoints).
   */
  toEntityId: snapshotIdParam,
  direction: z.enum(["out", "in", "both"]).optional().default("both"),
  take: z.coerce.number().int().min(1).max(500).optional().default(200),
});

/**
 * Normalized query for `GET /api/supply-chain-twin/edges` (entity id aliases merged into snapshot id fields).
 */
export const twinEdgesQuerySchema = twinEdgesQueryInputSchema
  .superRefine((data, ctx) => {
    if (data.snapshotId && (data.fromSnapshotId || data.toSnapshotId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["snapshotId"],
        message: "snapshotId cannot be combined with fromSnapshotId or toSnapshotId",
      });
    }
    if (data.snapshotId && (data.fromEntityId || data.toEntityId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["snapshotId"],
        message: "snapshotId cannot be combined with fromEntityId or toEntityId",
      });
    }
    if (data.fromEntityId && data.fromSnapshotId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fromEntityId"],
        message: "fromEntityId cannot be combined with fromSnapshotId",
      });
    }
    if (data.toEntityId && data.toSnapshotId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toEntityId"],
        message: "toEntityId cannot be combined with toSnapshotId",
      });
    }
    if (data.fromEntityId && data.toEntityId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fromEntityId"],
        message: "Provide at most one of fromEntityId or toEntityId (use fromSnapshotId and toSnapshotId to filter both endpoints).",
      });
    }
  })
  .transform(({ fromEntityId, toEntityId, fromSnapshotId, toSnapshotId, snapshotId, direction, take }) => ({
    snapshotId,
    direction,
    take,
    fromSnapshotId: fromSnapshotId ?? fromEntityId,
    toSnapshotId: toSnapshotId ?? toEntityId,
  }));

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
    const flat = parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>;
    const first =
      flat.fromSnapshotId?.[0] ??
      flat.toSnapshotId?.[0] ??
      flat.snapshotId?.[0] ??
      flat.fromEntityId?.[0] ??
      flat.toEntityId?.[0] ??
      flat.direction?.[0] ??
      flat.take?.[0] ??
      parsed.error.issues[0]?.message ??
      parsed.error.message;
    return { ok: false, error: first };
  }
  return { ok: true, query: parsed.data };
}
