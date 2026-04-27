import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getViewerGrantSet } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

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
  const stepStatus = typeof o.stepStatus === "string" ? o.stepStatus : "";
  if (!stepId || !["done", "available", "needs_review", "skipped"].includes(stepStatus)) {
    return toApiErrorResponse({ error: "stepId and valid stepStatus are required.", code: "BAD_INPUT", status: 400 });
  }

  const run = await prisma.assistantPlaybookRun.findFirst({
    where: { id, tenantId: tenant.id },
    select: { steps: true },
  });
  if (!run) return toApiErrorResponse({ error: "Playbook run not found.", code: "NOT_FOUND", status: 404 });

  const steps = Array.isArray(run.steps) ? run.steps : [];
  const nextSteps = steps.map((step) =>
    step && typeof step === "object" && (step as Record<string, unknown>).id === stepId
      ? { ...(step as Record<string, unknown>), status: stepStatus }
      : step,
  );
  const complete = nextSteps.every((step) => {
    if (!step || typeof step !== "object") return false;
    const status = (step as Record<string, unknown>).status;
    return status === "done" || status === "skipped";
  });
  await prisma.assistantPlaybookRun.update({
    where: { id },
    data: { steps: nextSteps, status: complete ? "COMPLETED" : "IN_PROGRESS" },
  });

  return NextResponse.json({ ok: true, status: complete ? "COMPLETED" : "IN_PROGRESS", steps: nextSteps });
}
