/** RFC 4122 UUID v4 from `crypto.randomUUID()` (server) — used to correlate chat → actions → feedback logs. */
const HELP_EVENT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidHelpEventId(id: string): boolean {
  return HELP_EVENT_ID_RE.test(id.trim());
}
