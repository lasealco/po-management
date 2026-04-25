/**
 * MP4: optional assistant email pilot (inbound + staged reply, confirm before send).
 * Enable with `ASSISTANT_EMAIL_PILOT=1` and/or `NEXT_PUBLIC_ASSISTANT_EMAIL_PILOT=1` (latter for client nav hints).
 */
export function isAssistantEmailPilotEnabled(): boolean {
  return (
    process.env.ASSISTANT_EMAIL_PILOT === "1" ||
    process.env.NEXT_PUBLIC_ASSISTANT_EMAIL_PILOT === "1"
  );
}

export function emailPreviewFromBody(body: string, max = 500): string {
  const t = body.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}
