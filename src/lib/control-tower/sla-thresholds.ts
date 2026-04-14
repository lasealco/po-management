/** Control Tower SLA response windows (hours), aligned with Shipment 360 badges. */
export function ctSlaThresholdHours(severity: string): number {
  if (severity === "CRITICAL") return 24;
  if (severity === "WARN") return 48;
  return 72;
}

export function ctSlaAgeHours(createdAt: Date): number {
  return Math.floor((Date.now() - createdAt.getTime()) / 3_600_000);
}

export function ctSlaBreached(createdAt: Date, severity: string): boolean {
  return ctSlaAgeHours(createdAt) > ctSlaThresholdHours(severity);
}

/** Shipment 360 badges and server checks (floor age in hours vs threshold). */
export function ctSlaState(createdAt: string | Date, severity: string) {
  const d = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  const ageHours = Number.isNaN(d.getTime())
    ? 0
    : Math.floor((Date.now() - d.getTime()) / 3_600_000);
  const threshold = ctSlaThresholdHours(severity || "WARN");
  return { ageHours, threshold, breached: ageHours > threshold };
}
