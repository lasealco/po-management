import { describe, expect, it } from "vitest";

import {
  buildWorkbenchSearchString,
  controlTowerWorkbenchPath,
  controlTowerWorkbenchPathFromEtaLaneLabel,
  readWorkbenchUrlState,
} from "./workbench-url-sync";

function sp(entries: Record<string, string>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(entries)) p.set(k, v);
  return p;
}

describe("readWorkbenchUrlState", () => {
  it("accepts only allowlisted status, mode, routeAction, and sortBy", () => {
    const r = readWorkbenchUrlState(
      sp({
        status: "IN_TRANSIT",
        mode: "OCEAN",
        routeAction: "Send booking",
        sortBy: "eta_asc",
      }),
      false,
    );
    expect(r.status).toBe("IN_TRANSIT");
    expect(r.mode).toBe("OCEAN");
    expect(r.routeAction).toBe("Send booking");
    expect(r.sortBy).toBe("eta_asc");
  });

  it("drops unknown status/mode/routeAction and defaults sort", () => {
    const r = readWorkbenchUrlState(
      sp({ status: "FAKE", mode: "SUBMARINE", routeAction: "Nope", sortBy: "bad" }),
      false,
    );
    expect(r.status).toBe("");
    expect(r.mode).toBe("");
    expect(r.routeAction).toBe("");
    expect(r.sortBy).toBe("updated_desc");
  });

  it("clamps page and parses onlyOverdueEta, routeHealth, shipmentSource, autoRefresh, ship360Tab", () => {
    const r = readWorkbenchUrlState(
      sp({
        page: "99999",
        onlyOverdueEta: "true",
        minRouteProgressPct: "0",
        maxRouteProgressPct: "40",
        shipmentSource: "UNLINKED",
        autoRefresh: "0",
        ship360Tab: "milestones",
      }),
      false,
    );
    expect(r.page).toBe(10_000);
    expect(r.onlyOverdueEta).toBe(true);
    expect(r.routeHealth).toBe("stalled");
    expect(r.shipmentSource).toBe("UNLINKED");
    expect(r.autoRefresh).toBe(false);
    expect(r.ship360Tab).toBe("milestones");
  });

  it("clears owner filter in restricted view", () => {
    const open = readWorkbenchUrlState(sp({ dispatchOwnerUserId: "c0000000000000000000" }), false);
    expect(open.ownerFilter).toBe("c0000000000000000000");
    const restricted = readWorkbenchUrlState(sp({ dispatchOwnerUserId: "c0000000000000000000" }), true);
    expect(restricted.ownerFilter).toBe("");
  });
});

describe("buildWorkbenchSearchString", () => {
  it("round-trips core filters and omits owner when restricted", () => {
    const state = readWorkbenchUrlState(
      sp({
        q: "  x  ",
        status: "BOOKED",
        lane: "ABCDE",
        onlyOverdueEta: "1",
        page: "2",
        dispatchOwnerUserId: "owner1",
      }),
      false,
    );
    const qs = buildWorkbenchSearchString(state, false);
    expect(qs).toContain("q=x");
    expect(qs).toContain("status=BOOKED");
    expect(qs).toContain("lane=ABCDE");
    expect(qs).toContain("onlyOverdueEta=1");
    expect(qs).toContain("page=2");
    expect(qs).toContain("dispatchOwnerUserId=owner1");
    const qsRestricted = buildWorkbenchSearchString(state, true);
    expect(qsRestricted).not.toContain("dispatchOwnerUserId");
  });

  it("encodes route health and ship360 tab", () => {
    const state = readWorkbenchUrlState(sp({}), false);
    state.routeHealth = "advanced";
    state.ship360Tab = "milestones";
    state.autoRefresh = false;
    const qs = buildWorkbenchSearchString(state, false);
    expect(qs).toContain("minRouteProgressPct=80");
    expect(qs).toContain("maxRouteProgressPct=100");
    expect(qs).toContain("ship360Tab=milestones");
    expect(qs).toContain("autoRefresh=0");
  });
});

describe("controlTowerWorkbenchPath", () => {
  it("builds path with query or bare workbench URL", () => {
    expect(controlTowerWorkbenchPath({ status: "IN_TRANSIT", empty: "  " })).toBe(
      "/control-tower/workbench?status=IN_TRANSIT",
    );
    expect(controlTowerWorkbenchPath({})).toBe("/control-tower/workbench");
  });
});

describe("controlTowerWorkbenchPathFromEtaLaneLabel", () => {
  it("maps ORIG->DEST lane labels to origin/destination codes", () => {
    expect(controlTowerWorkbenchPathFromEtaLaneLabel("DEHAM -> NLRTM")).toBe(
      "/control-tower/workbench?originCode=DEHAM&destinationCode=NLRTM",
    );
  });

  it("returns bare workbench path when label is not two tokens", () => {
    expect(controlTowerWorkbenchPathFromEtaLaneLabel("only-one")).toBe("/control-tower/workbench");
  });
});
