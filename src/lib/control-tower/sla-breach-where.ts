import { ctSlaThresholdHours } from "./sla-thresholds";

/** Latest `createdAt` for an item to count as past SLA (wall-clock, matches list/escalation logic). */
function maxCreatedAtBeforeBreached(now: Date, severity: string): Date {
  const hours = ctSlaThresholdHours(severity);
  return new Date(now.getTime() - hours * 3_600_000);
}

/** Use as `where: { ..., OR: ctSlaBreachedSeverityBranches(now) }` on alerts/exceptions. */
export function ctSlaBreachedSeverityBranches(now: Date) {
  return [
    {
      severity: "CRITICAL" as const,
      createdAt: { lt: maxCreatedAtBeforeBreached(now, "CRITICAL") },
    },
    {
      severity: "WARN" as const,
      createdAt: { lt: maxCreatedAtBeforeBreached(now, "WARN") },
    },
    {
      severity: "INFO" as const,
      createdAt: { lt: maxCreatedAtBeforeBreached(now, "INFO") },
    },
  ];
}
