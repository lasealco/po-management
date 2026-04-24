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

  it("executable tool refs is a non-empty subset of the full roster", () => {
    expect(ASSIST_EXECUTABLE_POST_ACTIONS.length).toBe(2);
    const refs = getAssistExecutablePostActionToolRefs();
    expect(refs.length).toBe(2);
    expect(refs.map((r) => r.action).sort()).toEqual(
      [...ASSIST_EXECUTABLE_POST_ACTIONS].map(String).sort(),
    );
  });
});
