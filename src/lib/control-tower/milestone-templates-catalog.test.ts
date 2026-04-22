import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyPacks = vi.hoisted(() => vi.fn());
const findUniquePack = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ctMilestoneTemplatePack: {
      findMany: findManyPacks,
      findUnique: findUniquePack,
    },
  },
}));

import {
  BUILT_IN_MILESTONE_PACKS,
  getMilestonePackForApply,
  listMilestonePackCatalogForTenant,
} from "./milestone-templates";

const oneStep = [
  { code: "STEP1", label: "First", anchor: "SHIPMENT_CREATED", offsetDays: 0 },
] as const;

describe("listMilestonePackCatalogForTenant", () => {
  beforeEach(() => {
    findManyPacks.mockReset();
  });

  it("merges built-in packs when DB has no rows", async () => {
    findManyPacks.mockResolvedValue([]);
    const catalog = await listMilestonePackCatalogForTenant("tenant-a");
    const builtSlugs = Object.keys(BUILT_IN_MILESTONE_PACKS);
    expect(catalog).toHaveLength(builtSlugs.length);
    expect(catalog[0]?.id).toBe(builtSlugs[0]);
    expect(catalog[0]?.milestoneCount).toBe(BUILT_IN_MILESTONE_PACKS[builtSlugs[0]!]!.milestones.length);
  });

  it("appends tenant-only slugs after built-ins", async () => {
    findManyPacks.mockResolvedValue([
      {
        slug: "TENANT_ONLY",
        title: "Extra pack",
        description: "Custom",
        milestones: [...oneStep],
      },
    ]);
    const catalog = await listMilestonePackCatalogForTenant("tenant-b");
    expect(catalog.some((e) => e.id === "TENANT_ONLY")).toBe(true);
    expect(catalog.find((e) => e.id === "TENANT_ONLY")).toMatchObject({
      title: "Extra pack",
      milestoneCount: 1,
    });
  });

  it("uses DB row when it overrides a built-in slug", async () => {
    findManyPacks.mockResolvedValue([
      {
        slug: "OCEAN_PORT_TO_PORT",
        title: "Tenant ocean override",
        description: "x",
        milestones: [...oneStep],
      },
    ]);
    const catalog = await listMilestonePackCatalogForTenant("tenant-c");
    const ocean = catalog.find((e) => e.id === "OCEAN_PORT_TO_PORT");
    expect(ocean?.title).toBe("Tenant ocean override");
    expect(ocean?.milestoneCount).toBe(1);
  });
});

describe("getMilestonePackForApply", () => {
  beforeEach(() => {
    findUniquePack.mockReset();
  });

  it("throws when pack slug is empty", async () => {
    await expect(getMilestonePackForApply("t1", "   ")).rejects.toThrow("packId required");
    expect(findUniquePack).not.toHaveBeenCalled();
  });

  it("returns built-in pack when DB has no row", async () => {
    findUniquePack.mockResolvedValue(null);
    const r = await getMilestonePackForApply("t1", "OCEAN_PORT_TO_PORT");
    expect(r.title).toBe(BUILT_IN_MILESTONE_PACKS.OCEAN_PORT_TO_PORT.title);
    expect(r.milestones.some((m) => m.code === "BOOKING_CONFIRMED")).toBe(true);
  });

  it("prefers DB pack when present", async () => {
    findUniquePack.mockResolvedValue({
      title: "From database",
      milestones: [...oneStep],
    });
    const r = await getMilestonePackForApply("t1", "OCEAN_PORT_TO_PORT");
    expect(r.title).toBe("From database");
    expect(r.milestones).toHaveLength(1);
    expect(r.milestones[0]?.code).toBe("STEP1");
  });

  it("throws for unknown slug with no DB row", async () => {
    findUniquePack.mockResolvedValue(null);
    await expect(getMilestonePackForApply("t1", "NOT_A_PACK")).rejects.toThrow("Unknown milestone pack");
  });
});
