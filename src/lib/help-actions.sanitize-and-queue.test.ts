import { describe, expect, it } from "vitest";

import type { ViewerAccess } from "@/lib/authz";
import type { HelpDoAction } from "@/lib/help-actions";
import { executeHelpDoAction, sanitizeHelpDoActions } from "@/lib/help-actions";

function mkAccess(grantPairs: [string, string][]): ViewerAccess {
  return {
    tenant: { id: "t1", name: "Demo", slug: "demo" },
    user: { id: "u1", email: "actor@test", name: "Actor" },
    grantSet: new Set(grantPairs.map(([r, a]) => `${r}\0${a}`)),
  };
}

describe("sanitizeHelpDoActions", () => {
  it("returns empty array for non-arrays", () => {
    expect(sanitizeHelpDoActions(null)).toEqual([]);
    expect(sanitizeHelpDoActions(undefined)).toEqual([]);
    expect(sanitizeHelpDoActions({})).toEqual([]);
    expect(sanitizeHelpDoActions("x")).toEqual([]);
  });

  it("keeps at most four valid actions", () => {
    const raw = Array.from({ length: 6 }, (_, i) => ({
      type: "open_path",
      label: `L${i}`,
      payload: { path: "/reporting" },
    }));
    const out = sanitizeHelpDoActions(raw);
    expect(out).toHaveLength(4);
    expect(out.map((a) => a.label)).toEqual(["L0", "L1", "L2", "L3"]);
  });

  it("skips rows without label or with invalid type", () => {
    const out = sanitizeHelpDoActions([
      { type: "open_path", label: "" },
      { type: "open_path", label: "ok", payload: { path: "/reporting" } },
      { type: "bad", label: "x" },
      { label: "no type" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.label).toBe("ok");
  });

  it("normalizes payload to undefined when not a plain object", () => {
    const out = sanitizeHelpDoActions([
      { type: "open_path", label: "a", payload: [1, 2] },
      { type: "open_orders_queue", label: "b", payload: { queue: "all" } },
    ]);
    expect(out[0]?.payload).toBeUndefined();
    expect(out[1]?.payload).toEqual({ queue: "all" });
  });

  it("accepts open_order rows with orderNumber payload", () => {
    const out = sanitizeHelpDoActions([
      { type: "open_order", label: "Open PO", payload: { orderNumber: "PO-1" } },
      { type: "open_path", label: "Hub", payload: { path: "/reporting" } },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      type: "open_order",
      label: "Open PO",
      payload: { orderNumber: "PO-1" },
    });
    expect(out[1]?.type).toBe("open_path");
  });
});

describe("executeHelpDoAction edge cases", () => {
  it("returns Unknown action for unrecognized type", async () => {
    const access = mkAccess([["org.orders", "view"]]);
    const r = await executeHelpDoAction(access, {
      type: "not_a_real_action",
      label: "x",
    } as unknown as HelpDoAction);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/Unknown action/i);
    }
  });

  it("requires a signed-in user before any action", async () => {
    const access: ViewerAccess = {
      tenant: { id: "t1", name: "Demo", slug: "demo" },
      user: null,
      grantSet: new Set([`org.orders\0view`]),
    };
    const r = await executeHelpDoAction(access, {
      type: "open_path",
      label: "x",
      payload: { path: "/orders" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/Sign in/i);
    }
  });
});

describe("executeHelpDoAction open_orders_queue", () => {
  it("requires org.orders view", async () => {
    const access = mkAccess([["org.reports", "view"]]);
    const r = await executeHelpDoAction(access, {
      type: "open_orders_queue",
      label: "Queue",
      payload: { queue: "all" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/orders/i);
    }
  });

  it("rejects unknown queue filters", async () => {
    const access = mkAccess([["org.orders", "view"]]);
    const r = await executeHelpDoAction(access, {
      type: "open_orders_queue",
      label: "Queue",
      payload: { queue: "not_a_real_queue" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/Invalid queue filter/i);
    }
  });

  it("maps queue=all to /orders without queue param", async () => {
    const access = mkAccess([["org.orders", "view"]]);
    const r = await executeHelpDoAction(access, {
      type: "open_orders_queue",
      label: "All",
      payload: { queue: "all" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.href).toBe("/orders");
      expect(r.message).toMatch(/full orders board/i);
    }
  });

  it("adds queue filter for non-all queues", async () => {
    const access = mkAccess([["org.orders", "view"]]);
    const r = await executeHelpDoAction(access, {
      type: "open_orders_queue",
      label: "Overdue",
      payload: { queue: "overdue" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.href).toBe("/orders?queue=overdue");
    }
  });

  it("includes guide and step when playbook id is valid", async () => {
    const access = mkAccess([["org.orders", "view"]]);
    const r = await executeHelpDoAction(access, {
      type: "open_orders_queue",
      label: "NMA",
      payload: { queue: "needs_my_action", guide: "reporting_hub", step: 1 },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.href).toContain("queue=needs_my_action");
      expect(r.href).toContain("guide=reporting_hub");
      expect(r.href).toContain("step=1");
    }
  });
});
