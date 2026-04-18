import { describe, expect, it } from "vitest";

import type { ViewerAccess } from "@/lib/authz";
import { executeHelpDoAction } from "@/lib/help-actions";
import {
  REPORTING_HUB_CONTROL_TOWER_HREF,
  REPORTING_HUB_FOCUS_CRM_HREF,
  REPORTING_HUB_FOCUS_PO_HREF,
  REPORTING_HUB_FOCUS_WMS_HREF,
} from "@/lib/reporting-hub-paths";

function mkAccess(grantPairs: [string, string][]): ViewerAccess {
  return {
    tenant: { id: "t1", name: "Demo", slug: "demo" },
    user: { id: "u1", email: "actor@test", name: "Actor" },
    grantSet: new Set(grantPairs.map(([r, a]) => `${r}\0${a}`)),
  };
}

describe("executeHelpDoAction open_path /reporting focus", () => {
  it("keeps focus=po when org.reports view", async () => {
    const access = mkAccess([["org.reports", "view"]]);
    const r = await executeHelpDoAction(access, {
      type: "open_path",
      label: "Open",
      payload: { path: "/reporting", focus: "po" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.href).toBe(`${REPORTING_HUB_FOCUS_PO_HREF}`);
    }
  });

  it("drops focus=po without org.reports (CT-only actor)", async () => {
    const access = mkAccess([["org.controltower", "view"]]);
    const r = await executeHelpDoAction(access, {
      type: "open_path",
      label: "Open",
      payload: { path: "/reporting", focus: "po" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.href).toBe("/reporting");
      expect(r.href).not.toContain("focus=");
    }
  });

  it("keeps focus=control-tower when org.controltower view", async () => {
    const access = mkAccess([["org.controltower", "view"]]);
    const r = await executeHelpDoAction(access, {
      type: "open_path",
      label: "Open",
      payload: { path: "/reporting", focus: "control-tower" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.href).toBe(REPORTING_HUB_CONTROL_TOWER_HREF);
    }
  });

  it("drops focus=control-tower without org.controltower", async () => {
    const access = mkAccess([["org.reports", "view"]]);
    const r = await executeHelpDoAction(access, {
      type: "open_path",
      label: "Open",
      payload: { path: "/reporting", focus: "control-tower" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.href).toBe("/reporting");
    }
  });

  it("keeps focus=crm when org.crm view", async () => {
    const access = mkAccess([
      ["org.crm", "view"],
      ["org.reports", "view"],
    ]);
    const r = await executeHelpDoAction(access, {
      type: "open_path",
      label: "Open",
      payload: { path: "/reporting", focus: "crm" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.href).toBe(REPORTING_HUB_FOCUS_CRM_HREF);
    }
  });

  it("drops focus=crm without org.crm", async () => {
    const access = mkAccess([["org.reports", "view"]]);
    const r = await executeHelpDoAction(access, {
      type: "open_path",
      label: "Open",
      payload: { path: "/reporting", focus: "crm" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.href).toBe("/reporting");
    }
  });

  it("keeps focus=wms when org.wms view", async () => {
    const access = mkAccess([
      ["org.wms", "view"],
      ["org.reports", "view"],
    ]);
    const r = await executeHelpDoAction(access, {
      type: "open_path",
      label: "Open",
      payload: { path: "/reporting", focus: "wms" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.href).toBe(REPORTING_HUB_FOCUS_WMS_HREF);
    }
  });

  it("rejects /reporting when no hub module grant", async () => {
    const access = mkAccess([["org.orders", "view"]]);
    const r = await executeHelpDoAction(access, {
      type: "open_path",
      label: "Open",
      payload: { path: "/reporting", focus: "po" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/reporting hub/i);
    }
  });

  it("omits unknown focus values (not in REPORTING_FOCUS)", async () => {
    const access = mkAccess([["org.reports", "view"]]);
    const r = await executeHelpDoAction(access, {
      type: "open_path",
      label: "Open",
      payload: { path: "/reporting", focus: "nope" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.href).toBe("/reporting");
      expect(r.href).not.toContain("focus=");
    }
  });

  it("normalizes focus casing via trim + toLowerCase (PO → po)", async () => {
    const access = mkAccess([["org.reports", "view"]]);
    const r = await executeHelpDoAction(access, {
      type: "open_path",
      label: "Open",
      payload: { path: "/reporting", focus: "  PO  " },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.href).toBe(REPORTING_HUB_FOCUS_PO_HREF);
    }
  });
});
