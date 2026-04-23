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
  /** When set, a “From: …” line is added (same assigner as in-app and webhook). */
  actorName?: string | null;
  /** When set, a “Supplier: …” line is added (name and optional code). */
  supplierName?: string | null;
  supplierCode?: string | null;
}): Promise<boolean> {
  if (!isSrmOperatorEmailMirrorEnabled()) return false;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = resendFromAddress();
  if (!apiKey || !from) {
    return false;
  }
  const to = params.to.trim();
  if (!to) return false;
  const fromLine = params.actorName?.trim();
  const textParts: string[] = [params.title];
  if (fromLine) textParts.push(`From: ${fromLine}`);
  const supN = params.supplierName?.trim() ?? "";
  const supC = params.supplierCode?.trim() ?? "";
  if (supN && supC) {
    textParts.push(`Supplier: ${supN} (${supC})`);
  } else if (supN) {
    textParts.push(`Supplier: ${supN}`);
  } else if (supC) {
    textParts.push(`Supplier: ${supC}`);
  }
  if (params.body?.trim()) textParts.push(params.body.trim());
  textParts.push(
    "This was sent because SRM in-app notifications are enabled for your account. Open the app to read or mark as read.",
  );
  const text = textParts.join("\n\n").slice(0, 100_000);
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
