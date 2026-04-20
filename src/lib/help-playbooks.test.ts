import { describe, expect, it } from "vitest";

import { HELP_PLAYBOOKS, matchPlaybook } from "@/lib/help-playbooks";
import { LEGAL_COOKIES_PATH, LEGAL_PRIVACY_PATH, LEGAL_PUBLIC_HELP_PATHS, LEGAL_TERMS_PATH } from "@/lib/legal-public-paths";
import { MARKETING_PRICING_PATH, MARKETING_PUBLIC_HELP_PATHS } from "@/lib/marketing-public-paths";
import { TARIFF_HELP_OPEN_PATHS, TARIFFS_MODULE_BASE_PATH } from "@/lib/tariff/tariff-workbench-urls";

describe("HELP_PLAYBOOKS", () => {
  it("tariffs playbook lists contracts, wizards, explorers, admin, and charge codes", () => {
    const p = HELP_PLAYBOOKS.find((x) => x.id === "tariffs");
    expect(p?.steps).toHaveLength(11);
  });

  it("tariffs playbook href and open_path targets stay inside TARIFF_HELP_OPEN_PATHS", () => {
    const allowed = new Set<string>(TARIFF_HELP_OPEN_PATHS);
    const p = HELP_PLAYBOOKS.find((x) => x.id === "tariffs");
    for (const s of p?.steps ?? []) {
      if (s.href) {
        expect(allowed.has(s.href), `href not allowlisted: ${s.href}`).toBe(true);
      }
      const da = s.doAction;
      if (da?.type === "open_path" && typeof da.payload?.path === "string") {
        expect(allowed.has(da.payload.path), `open_path not allowlisted: ${da.payload.path}`).toBe(true);
      }
    }
  });

  it("tariffs playbook touches every help-open tariff path except the module root redirect", () => {
    const used = new Set<string>();
    const p = HELP_PLAYBOOKS.find((x) => x.id === "tariffs");
    for (const s of p?.steps ?? []) {
      if (s.href) used.add(s.href);
      if (s.doAction?.type === "open_path" && typeof s.doAction.payload?.path === "string") {
        used.add(s.doAction.payload.path);
      }
    }
    for (const path of TARIFF_HELP_OPEN_PATHS) {
      if (path === TARIFFS_MODULE_BASE_PATH) continue;
      expect(used.has(path), `add a tariffs playbook step for: ${path}`).toBe(true);
    }
  });
});

describe("public_marketing playbook", () => {
  it("has steps for pricing, platform hub, and legal pages", () => {
    const p = HELP_PLAYBOOKS.find((x) => x.id === "public_marketing");
    expect(p?.steps).toHaveLength(5);
    expect(p?.steps[0]?.href).toBe(MARKETING_PUBLIC_HELP_PATHS[0]);
    expect(p?.steps[1]?.href).toBe(MARKETING_PUBLIC_HELP_PATHS[1]);
    expect(p?.steps[2]?.href).toBe(LEGAL_PRIVACY_PATH);
    expect(p?.steps[3]?.href).toBe(LEGAL_TERMS_PATH);
    expect(p?.steps[4]?.href).toBe(LEGAL_COOKIES_PATH);
  });

  it("only links help-allowlisted marketing and legal paths (must match help-actions OPEN_PATH_ALLOWLIST)", () => {
    const allowed = new Set<string>([...MARKETING_PUBLIC_HELP_PATHS, ...LEGAL_PUBLIC_HELP_PATHS]);
    const p = HELP_PLAYBOOKS.find((x) => x.id === "public_marketing");
    for (const s of p?.steps ?? []) {
      if (s.href) expect(allowed.has(s.href), `unexpected href: ${s.href}`).toBe(true);
      const da = s.doAction;
      if (da?.type === "open_path" && typeof da.payload?.path === "string") {
        expect(allowed.has(da.payload.path), `unexpected open_path: ${da.payload.path}`).toBe(true);
      }
    }
  });
});

describe("matchPlaybook", () => {
  it("returns tariffs playbook for tariff and rating phrases", () => {
    expect(matchPlaybook("open tariffs")?.id).toBe("tariffs");
    expect(matchPlaybook("lane rating explorer")?.id).toBe("tariffs");
    expect(matchPlaybook("freight contract list")?.id).toBe("tariffs");
    expect(matchPlaybook("promote import batch into a new contract version")?.id).toBe("tariffs");
  });

  it("still routes generic purchase order questions to create_order", () => {
    expect(matchPlaybook("how do I create an order")?.id).toBe("create_order");
  });

  it("returns public_marketing for plans/pricing and platform hub phrasing", () => {
    expect(matchPlaybook("where are plans and pricing")?.id).toBe("public_marketing");
    expect(matchPlaybook("open the platform hub")?.id).toBe("public_marketing");
    expect(matchPlaybook(`go to ${MARKETING_PRICING_PATH}`)?.id).toBe("public_marketing");
  });

  it("returns public_marketing for privacy, terms, and cookie phrasing", () => {
    expect(matchPlaybook("where is the privacy policy")?.id).toBe("public_marketing");
    expect(matchPlaybook("show me the terms of service")?.id).toBe("public_marketing");
    expect(matchPlaybook("cookie policy")?.id).toBe("public_marketing");
    expect(matchPlaybook(`open ${LEGAL_TERMS_PATH}`)?.id).toBe("public_marketing");
  });

  it("does not map pricing snapshot questions to public_marketing", () => {
    expect(matchPlaybook("freeze a pricing snapshot")?.id).not.toBe("public_marketing");
  });
});
