/**
 * Strict allowlist for `POST /api/control-tower/assist/execute-post-action`.
 * Each entry maps to a validated payload merged into the body passed to `handleControlTowerPost`.
 */

import {
  getControlTowerPostActionToolCatalog,
  type ControlTowerPostActionToolRef,
} from "./assist-tool-catalog";

const CUID = /^c[a-z0-9]{24,32}$/i;

export const ASSIST_EXECUTABLE_POST_ACTIONS = [
  "acknowledge_ct_alert",
  "create_ct_note",
] as const;

export type AssistExecutablePostAction = (typeof ASSIST_EXECUTABLE_POST_ACTIONS)[number];

function isExecutableAction(a: string): a is AssistExecutablePostAction {
  return (ASSIST_EXECUTABLE_POST_ACTIONS as readonly string[]).includes(a);
}

function bad(err: string): { ok: false; error: string } {
  return { ok: false, error: err };
}

/**
 * Returns merged `{ action, ...fields }` for the Control Tower post router, or an error.
 */
export function buildAssistExecutablePostBody(
  action: string,
  payload: unknown,
): { ok: true; body: Record<string, unknown> } | { ok: false; error: string } {
  if (!isExecutableAction(action)) {
    return bad("Action is not allowlisted for assist execution");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return bad("payload must be an object");
  }
  const p = payload as Record<string, unknown>;

  if (action === "acknowledge_ct_alert") {
    const alertId = typeof p.alertId === "string" ? p.alertId.trim() : "";
    if (!alertId || !CUID.test(alertId)) return bad("alertId must be a valid cuid");
    return { ok: true, body: { action, alertId } };
  }

  if (action === "create_ct_note") {
    const shipmentId = typeof p.shipmentId === "string" ? p.shipmentId.trim() : "";
    const text = typeof p.body === "string" ? p.body.trim() : "";
    if (!shipmentId || !CUID.test(shipmentId)) return bad("shipmentId must be a valid cuid");
    if (!text) return bad("body (note text) is required");
    if (text.length > 20_000) return bad("body exceeds maximum length");
    const visibility = p.visibility === "SHARED" ? "SHARED" : "INTERNAL";
    return { ok: true, body: { action, shipmentId, body: text, visibility } };
  }

  return bad("Unsupported action");
}

/** Human-readable labels for the assist response (subset of the full read-only catalog). */
export function getAssistExecutablePostActionToolRefs(): ControlTowerPostActionToolRef[] {
  const allow = new Set<string>(ASSIST_EXECUTABLE_POST_ACTIONS);
  return getControlTowerPostActionToolCatalog().filter((t) => allow.has(t.action));
}
