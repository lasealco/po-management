import { z } from "zod";

export const scriTaskLinkBodySchema = z.object({
  sourceModule: z.string().min(1).max(64),
  taskRef: z.string().min(1).max(512),
  status: z.string().max(32).optional().nullable(),
  note: z.string().max(4000).optional().nullable(),
});

export type ScriTaskLinkBody = z.infer<typeof scriTaskLinkBodySchema>;
