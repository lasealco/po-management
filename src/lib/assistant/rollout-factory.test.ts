import { describe, expect, it } from "vitest";

import {
  buildDemoDataPlan,
  buildModuleFlagPlan,
  buildReadinessChecks,
  buildRoleGrantPlan,
  buildRolloutFactoryPacket,
  buildTemplateInventory,
  type RolloutFactoryInputs,
} from "./rollout-factory";

const inputs: RolloutFactoryInputs = {
  sourceTenant: { id: "tenant-1", name: "Demo Company", slug: "demo-company" },
  targetTenant: { name: "Acme Pilot", slug: "acme-pilot" },
  assets: [
    {
      id: "prompt-1",
      assetType: "PROMPT",
      key: "prompt-1",
      label: "Order orchestration prompt",
      status: "APPROVED",
      domain: "orders",
      copyable: true,
      requiresSecret: false,
    },
    {
      id: "connector-1",
      assetType: "CONNECTOR",
      key: "connector-1",
      label: "ERP connector",
      status: "active",
      domain: "erp",
      copyable: true,
      requiresSecret: true,
    },
  ],
  roleGrants: [
    { roleName: "Admin", resource: "org.settings", action: "view" },
    { roleName: "Admin", resource: "org.settings", action: "edit" },
    { roleName: "Ops", resource: "org.orders", action: "view" },
  ],
  requiredGrants: [
    { resource: "org.settings", action: "view", label: "View settings" },
    { resource: "org.settings", action: "edit", label: "Edit settings" },
    { resource: "org.orders", action: "view", label: "View orders" },
    { resource: "org.wms", action: "view", label: "View WMS" },
  ],
  modules: [
    { moduleKey: "assistant", enabled: true, source: "assistant workspace" },
    { moduleKey: "settings", enabled: true, source: "org.settings:view" },
    { moduleKey: "orders", enabled: true, source: "org.orders:view" },
    { moduleKey: "wms", enabled: false, source: "org.wms:view" },
  ],
  seedPacks: [
    { script: "db:seed", label: "Main seed", required: true, present: true },
    { script: "db:seed:wms-demo", label: "WMS seed", required: true, present: false },
  ],
};

describe("assistant rollout factory helpers", () => {
  it("builds template copy plans with connector secret guardrails", () => {
    const inventory = buildTemplateInventory(inputs.assets);

    expect(inventory.assetCount).toBe(2);
    expect(inventory.copyableCount).toBe(1);
    expect(inventory.metadataOnlyCount).toBe(1);
    expect(inventory.copyPlan).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ assetType: "CONNECTOR", copyMode: "METADATA_ONLY" }),
      ]),
    );
  });

  it("detects grant, module, and seed readiness gaps", () => {
    const grantPlan = buildRoleGrantPlan(inputs);
    const modulePlan = buildModuleFlagPlan(inputs.modules);
    const seedPlan = buildDemoDataPlan(inputs.seedPacks);

    expect(grantPlan.gaps[0]).toMatchObject({ resource: "org.wms", action: "view" });
    expect(modulePlan.gaps[0]).toMatchObject({ moduleKey: "wms" });
    expect(seedPlan.gaps[0]).toMatchObject({ script: "db:seed:wms-demo" });
  });

  it("scores readiness from templates, grants, modules, seeds, and secret safety", () => {
    const inventory = buildTemplateInventory(inputs.assets);
    const grants = buildRoleGrantPlan(inputs);
    const modules = buildModuleFlagPlan(inputs.modules);
    const seeds = buildDemoDataPlan(inputs.seedPacks);
    const readiness = buildReadinessChecks(inventory, grants, modules, seeds);

    expect(readiness.score).toBe(40);
    expect(readiness.status).toBe("BLOCKED");
    expect(readiness.checks.find((check) => check.key === "secret_safety")?.passed).toBe(true);
  });

  it("builds a review-gated rollout packet without copying tenant data", () => {
    const packet = buildRolloutFactoryPacket(inputs);

    expect(packet.readinessScore).toBe(40);
    expect(packet.templateAssetCount).toBe(2);
    expect(packet.roleGrantGapCount).toBe(1);
    expect(packet.moduleGapCount).toBe(1);
    expect(packet.seedGapCount).toBe(1);
    expect(packet.rollbackPlan.steps).toContain("Pause copied automation policies in SHADOW mode before any controlled enablement.");
    expect(packet.leadershipSummary).toContain("does not create tenants");
  });
});
