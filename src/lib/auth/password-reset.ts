import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Wall-clock validity for reset links (1 hour). */
export const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000;

export function newPasswordResetSecret(): { raw: string; tokenHash: string } {
  const raw = randomBytes(32).toString("hex");
  return { raw, tokenHash: hashPasswordResetToken(raw) };
}

export function hashPasswordResetToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function safeEqualTokenHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export function getPasswordResetEmailFrom(): string {
  return (
    process.env.PASSWORD_RESET_EMAIL_FROM?.trim() ||
    process.env.CONTROL_TOWER_REPORTS_EMAIL_FROM?.trim() ||
    ""
  );
}

export async function sendPasswordResetResendEmail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = getPasswordResetEmailFrom();
  if (!apiKey || !from) {
    return { ok: false, reason: "missing_RESEND_API_KEY_or_from_address" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject.slice(0, 998),
      text: params.text.slice(0, 100_000),
    }),
  });
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 500);
    return { ok: false, reason: `resend_http_${res.status}:${errText}` };
  }
  return { ok: true };
}

/**
 * Public origin for links in emails. Prefer the incoming request (correct Host in prod).
 */
export function appOriginFromRequest(request: Request): string {
  const u = new URL(request.url);
  return `${u.protocol}//${u.host}`;
}
