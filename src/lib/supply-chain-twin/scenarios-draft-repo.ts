import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type CreateScenarioDraftInput = {
  title?: string | null;
  /** Stored as JSON; must serialize under the API byte cap before insert. */
  draft: Prisma.InputJsonValue;
};

/**
 * Persists a new draft scenario row for the tenant. No solver or graph mutation.
 */
export async function createScenarioDraft(
  tenantId: string,
  input: CreateScenarioDraftInput,
): Promise<{ id: string; title: string | null; status: string; updatedAt: Date }> {
  const title = input.title?.trim() ? input.title.trim() : null;
  return prisma.supplyChainTwinScenarioDraft.create({
    data: {
      tenantId,
      title,
      status: "draft",
      draftJson: input.draft,
    },
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
    },
  });
}
