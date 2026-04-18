import type { SupplierOnboardingTaskStatus } from "@prisma/client";

const STATUSES: SupplierOnboardingTaskStatus[] = ["pending", "done", "waived"];

export type ParsedOnboardingTaskPatch = {
  status?: SupplierOnboardingTaskStatus;
  notes?: string | null;
};

export type ParseOnboardingPatchResult =
  | { ok: true; data: ParsedOnboardingTaskPatch }
  | { ok: false; message: string };

function isStatus(v: string): v is SupplierOnboardingTaskStatus {
  return STATUSES.includes(v as SupplierOnboardingTaskStatus);
}

/**
 * Validates JSON body for PATCH `/api/suppliers/[id]/onboarding-tasks/[taskId]`.
 * Caller applies `completedAt` when status becomes `done` or `waived`, and clears it when returning to `pending`.
 */
export function parseOnboardingTaskPatchBody(
  o: Record<string, unknown>,
): ParseOnboardingPatchResult {
  const data: ParsedOnboardingTaskPatch = {};

  if (o.status !== undefined) {
    if (typeof o.status !== "string" || !isStatus(o.status)) {
      return { ok: false, message: "status must be pending, done, or waived." };
    }
    data.status = o.status;
  }

  if (o.notes !== undefined) {
    if (o.notes === null) {
      data.notes = null;
    } else if (typeof o.notes === "string") {
      const t = o.notes.trim();
      data.notes = t ? t.slice(0, 8000) : null;
    } else {
      return { ok: false, message: "Invalid notes." };
    }
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, message: "No fields to update." };
  }

  return { ok: true, data };
}
