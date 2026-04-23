import { ScriEventReviewState } from "@prisma/client";
import { z } from "zod";

const reviewStateSchema = z.nativeEnum(ScriEventReviewState);

export const scriEventTriagePatchSchema = z
  .object({
    reviewState: reviewStateSchema.optional(),
    ownerUserId: z.union([z.string().min(1), z.null()]).optional(),
    note: z.string().max(2000).optional().nullable(),
  })
  .refine(
    (d) =>
      d.reviewState !== undefined ||
      d.ownerUserId !== undefined ||
      (d.note != null && d.note.trim().length > 0),
    { message: "Provide reviewState, ownerUserId, or a non-empty note." },
  );

export type ScriEventTriagePatch = z.infer<typeof scriEventTriagePatchSchema>;
