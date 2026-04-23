import { prisma } from "@/lib/prisma";
import type { ScriTaskLinkBody } from "@/lib/scri/schemas/task-link-body";

export type TaskLinkResult =
  | { ok: true; id: string }
  | { ok: false; code: "NOT_FOUND" };

export async function applyScriEventTaskLink(
  tenantId: string,
  eventId: string,
  createdById: string,
  body: ScriTaskLinkBody,
): Promise<TaskLinkResult> {
  const event = await prisma.scriExternalEvent.findFirst({
    where: { id: eventId, tenantId },
    select: { id: true },
  });
  if (!event) return { ok: false, code: "NOT_FOUND" };

  const row = await prisma.scriEventTaskLink.create({
    data: {
      tenantId,
      eventId,
      createdById,
      sourceModule: body.sourceModule.trim(),
      taskRef: body.taskRef.trim(),
      status: body.status?.trim() || null,
      note: body.note?.trim() || null,
    },
    select: { id: true },
  });
  return { ok: true, id: row.id };
}
