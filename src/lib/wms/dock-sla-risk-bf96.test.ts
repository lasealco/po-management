import { describe, expect, it } from "vitest";

import {
  buildDockSlaRiskScoresBf96,
  DOCK_SLA_RISK_SCORER_BF96_FLAG,
  isDockSlaRiskScorerBf96Enabled,
} from "./dock-sla-risk-bf96";
import { WMS_FEATURE_FLAGS_BF93_SCHEMA_VERSION } from "./wms-feature-flags-bf93";

const policyEnabled = {
  enabled: true,
  freeMinutesGateToDock: 120,
  freeMinutesDockToDepart: 240,
};

const policyDisabled = {
  enabled: false,
  freeMinutesGateToDock: 120,
  freeMinutesDockToDepart: 240,
};

describe("isDockSlaRiskScorerBf96Enabled", () => {
  it("is false when BF-93 parse error", () => {
    expect(
      isDockSlaRiskScorerBf96Enabled({
        schemaVersion: WMS_FEATURE_FLAGS_BF93_SCHEMA_VERSION,
        flags: {},
        parseError: "bad",
      }),
    ).toBe(false);
  });

  it("is false when flag unset", () => {
    expect(
      isDockSlaRiskScorerBf96Enabled({
        schemaVersion: WMS_FEATURE_FLAGS_BF93_SCHEMA_VERSION,
        flags: {},
      }),
    ).toBe(false);
  });

  it("is true when dockSlaRiskScorerBf96 is true", () => {
    expect(
      isDockSlaRiskScorerBf96Enabled({
        schemaVersion: WMS_FEATURE_FLAGS_BF93_SCHEMA_VERSION,
        flags: { [DOCK_SLA_RISK_SCORER_BF96_FLAG]: true },
      }),
    ).toBe(true);
  });
});

