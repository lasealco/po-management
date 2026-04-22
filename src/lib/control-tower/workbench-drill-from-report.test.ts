import { describe, expect, it } from "vitest";

import {
  buildControlTowerWorkbenchDrillQuery,
  controlTowerWorkbenchDrillHref,
} from "./workbench-drill-from-report";

describe("buildControlTowerWorkbenchDrillQuery", () => {
  it("returns null for none and month dimensions", () => {
    expect(
      buildControlTowerWorkbenchDrillQuery({ dimension: "none", rowKey: "x", rowLabel: "y" }),
    ).toBeNull();
    expect(
      buildControlTowerWorkbenchDrillQuery({ dimension: "month", rowKey: "2026-01", rowLabel: "Jan" }),
    ).toBeNull();
  });

  it("maps status using key or label when recognized", () => {
    expect(
      buildControlTowerWorkbenchDrillQuery({
        dimension: "status",
        rowKey: "IN_TRANSIT",
        rowLabel: "x",
      }),
    ).toBe("status=IN_TRANSIT");
    expect(
      buildControlTowerWorkbenchDrillQuery({
        dimension: "status",
        rowKey: "x",
        rowLabel: "BOOKED",
      }),
    ).toBe("status=BOOKED");
    expect(
      buildControlTowerWorkbenchDrillQuery({
        dimension: "status",
        rowKey: "UNKNOWN",
        rowLabel: "also",
      }),
    ).toBeNull();
  });

  it("maps mode and lane (arrow split or single lane param)", () => {
    expect(
      buildControlTowerWorkbenchDrillQuery({
        dimension: "mode",
        rowKey: "OCEAN",
        rowLabel: "",
      }),
    ).toBe("mode=OCEAN");
    expect(
      buildControlTowerWorkbenchDrillQuery({
        dimension: "lane",
        rowKey: "FRA -> CHI",
        rowLabel: "",
      }),
    ).toBe("originCode=FRA&destinationCode=CHI");
    expect(
      buildControlTowerWorkbenchDrillQuery({
        dimension: "lane",
        rowKey: "USWC",
        rowLabel: "",
      }),
    ).toBe("lane=USWC");
    expect(
      buildControlTowerWorkbenchDrillQuery({
        dimension: "lane",
        rowKey: "? -> ?",
        rowLabel: "",
      }),
    ).toBeNull();
  });

  it("maps carrier, customer, supplier via q when not Unknown", () => {
    expect(
      buildControlTowerWorkbenchDrillQuery({
        dimension: "carrier",
        rowKey: "id-1",
        rowLabel: "ACME Lines",
      }),
    ).toBe("q=ACME+Lines");
  });

  it("maps origin and destination codes", () => {
    expect(
      buildControlTowerWorkbenchDrillQuery({
        dimension: "origin",
        rowKey: "DEHAM",
        rowLabel: "",
      }),
    ).toBe("originCode=DEHAM");
    expect(
      buildControlTowerWorkbenchDrillQuery({
        dimension: "destination",
        rowKey: "Unknown",
        rowLabel: "USNYC",
      }),
    ).toBe("destinationCode=USNYC");
  });

  it("validates exceptionCatalog keys", () => {
    expect(
      buildControlTowerWorkbenchDrillQuery({
        dimension: "exceptionCatalog",
        rowKey: "DELAY.v1",
        rowLabel: "",
      }),
    ).toBe("exceptionCode=DELAY.v1");
    expect(
      buildControlTowerWorkbenchDrillQuery({
        dimension: "exceptionCatalog",
        rowKey: "(blank)",
        rowLabel: "",
      }),
    ).toBeNull();
    expect(
      buildControlTowerWorkbenchDrillQuery({
        dimension: "exceptionCatalog",
        rowKey: "bad code",
        rowLabel: "",
      }),
    ).toBeNull();
  });

  it("adds ship360Tab when requested", () => {
    expect(
      buildControlTowerWorkbenchDrillQuery({
        dimension: "mode",
        rowKey: "AIR",
        rowLabel: "",
        ship360Tab: "milestones",
      }),
    ).toBe("mode=AIR&ship360Tab=milestones");
  });
});

describe("controlTowerWorkbenchDrillHref", () => {
  it("prefixes workbench path or returns null", () => {
    expect(
      controlTowerWorkbenchDrillHref({
        dimension: "mode",
        rowKey: "RAIL",
        rowLabel: "",
      }),
    ).toBe("/control-tower/workbench?mode=RAIL");
    expect(
      controlTowerWorkbenchDrillHref({
        dimension: "month",
        rowKey: "2026-02",
        rowLabel: "Feb",
      }),
    ).toBeNull();
  });
});
