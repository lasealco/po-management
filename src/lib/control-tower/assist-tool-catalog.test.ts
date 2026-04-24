import { describe, expect, it } from "vitest";

import {
  CONTROL_TOWER_POST_ACTION_HANDLER_COUNT,
  getControlTowerPostActionToolCatalog,
} from "./assist-tool-catalog";

describe("assist-tool-catalog", () => {
  it("exposes a non-overlapping representative roster and matches handler count comment", () => {
    const cat = getControlTowerPostActionToolCatalog();
    expect(cat.length).toBeGreaterThan(5);
    const actions = new Set(cat.map((c) => c.action));
    expect(actions.size).toBe(cat.length);
    expect(CONTROL_TOWER_POST_ACTION_HANDLER_COUNT).toBe(45);
  });
});
