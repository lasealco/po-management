/**
 * Placeholder for org-wide notifications (email, in-app, webhooks).
 * Emits a structured log line so ops can forward or wire a provider later.
 */
export function scriNotificationHook(payload: {
  kind: "ACTION_REQUIRED" | "REVIEW_STATE";
  tenantId: string;
  eventId: string;
  reviewState: string;
  previousReviewState?: string;
  actorUserId: string;
}) {
  console.log(
    JSON.stringify({
      module: "scri",
      channel: "notification_hook",
      ...payload,
    }),
  );
}
