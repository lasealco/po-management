import { describe, expect, it } from "vitest";

import { buildHelpAssistantGrantSnapshot } from "@/lib/help-assistant-grants";
import type { ViewerAccess } from "@/lib/authz";
import { helpTelemetryGrantBits, helpTelemetryPathPrefix } from "@/lib/help-telemetry";

const gk = (resource: string, action: string) => `${resource}\0${action}`;

describe("helpTelemetryPathPrefix", () => {
  it("returns first segment", () => {
    expect(helpTelemetryPathPrefix("/control-tower/workbench")).toBe("/control-tower");
    expect(helpTelemetryPathPrefix("/orders")).toBe("/orders");
    expect(helpTelemetryPathPrefix("")).toBe("");
  });
});

describe("helpTelemetryGrantBits", () => {
  it("emits a fixed-length bit string", () => {
    const access: ViewerAccess = {
      tenant: { id: "t", name: "T", slug: "t" },
      user: { id: "u", email: "e", name: "n" },
      grantSet: new Set([gk("org.orders", "view"), gk("org.controltower", "view")]),
    };
    const g = buildHelpAssistantGrantSnapshot(access, { supplierPortalRestricted: false });
    expect(helpTelemetryGrantBits(g)).toMatch(/^[01]{9}$/);
  });
});
