/**
 * API Hub server-side logging without forwarding full Error stacks or request objects to stdout
 * (P4 leakage hardening; stacks can expose paths; request objects can expose headers).
 */

const MESSAGE_MAX = 500;

/** Log a background failure for operators; avoids dumping arbitrary thrown values verbatim. */
export function logApiHubBackgroundError(context: string, err: unknown): void {
  if (err instanceof Error) {
    console.error(`[apihub] ${context}`, {
      name: err.name,
      message: err.message.length > MESSAGE_MAX ? `${err.message.slice(0, MESSAGE_MAX)}…` : err.message,
    });
    return;
  }
  const s = String(err);
  console.error(
    `[apihub] ${context}`,
    s.length > MESSAGE_MAX ? `${s.slice(0, MESSAGE_MAX)}…` : s,
  );
}
