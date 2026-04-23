/**
 * Optional G follow-up: when `SRM_OPERATOR_WEBHOOK_URL` is set, POST a JSON payload to
 * that URL after an in-app `SrmOperatorNotification` row is created.
 *
 * **Opt-in** — no URL means no request. Optional `SRM_OPERATOR_WEBHOOK_SECRET` is sent
 * as `X-SRM-Webhook-Secret` for receiver verification. In-app rows remain the source of truth.
 */
const URL_ENV = "SRM_OPERATOR_WEBHOOK_URL";
const SECRET_ENV = "SRM_OPERATOR_WEBHOOK_SECRET";

export function getSrmOperatorWebhookUrl(): string | null {
  const raw = process.env[URL_ENV]?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function webhookSecretHeader(): string | null {
  const s = process.env[SECRET_ENV]?.trim();
  return s || null;
}

const MAX_BODY_LENGTH = 32_000;

export type SrmOperatorNotificationWebhookPayload = {
  specVersion: 1;
  event: "srm.operator_notification.created";
  notification: {
    id: string;
    tenantId: string;
    userId: string;
    kind: string;
    title: string;
    body: string | null;
    supplierId: string | null;
    taskId: string | null;
    actorUserId: string | null;
    createdAt: string;
  };
};

/**
 * @returns whether the HTTP POST completed with a 2xx response (false if skipped or error)
 */
export async function postSrmOperatorNotificationWebhook(
  row: SrmOperatorNotificationWebhookPayload["notification"],
): Promise<boolean> {
  const url = getSrmOperatorWebhookUrl();
  if (!url) return false;

  const bodyText = row.body;
  const bodyOut =
    bodyText && bodyText.length > MAX_BODY_LENGTH
      ? `${bodyText.slice(0, MAX_BODY_LENGTH)}…`
      : bodyText;

  const payload: SrmOperatorNotificationWebhookPayload = {
    specVersion: 1,
    event: "srm.operator_notification.created",
    notification: { ...row, body: bodyOut },
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const secret = webhookSecretHeader();
  if (secret) headers["X-SRM-Webhook-Secret"] = secret;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}
