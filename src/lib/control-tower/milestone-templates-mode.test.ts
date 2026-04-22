import { describe, expect, it } from "vitest";

import {
  BUILT_IN_MILESTONE_PACKS,
  builtInMilestonePackTransportMode,
  filterMilestonePackCatalogByTransportMode,
  milestonePackMatchesTransportMode,
  type MilestonePackCatalogEntry,
} from "./milestone-templates";

describe("builtInMilestonePackTransportMode", () => {
  it("maps known built-in slugs to transport modes", () => {
    expect(builtInMilestonePackTransportMode("OCEAN_PORT_TO_PORT")).toBe("OCEAN");
    expect(builtInMilestonePackTransportMode("AIR_ORIGIN_TO_DEST")).toBe("AIR");
    expect(builtInMilestonePackTransportMode("RAIL_TERMINAL_TO_TERMINAL")).toBe("RAIL");
    expect(builtInMilestonePackTransportMode("ROAD_DOOR_TO_DOOR")).toBe("ROAD");
  });

  it("returns null for unknown slugs", () => {
    expect(builtInMilestonePackTransportMode("TENANT_CUSTOM_PACK")).toBeNull();
  });
});

describe("milestonePackMatchesTransportMode", () => {
  it("requires matching mode for built-in packs", () => {
    expect(milestonePackMatchesTransportMode("OCEAN_PORT_TO_PORT", "OCEAN")).toBe(true);
    expect(milestonePackMatchesTransportMode("OCEAN_PORT_TO_PORT", "AIR")).toBe(false);
    expect(milestonePackMatchesTransportMode("OCEAN_PORT_TO_PORT", undefined)).toBe(false);
    expect(milestonePackMatchesTransportMode("OCEAN_PORT_TO_PORT", null)).toBe(false);
  });

  it("allows any mode for non-built-in slugs", () => {
    expect(milestonePackMatchesTransportMode("CUSTOM_SLUG", "OCEAN")).toBe(true);
    expect(milestonePackMatchesTransportMode("CUSTOM_SLUG", null)).toBe(true);
  });
});

describe("filterMilestonePackCatalogByTransportMode", () => {
  const sample: MilestonePackCatalogEntry[] = [
    { id: "OCEAN_PORT_TO_PORT", title: "Ocean", description: "", milestoneCount: 7 },
    { id: "AIR_ORIGIN_TO_DEST", title: "Air", description: "", milestoneCount: 5 },
    { id: "CUSTOM_SLUG", title: "Custom", description: "", milestoneCount: 3 },
  ];

  it("returns empty when transport mode is missing", () => {
    expect(filterMilestonePackCatalogByTransportMode(sample, null)).toEqual([]);
    expect(filterMilestonePackCatalogByTransportMode(sample, undefined)).toEqual([]);
  });

  it("keeps packs that match the mode or are not built-ins", () => {
    const ocean = filterMilestonePackCatalogByTransportMode(sample, "OCEAN");
    expect(ocean.map((e) => e.id).sort()).toEqual(["CUSTOM_SLUG", "OCEAN_PORT_TO_PORT"]);
  });
});

describe("BUILT_IN_MILESTONE_PACKS", () => {
  it("includes expected ocean milestones with booking confirmed", () => {
    const ocean = BUILT_IN_MILESTONE_PACKS.OCEAN_PORT_TO_PORT;
    expect(ocean).toBeDefined();
    expect(ocean!.milestones.some((m) => m.code === "BOOKING_CONFIRMED")).toBe(true);
  });
});
