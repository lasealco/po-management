import { z } from "zod";
import { firstZodFieldError } from "./first-zod-error";

const twinRiskSignalAckPatchSchema = z.object({
  acknowledged: z.boolean(),
});

export type TwinRiskSignalAckPatch = z.infer<typeof twinRiskSignalAckPatchSchema>;

export function parseTwinRiskSignalAckPatchBody(raw: unknown):
  | { ok: true; body: TwinRiskSignalAckPatch }
  | { ok: false; error: string } {
  const parsed = twinRiskSignalAckPatchSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodFieldError(parsed.error, ["acknowledged"]) };
  }
  return { ok: true, body: parsed.data };
}
