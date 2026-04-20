import { describe, expect, it } from "vitest";

import type { ViewerAccess } from "@/lib/authz";
import { executeHelpDoAction } from "@/lib/help-actions";
import { LEGAL_PRIVACY_PATH } from "@/lib/legal-public-paths";
import { MARKETING_PRICING_PATH, PLATFORM_HUB_PATH } from "@/lib/marketing-public-paths";
import {
  TARIFF_GEOGRAPHY_NEW_PATH,
  TARIFF_IMPORT_NEW_PATH,
  TARIFF_NEW_CONTRACT_PATH,
  TARIFF_RATING_PATH,
} from "@/lib/tariff/tariff-workbench-urls";

function mkAccess(grantPairs: [string, string][]): ViewerAccess {
  return {
    tenant: { id: "t1", name: "Demo", slug: "demo" },
    user: { id: "u1", email: "actor@test", name: "Actor" },
    grantSet: new Set(grantPairs.map(([r, a]) => `${r}\0${a}`)),
  };
}

describe("executeHelpDoAction open_path allowlist & product-trace q", () => {
  it("allows marketing /pricing without module-specific grants", async () => {
    const access = mkAccess([]);
    const r = await executeHelpDoAction(access, {
      type: "open_path",
      label: "Plans",
      payload: { path: MARKETING_PRICING_PATH },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.href).toBe(MARKETING_PRICING_PATH);
    }
  });

  it("allows /platform without module-specific grants", async () => {
    const access = mkAccess([]);
    const r = await executeHelpDoAction(access, {
      type: "open_path",
      label: "Platform",
      payload: { path: PLATFORM_HUB_PATH },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.href).toBe(PLATFORM_HUB_PATH);
    }
  });

  it("allows legal privacy path without module-specific grants", async () => {
    const access = mkAccess([]);
    const r = await executeHelpDoAction(access, {
      type: "open_path",
      label: "Privacy",
      payload: { path: LEGAL_PRIVACY_PATH, guide: "public_marketing", step: 2 },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.href).toBe(`${LEGAL_PRIVACY_PATH}?guide=public_marketing&step=2`);
    }
  });

  it("composes public_marketing guide query on /platform", async () => {
    const access = mkAccess([]);
    const r = await executeHelpDoAction(access, {
      type: "open_path",
      label: "Platform",
      payload: { path: PLATFORM_HUB_PATH, guide: "public_marketing", step: 1 },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.href).toBe(`${PLATFORM_HUB_PATH}?guide=public_marketing&step=1`);
    }
  });

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

  it("allows tariff lane rating when org.tariffs view", async () => {
    const access = mkAccess([["org.tariffs", "view"]]);
    const r = await executeHelpDoAction(access, {
      type: "open_path",
      label: "Rating",
      payload: { path: TARIFF_RATING_PATH },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.href).toBe(TARIFF_RATING_PATH);
    }
  });

  it("allows new contract wizard path when org.tariffs view", async () => {
    const access = mkAccess([["org.tariffs", "view"]]);
    const r = await executeHelpDoAction(access, {
      type: "open_path",
      label: "New contract",
      payload: { path: TARIFF_NEW_CONTRACT_PATH, guide: "tariffs", step: 1 },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.href).toBe(`${TARIFF_NEW_CONTRACT_PATH}?guide=tariffs&step=1`);
    }
  });

  it("allows new import upload and new geography paths when org.tariffs view", async () => {
    const access = mkAccess([["org.tariffs", "view"]]);
    const importRes = await executeHelpDoAction(access, {
      type: "open_path",
      label: "New import",
      payload: { path: TARIFF_IMPORT_NEW_PATH, guide: "tariffs", step: 7 },
    });
    expect(importRes.ok).toBe(true);
    if (importRes.ok) {
      expect(importRes.href).toBe(`${TARIFF_IMPORT_NEW_PATH}?guide=tariffs&step=7`);
    }
    const geoRes = await executeHelpDoAction(access, {
      type: "open_path",
      label: "New geography",
      payload: { path: TARIFF_GEOGRAPHY_NEW_PATH, guide: "tariffs", step: 9 },
    });
    expect(geoRes.ok).toBe(true);
    if (geoRes.ok) {
      expect(geoRes.href).toBe(`${TARIFF_GEOGRAPHY_NEW_PATH}?guide=tariffs&step=9`);
    }
  });

  it("denies tariff lane rating without org.tariffs view", async () => {
    const access = mkAccess([["org.orders", "view"]]);
    const r = await executeHelpDoAction(access, {
      type: "open_path",
      label: "Rating",
      payload: { path: TARIFF_RATING_PATH },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/tariffs/i);
    }
  });
});
