export const ASSISTANT_WORK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const ASSISTANT_ACTION_STATUSES = ["PENDING", "APPROVED", "REJECTED", "DONE"] as const;
export const ASSISTANT_PLAYBOOK_RUN_STATUSES = ["IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED"] as const;
export const ASSISTANT_PLAYBOOK_STEP_STATUSES = ["available", "needs_review", "blocked", "done", "skipped"] as const;

export type AssistantWorkPriority = (typeof ASSISTANT_WORK_PRIORITIES)[number];
export type AssistantActionStatus = (typeof ASSISTANT_ACTION_STATUSES)[number];
export type AssistantPlaybookRunStatus = (typeof ASSISTANT_PLAYBOOK_RUN_STATUSES)[number];
export type AssistantPlaybookStepStatus = (typeof ASSISTANT_PLAYBOOK_STEP_STATUSES)[number];

export type AssistantPlaybookStepInput = {
  id: string;
  title: string;
  description?: string;
  status?: AssistantPlaybookStepStatus;
  note?: string;
};

export function parseAssistantWorkPriority(value: unknown): AssistantWorkPriority {
  if (typeof value !== "string") return "MEDIUM";
  const normalized = value.trim().toUpperCase();
  return ASSISTANT_WORK_PRIORITIES.includes(normalized as AssistantWorkPriority)
    ? (normalized as AssistantWorkPriority)
    : "MEDIUM";
}

export function parseAssistantActionStatus(value: unknown): AssistantActionStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return ASSISTANT_ACTION_STATUSES.includes(normalized as AssistantActionStatus)
    ? (normalized as AssistantActionStatus)
    : null;
}

export function parseAssistantPlaybookRunStatus(value: unknown): AssistantPlaybookRunStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return ASSISTANT_PLAYBOOK_RUN_STATUSES.includes(normalized as AssistantPlaybookRunStatus)
    ? (normalized as AssistantPlaybookRunStatus)
    : null;
}

export function parseAssistantPlaybookStepStatus(value: unknown): AssistantPlaybookStepStatus | null {
  if (typeof value !== "string") return null;
  return ASSISTANT_PLAYBOOK_STEP_STATUSES.includes(value as AssistantPlaybookStepStatus)
    ? (value as AssistantPlaybookStepStatus)
    : null;
}

export function parseOptionalDueAt(value: unknown): Date | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

export function normalizePlaybookSteps(value: unknown): AssistantPlaybookStepInput[] | null {
  if (!Array.isArray(value)) return null;
  const steps = value
    .map((raw, index): AssistantPlaybookStepInput | null => {
      const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const title = typeof item.title === "string" ? item.title.trim() : "";
      if (!title) return null;
      const id = typeof item.id === "string" && item.id.trim() ? item.id.trim().slice(0, 80) : `step-${index + 1}`;
      const status = parseAssistantPlaybookStepStatus(item.status) ?? "available";
      return {
        id,
        title: title.slice(0, 180),
        description: typeof item.description === "string" ? item.description.trim().slice(0, 1000) : undefined,
        status,
        note: typeof item.note === "string" ? item.note.trim().slice(0, 2000) : undefined,
      };
    })
    .filter((step): step is AssistantPlaybookStepInput => step != null);
  return steps.length > 0 ? steps.slice(0, 25) : null;
}

export function computeDueAtFromSla(start: Date, slaHours: number | null | undefined) {
  if (!slaHours || !Number.isFinite(slaHours) || slaHours <= 0) return null;
  return new Date(start.getTime() + Math.min(Math.floor(slaHours), 24 * 90) * 60 * 60 * 1000);
}

export function isStaleWork(now: Date, dueAt: Date | string | null | undefined, status: string) {
  if (!dueAt || status === "DONE" || status === "COMPLETED" || status === "REJECTED" || status === "CANCELLED") return false;
  return new Date(dueAt).getTime() < now.getTime();
}
