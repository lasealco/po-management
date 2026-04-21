import { z } from "zod";

import { TWIN_ENTITY_KINDS } from "@/lib/supply-chain-twin/types";

export const twinEntityDtoSchema = z.object({
  kind: z.enum(TWIN_ENTITY_KINDS),
  id: z.string().min(1),
  sourceSystem: z.string().min(1).nullish(),
  sourceRef: z.string().min(1).nullish(),
});

export const twinEdgeDtoSchema = z.object({
  from: twinEntityDtoSchema,
  to: twinEntityDtoSchema,
  relation: z.string().min(1).nullish(),
  sourceSystem: z.string().min(1).nullish(),
  sourceRef: z.string().min(1).nullish(),
});