describe("buildDockSlaRiskScoresBf96", () => {
  const base = {
    warehouseId: "wh1",
    dockCode: "DOCK-A",
    status: "SCHEDULED",
    gateCheckedInAt: null as Date | null,
    atDockAt: null as Date | null,
    departedAt: null as Date | null,
  };

  it("skips non-SCHEDULED and departed rows", () => {
    const t0 = new Date("2026-05-01T12:00:00.000Z");
    const rows = buildDockSlaRiskScoresBf96(
      [
        {
          ...base,
          id: "a",
          windowStart: new Date("2026-05-01T11:00:00.000Z"),
          windowEnd: new Date("2026-05-01T13:00:00.000Z"),
          status: "CANCELLED",
          gateCheckedInAt: null,
          atDockAt: null,
          departedAt: null,
        },
        {
          ...base,
          id: "b",
          windowStart: new Date("2026-05-01T11:00:00.000Z"),
          windowEnd: new Date("2026-05-01T13:00:00.000Z"),
          status: "SCHEDULED",
          gateCheckedInAt: new Date("2026-05-01T11:30:00.000Z"),
          atDockAt: new Date("2026-05-01T12:00:00.000Z"),
          departedAt: new Date("2026-05-01T12:05:00.000Z"),
        },
      ],
      policyEnabled,
      t0,
    );
    expect(rows).toEqual([]);
  });

  it("PRE_GATE scores higher after window end without gate-in", () => {
    const now = new Date("2026-05-01T14:30:00.000Z");
    const rows = buildDockSlaRiskScoresBf96(
      [
        {
          ...base,
          id: "late",
          windowStart: new Date("2026-05-01T12:00:00.000Z"),
          windowEnd: new Date("2026-05-01T13:00:00.000Z"),
          gateCheckedInAt: null,
          atDockAt: null,
          departedAt: null,
        },
      ],
      policyEnabled,
      now,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.phase).toBe("PRE_GATE");
    expect(rows[0]!.riskScore).toBeGreaterThanOrEqual(72);
    expect(rows[0]!.factors).toContain("PRE_GATE_WINDOW_ENDED_NO_GATE_IN");
    expect(rows[0]!.minutesConsumed).toBe(null);
    expect(rows[0]!.detentionBreached).toBe(false);
  });

  it("GATE_TO_DOCK breach sets detentionBreached when policy enabled", () => {
    const gateIn = new Date("2026-05-01T10:00:00.000Z");
    const now = new Date("2026-05-01T13:00:00.000Z"); // 180 min > 120
    const rows = buildDockSlaRiskScoresBf96(
      [
        {
          ...base,
          id: "g2d",
          windowStart: new Date("2026-05-01T09:00:00.000Z"),
          windowEnd: new Date("2026-05-01T18:00:00.000Z"),
          gateCheckedInAt: gateIn,
          atDockAt: null,
          departedAt: null,
        },
      ],
      policyEnabled,
      now,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.phase).toBe("GATE_TO_DOCK");
    expect(rows[0]!.detentionBreached).toBe(true);
    expect(rows[0]!.minutesConsumed).toBe(180);
    expect(rows[0]!.minutesRemaining).toBe(-60);
    expect(rows[0]!.factors).toContain("BF54_SEGMENT_BREACH");
    expect(rows[0]!.factors).toContain("DETENTION_POLICY_BREACH");
    expect(rows[0]!.riskScore).toBeGreaterThanOrEqual(70);
  });

  it("same elapsed does not set detentionBreached when policy disabled", () => {
    const gateIn = new Date("2026-05-01T10:00:00.000Z");
    const now = new Date("2026-05-01T13:00:00.000Z");
    const rows = buildDockSlaRiskScoresBf96(
      [
        {
          ...base,
          id: "g2d",
          windowStart: new Date("2026-05-01T09:00:00.000Z"),
          windowEnd: new Date("2026-05-01T18:00:00.000Z"),
          gateCheckedInAt: gateIn,
          atDockAt: null,
          departedAt: null,
        },
      ],
      policyDisabled,
      now,
    );
    expect(rows[0]!.detentionBreached).toBe(false);
    expect(rows[0]!.factors).not.toContain("DETENTION_POLICY_BREACH");
  });

  it("sorts by riskScore desc then appointment id", () => {
    const now = new Date("2026-05-01T14:00:00.000Z");
    const tie = buildDockSlaRiskScoresBf96(
      [
        {
          ...base,
          id: "b-tie",
          windowStart: new Date("2026-05-01T12:00:00.000Z"),
          windowEnd: new Date("2026-05-01T13:00:00.000Z"),
          gateCheckedInAt: null,
          atDockAt: null,
          departedAt: null,
        },
        {
          ...base,
          id: "a-tie",
          windowStart: new Date("2026-05-01T12:00:00.000Z"),
          windowEnd: new Date("2026-05-01T13:00:00.000Z"),
          gateCheckedInAt: null,
          atDockAt: null,
          departedAt: null,
        },
      ],
      policyEnabled,
      now,
    );
    expect(tie.map((r) => r.appointmentId)).toEqual(["a-tie", "b-tie"]);
    expect(tie[0]!.riskScore).toBe(tie[1]!.riskScore);

    const spread = buildDockSlaRiskScoresBf96(
      [
        {
          ...base,
          id: "bbb",
          windowStart: new Date("2026-05-01T10:00:00.000Z"),
          windowEnd: new Date("2026-05-01T13:00:00.000Z"),
          gateCheckedInAt: null,
          atDockAt: null,
          departedAt: null,
        },
        {
          ...base,
          id: "aaa",
          windowStart: new Date("2026-05-01T10:00:00.000Z"),
          windowEnd: new Date("2026-05-01T11:00:00.000Z"),
          gateCheckedInAt: null,
          atDockAt: null,
          departedAt: null,
        },
      ],
      policyEnabled,
      now,
    );
    expect(spread.map((r) => r.appointmentId)).toEqual(["aaa", "bbb"]);
    expect(spread[0]!.riskScore).toBeGreaterThan(spread[1]!.riskScore);
  });
});
