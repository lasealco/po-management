/**
 * MP4: assistant email pilot (copy/paste inbound + staged reply, confirm before send).
 * Enabled by default for the no-provider pilot; set `ASSISTANT_EMAIL_PILOT=0` to hide/disable.
 */
export function isAssistantEmailPilotEnabled(): boolean {
  return process.env.ASSISTANT_EMAIL_PILOT !== "0";
}

export function emailPreviewFromBody(body: string, max = 500): string {
  const t = body.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}
