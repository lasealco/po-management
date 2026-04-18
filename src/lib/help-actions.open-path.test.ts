import { describe, expect, it } from "vitest";

import type { ViewerAccess } from "@/lib/authz";
import { executeHelpDoAction } from "@/lib/help-actions";

function mkAccess(grantPairs: [string, string][]): ViewerAccess {
  return {
    tenant: { id: "t1", name: "Demo", slug: "demo" },
    user: { id: "u1", email: "actor@test", name: "Actor" },
    grantSet: new Set(grantPairs.map(([r, a]) => `${r}\0${a}`)),
  };
}

describe("executeHelpDoAction open_path allowlist & product-trace q", () => {
  it("rejects paths not on the allowlist", async () => {
    const access = mkAccess([
      ["org.reports", "view"],
      ["org.orders", "view"],
    ]);
    const r = await executeHelpDoAction(access, {
      type: "open_path",
      label: "Open",
      payload: { path: "/admin" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/not allowed/i);
    }
  });

  it("strips query from payload.path when resolving the allowlist (path only)", async () => {
    const access = mkAccess([["org.reports", "view"]]);
    const r = await executeHelpDoAction(access, {
      type: "open_path",
      label: "Open",
      payload: { path: "/reporting?ignored=1", focus: "po" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.href).toMatch(/^\/reporting\?/);
      expect(r.href).toContain("focus=po");
    }
  });

  it("adds sanitized q to /product-trace when org.orders view", async () => {
    const access = mkAccess([
      ["org.orders", "view"],
      ["org.reports", "view"],
    ]);
    const r = await executeHelpDoAction(access, {
      type: "open_path",
      label: "Trace",
      payload: { path: "/product-trace", q: "SKU-1001&evil=1" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.href).toBe("/product-trace?q=SKU-1001");
    }
  });

  it("denies /product-trace without org.orders view", async () => {
    const access = mkAccess([["org.reports", "view"]]);
    const r = await executeHelpDoAction(access, {
      type: "open_path",
      label: "Trace",
      payload: { path: "/product-trace", q: "SKU-1" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/product trace/i);
    }
  });
});
