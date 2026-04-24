/**
 * Strict allowlist for `POST /api/control-tower/assist/execute-post-action`.
 * Each entry maps to a validated payload merged into the body passed to `handleControlTowerPost`.
 */

import {
  getControlTowerPostActionToolCatalog,
  type ControlTowerPostActionToolRef,
} from "./assist-tool-catalog";
import { parseBulkShipmentIds } from "./post-actions";

const CUID = /^c[a-z0-9]{24,32}$/i;

export const ASSIST_EXECUTABLE_POST_ACTIONS = [
  "acknowledge_ct_alert",
  "bulk_acknowledge_ct_alerts",
  "create_ct_note",
  "assign_ct_exception_owner",
  "bulk_assign_ct_exception_owner",
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

  if (action === "bulk_acknowledge_ct_alerts") {
    const shipmentIds = parseBulkShipmentIds(p.shipmentIds);
    if (shipmentIds === "invalid") {
      return bad("shipmentIds must be a non-empty array of at most 100 shipment id strings");
    }
    return { ok: true, body: { action, shipmentIds } };
  }

  if (action === "assign_ct_exception_owner") {
    const exceptionId = typeof p.exceptionId === "string" ? p.exceptionId.trim() : "";
    if (!exceptionId || !CUID.test(exceptionId)) return bad("exceptionId must be a valid cuid");
    const ownRaw = p.ownerUserId;
    let ownerUserId: string | null;
    if (ownRaw === null || ownRaw === "" || (typeof ownRaw === "string" && !ownRaw.trim())) {
      ownerUserId = null;
    } else if (typeof ownRaw === "string") {
      const t = ownRaw.trim();
      if (!CUID.test(t)) return bad("ownerUserId must be a valid cuid or null/empty to clear");
      ownerUserId = t;
    } else {
      return bad("ownerUserId must be a string cuid or null");
    }
    return { ok: true, body: { action, exceptionId, ownerUserId } };
  }

  if (action === "bulk_assign_ct_exception_owner") {
    const shipmentIds = parseBulkShipmentIds(p.shipmentIds);
    if (shipmentIds === "invalid") {
      return bad("shipmentIds must be a non-empty array of at most 100 shipment id strings");
    }
    const ownRaw = p.ownerUserId;
    let ownerUserId: string | null;
    if (ownRaw === null || ownRaw === "" || (typeof ownRaw === "string" && !ownRaw.trim())) {
      ownerUserId = null;
    } else if (typeof ownRaw === "string") {
      const t = ownRaw.trim();
      if (!CUID.test(t)) return bad("ownerUserId must be a valid cuid or null/empty to clear");
      ownerUserId = t;
    } else {
      return bad("ownerUserId must be a string cuid or null");
    }
    return { ok: true, body: { action, shipmentIds, ownerUserId } };
  }

  return bad("Unsupported action");
}

/** Human-readable labels for the assist response (subset of the full read-only catalog). */
export function getAssistExecutablePostActionToolRefs(): ControlTowerPostActionToolRef[] {
  const allow = new Set<string>(ASSIST_EXECUTABLE_POST_ACTIONS);
  return getControlTowerPostActionToolCatalog().filter((t) => allow.has(t.action));
}
