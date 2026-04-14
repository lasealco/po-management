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
