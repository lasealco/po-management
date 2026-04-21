import { z } from "zod";

import { TWIN_ENTITY_KINDS } from "../types";

const twinEntityKindEnum = z.enum(TWIN_ENTITY_KINDS as unknown as [string, ...string[]]);

/** Shared node ref shape for twin API JSON. */
export const twinEntityRefSchema = z.object({
  kind: twinEntityKindEnum,
  id: z.string().min(1),
});
