import { describe, expect, it } from "vitest";

import {
  buildHelpAssistantGrantSnapshot,
  filterHelpDoActionsByGrants,
  helpAssistantOpenPathAllowed,
} from "@/lib/help-assistant-grants";
import type { ViewerAccess } from "@/lib/authz";

const gk = (resource: string, action: string) => `${resource}\0${action}`;

function accessWithGrants(grants: string[]): ViewerAccess {
  return {
    tenant: { id: "t1", name: "T", slug: "t" },
    user: { id: "u1", email: "a@b.c", name: "A" },
    grantSet: new Set(grants),
  };
}

describe("buildHelpAssistantGrantSnapshot", () => {
  it("marks all capabilities false when no user", () => {
    const base = { tenant: { id: "t1", name: "T", slug: "t" }, user: null, grantSet: new Set<string>() };
    const g = buildHelpAssistantGrantSnapshot(base, { supplierPortalRestricted: false });
    expect(g.signedIn).toBe(false);
    expect(g.ordersView).toBe(false);
    expect(g.consolidationNav).toBe(false);
  });

  it("sets consolidationNav false when supplier portal restricted", () => {
    const a = accessWithGrants([gk("org.orders", "view")]);
    const g = buildHelpAssistantGrantSnapshot(a, { supplierPortalRestricted: true });
    expect(g.ordersView).toBe(true);
    expect(g.consolidationNav).toBe(false);
  });

  it("sets reportingHub when any reporting slice grant exists", () => {
    const a = accessWithGrants([gk("org.crm", "view")]);
    const g = buildHelpAssistantGrantSnapshot(a, { supplierPortalRestricted: false });
    expect(g.reportingHub).toBe(true);
    expect(g.reportingFocusCrm).toBe(true);
    expect(g.reportingFocusPo).toBe(false);
  });
});

describe("filterHelpDoActionsByGrants", () => {
  it("drops open_path to orders when viewer lacks orders view", () => {
    const g = buildHelpAssistantGrantSnapshot(
      { tenant: { id: "t1", name: "T", slug: "t" }, user: null, grantSet: new Set() },
      { supplierPortalRestricted: false },
    );
    const out = filterHelpDoActionsByGrants(
      [{ type: "open_path", label: "Orders", payload: { path: "/orders" } }],
      g,
    );
    expect(out).toHaveLength(0);
  });

  it("keeps product trace when orders view", () => {
    const a = accessWithGrants([gk("org.orders", "view")]);
    const g = buildHelpAssistantGrantSnapshot(a, { supplierPortalRestricted: false });
    expect(
      filterHelpDoActionsByGrants(
        [{ type: "open_path", label: "Trace", payload: { path: "/product-trace", q: "X" } }],
        g,
      ),
    ).toHaveLength(1);
  });
});

describe("helpAssistantOpenPathAllowed", () => {
  it("allows platform for everyone", () => {
    const g = buildHelpAssistantGrantSnapshot(
      { tenant: { id: "t1", name: "T", slug: "t" }, user: null, grantSet: new Set() },
      { supplierPortalRestricted: false },
    );
    expect(helpAssistantOpenPathAllowed("/platform", g)).toBe(true);
  });
});
