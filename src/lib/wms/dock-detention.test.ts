import { describe, expect, it } from "vitest";

import {
  collectDockDetentionAlerts,
  detectMilestonePhaseBreach,
  parseDockDetentionPolicy,
} from "./dock-detention";

describe("parseDockDetentionPolicy", () => {
  it("defaults to disabled when null", () => {
    const p = parseDockDetentionPolicy(null);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.value.enabled).toBe(false);
  });

  it("enables when enabled true", () => {
    const p = parseDockDetentionPolicy({
      enabled: true,
      freeMinutesGateToDock: 60,
      freeMinutesDockToDepart: 90,
    });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.value.enabled).toBe(true);
    expect(p.value.freeMinutesGateToDock).toBe(60);
    expect(p.value.freeMinutesDockToDepart).toBe(90);
  });
});

describe("collectDockDetentionAlerts", () => {
  const policy = parseDockDetentionPolicy({ enabled: true, freeMinutesGateToDock: 60, freeMinutesDockToDepart: 120 });
  if (!policy.ok) throw new Error("policy");
  const p = policy.value;

  it("flags gate-to-dock overrun", () => {
    const t0 = new Date("2026-01-10T10:00:00.000Z");
    const now = new Date("2026-01-10T11:05:00.000Z");
    const alerts = collectDockDetentionAlerts(
      [
        {
          id: "a1",
          warehouseId: "wh",
          dockCode: "D1",
          status: "SCHEDULED",
          gateCheckedInAt: t0,
          atDockAt: null,
          departedAt: null,
        },
      ],
      p,
      now,
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.phase).toBe("GATE_TO_DOCK");
    expect(alerts[0]?.minutesOver).toBe(5);
  });

  it("ignores when policy disabled", () => {
    const disabled = parseDockDetentionPolicy({ enabled: false });
    if (!disabled.ok) throw new Error("d");
    const now = new Date("2026-01-10T12:00:00.000Z");
    const alerts = collectDockDetentionAlerts(
      [
        {
          id: "a1",
          warehouseId: "wh",
          dockCode: "D1",
          status: "SCHEDULED",
          gateCheckedInAt: new Date("2026-01-10T10:00:00.000Z"),
          atDockAt: null,
          departedAt: null,
        },
      ],
      disabled.value,
      now,
    );
    expect(alerts).toHaveLength(0);
  });
});

describe("detectMilestonePhaseBreach", () => {
  const policy = parseDockDetentionPolicy({ enabled: true, freeMinutesGateToDock: 60, freeMinutesDockToDepart: 30 });
  if (!policy.ok) throw new Error("policy");
  const p = policy.value;

  it("detects gate-to-dock breach on AT_DOCK", () => {
    const gate = new Date("2026-01-10T10:00:00.000Z");
    const atDock = new Date("2026-01-10T11:30:00.000Z");
    const b = detectMilestonePhaseBreach({
      policy: p,
      milestone: "AT_DOCK",
      occurredAt: atDock,
      gateCheckedInAt: gate,
      atDockAt: null,
    });
    expect(b?.phase).toBe("GATE_TO_DOCK");
    expect(b?.actualMinutes).toBe(90);
  });

  it("detects dock dwell breach on DEPARTED", () => {
    const atDock = new Date("2026-01-10T10:00:00.000Z");
    const dep = new Date("2026-01-10T10:45:00.000Z");
    const b = detectMilestonePhaseBreach({
      policy: p,
      milestone: "DEPARTED",
      occurredAt: dep,
      gateCheckedInAt: new Date("2026-01-10T09:00:00.000Z"),
      atDockAt: atDock,
    });
    expect(b?.phase).toBe("DOCK_DWELL");
    expect(b?.actualMinutes).toBe(45);
  });
});
