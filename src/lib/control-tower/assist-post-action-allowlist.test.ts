import { describe, expect, it } from "vitest";

import {
  ASSIST_EXECUTABLE_POST_ACTIONS,
  buildAssistExecutablePostBody,
  getAssistExecutablePostActionToolRefs,
} from "./assist-post-action-allowlist";

describe("assist-post-action-allowlist", () => {
  it("rejects non-allowlisted action", () => {
    const r = buildAssistExecutablePostBody("delete_ct_leg", { id: "c123" });
    expect(r.ok).toBe(false);
  });

  it("acknowledge_ct_alert: requires valid cuid", () => {
    const validAlert = `c${"a".repeat(24)}`;
    const bad = buildAssistExecutablePostBody("acknowledge_ct_alert", { alertId: "nope" });
    expect(bad.ok).toBe(false);
    const good = buildAssistExecutablePostBody("acknowledge_ct_alert", { alertId: validAlert });
    if (!good.ok) throw new Error(String(good));
    expect(good.body).toEqual({ action: "acknowledge_ct_alert", alertId: validAlert });
  });

  it("create_ct_note: normalizes visibility and enforces cuid on shipment", () => {
    const sid = `c${"b".repeat(24)}`;
    const g = buildAssistExecutablePostBody("create_ct_note", {
      shipmentId: sid,
      body: " hello ",
      visibility: "SHARED",
    });
    if (!g.ok) throw new Error(String(g));
    expect(g.body).toEqual({
      action: "create_ct_note",
      shipmentId: sid,
      body: "hello",
      visibility: "SHARED",
    });
  });

  it("bulk_acknowledge_ct_alerts: requires non-empty id list (max 100)", () => {
    const sid = "ship1";
    const bad = buildAssistExecutablePostBody("bulk_acknowledge_ct_alerts", { shipmentIds: [sid, sid] });
    expect(bad.ok).toBe(true);
    if (bad.ok) {
      expect(bad.body.shipmentIds).toEqual([sid]);
    }
    const empty = buildAssistExecutablePostBody("bulk_acknowledge_ct_alerts", { shipmentIds: [] });
    expect(empty.ok).toBe(false);
  });

  it("assign_ct_exception_owner: cuid on exception, owner optional cuid or null", () => {
    const ex = `c${"c".repeat(24)}`;
    const u = `c${"d".repeat(24)}`;
    const g = buildAssistExecutablePostBody("assign_ct_exception_owner", { exceptionId: ex, ownerUserId: u });
    if (!g.ok) throw new Error(String(g));
    expect(g.body).toMatchObject({ action: "assign_ct_exception_owner", exceptionId: ex, ownerUserId: u });
    const g2 = buildAssistExecutablePostBody("assign_ct_exception_owner", { exceptionId: ex, ownerUserId: null });
    if (!g2.ok) throw new Error(String(g2));
    expect((g2.body as { ownerUserId: unknown }).ownerUserId).toBeNull();
  });

  it("bulk_assign_ct_exception_owner: requires shipmentIds + ownerUserId", () => {
    const s1 = "s1";
    const s2 = "s2";
    const u = `c${"e".repeat(24)}`;
    const g = buildAssistExecutablePostBody("bulk_assign_ct_exception_owner", {
      shipmentIds: [s1, s2],
      ownerUserId: u,
    });
    if (!g.ok) throw new Error(String(g));
    expect(g.body).toMatchObject({
      action: "bulk_assign_ct_exception_owner",
      shipmentIds: [s1, s2],
      ownerUserId: u,
    });
  });

  it("executable tool refs is a non-empty subset of the full roster", () => {
    expect(ASSIST_EXECUTABLE_POST_ACTIONS.length).toBe(5);
    const refs = getAssistExecutablePostActionToolRefs();
    expect(refs.length).toBe(5);
    expect(refs.map((r) => r.action).sort()).toEqual(
      [...ASSIST_EXECUTABLE_POST_ACTIONS].map(String).sort(),
    );
  });
});
