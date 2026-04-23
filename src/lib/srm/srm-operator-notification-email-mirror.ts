/**
 * Optional G follow-up: when enabled, mirror in-app SRM operator notifications to the assignee’s
 * work email via Resend (same HTTP API as Control Tower scheduled reports).
 *
 * **Opt-in** — does nothing unless `SRM_OPERATOR_EMAIL_NOTIFICATIONS=1` and Resend is configured.
 */
const FLAG = "SRM_OPERATOR_EMAIL_NOTIFICATIONS";

export function isSrmOperatorEmailMirrorEnabled(): boolean {
  const v = process.env[FLAG];
  return v === "1" || v === "true" || v === "yes";
}

function resendFromAddress(): string | null {
  const srm = process.env.SRM_EMAIL_FROM?.trim();
  if (srm) return srm;
  return process.env.CONTROL_TOWER_REPORTS_EMAIL_FROM?.trim() || null;
}

/**
 * @returns whether the HTTP send succeeded (false if skipped or misconfigured)
 */
export async function sendSrmOperatorNotificationEmailMirror(params: {
  to: string;
  title: string;
  body: string | null;
}): Promise<boolean> {
  if (!isSrmOperatorEmailMirrorEnabled()) return false;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = resendFromAddress();
  if (!apiKey || !from) {
    return false;
  }
  const to = params.to.trim();
  if (!to) return false;
  const text = [params.title, params.body || "", "", "This was sent because SRM in-app notifications are enabled for your account. Open the app to read or mark as read."]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 100_000);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: params.title.slice(0, 998),
      text,
    }),
  });
  return res.ok;
}
