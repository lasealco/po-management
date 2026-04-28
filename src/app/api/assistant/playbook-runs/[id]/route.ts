import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getViewerGrantSet } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import {
  parseAssistantPlaybookRunStatus,
  parseAssistantPlaybookStepStatus,
  parseAssistantWorkPriority,
  parseOptionalDueAt,
} from "@/lib/assistant/work-engine";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await getViewerGrantSet();
  if (!access?.user) return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const stepId = typeof o.stepId === "string" ? o.stepId : "";
  const stepStatus = parseAssistantPlaybookStepStatus(o.stepStatus);
  const runStatus = Object.prototype.hasOwnProperty.call(o, "status") ? parseAssistantPlaybookRunStatus(o.status) : null;
  if (Object.prototype.hasOwnProperty.call(o, "status") && !runStatus) {
    return toApiErrorResponse({ error: "Invalid playbook run status.", code: "BAD_INPUT", status: 400 });
  }
  if (stepId && !stepStatus) {
    return toApiErrorResponse({ error: "valid stepStatus is required with stepId.", code: "BAD_INPUT", status: 400 });
  }
  const dueAt = Object.prototype.hasOwnProperty.call(o, "dueAt") ? parseOptionalDueAt(o.dueAt) : undefined;
  if (Object.prototype.hasOwnProperty.call(o, "dueAt") && dueAt === undefined) {
    return toApiErrorResponse({ error: "dueAt must be an ISO date or null.", code: "BAD_INPUT", status: 400 });
  }
  const priority = Object.prototype.hasOwnProperty.call(o, "priority") ? parseAssistantWorkPriority(o.priority) : undefined;

  const run = await prisma.assistantPlaybookRun.findFirst({
    where: { id, tenantId: tenant.id },
    select: { steps: true },
  });
  if (!run) return toApiErrorResponse({ error: "Playbook run not found.", code: "NOT_FOUND", status: 404 });

  const steps = Array.isArray(run.steps) ? run.steps : [];
  const nextSteps = stepId
    ? steps.map((step) =>
        step && typeof step === "object" && (step as Record<string, unknown>).id === stepId
          ? {
              ...(step as Record<string, unknown>),
              status: stepStatus ?? (step as Record<string, unknown>).status,
              note:
                typeof o.note === "string"
                  ? o.note.trim().slice(0, 2000)
                  : typeof (step as Record<string, unknown>).note === "string"
                    ? (step as Record<string, unknown>).note
                    : undefined,
            }
          : step,
      )
    : steps;
  const complete = nextSteps.every((step) => {
    if (!step || typeof step !== "object") return false;
    const status = (step as Record<string, unknown>).status;
    return status === "done" || status === "skipped";
  });
  await prisma.assistantPlaybookRun.update({
    where: { id },
    data: {
      steps: nextSteps as Prisma.InputJsonValue,
      status: runStatus ?? (complete ? "COMPLETED" : "IN_PROGRESS"),
      completedAt: runStatus === "COMPLETED" || complete ? new Date() : runStatus === "IN_PROGRESS" ? null : undefined,
      ...(priority ? { priority } : {}),
      ...(dueAt !== undefined ? { dueAt } : {}),
    },
  });

  return NextResponse.json({ ok: true, status: runStatus ?? (complete ? "COMPLETED" : "IN_PROGRESS"), steps: nextSteps });
}
