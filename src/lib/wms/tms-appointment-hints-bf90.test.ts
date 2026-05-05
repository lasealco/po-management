import { describe, expect, it } from "vitest";

import {
  BF90_DETENTION_PRESSURE_LEAD_MINUTES,
  buildTmsAppointmentHintsBf90Doc,
  intervalsOverlapInclusive,
  type Bf90AppointmentInput,
} from "@/lib/wms/tms-appointment-hints-bf90";

function baseAppt(p: Partial<Bf90AppointmentInput> & Pick<Bf90AppointmentInput, "id">): Bf90AppointmentInput {
  return {
    warehouseId: "wh1",
    dockCode: "D-A",
    windowStart: new Date("2026-06-01T10:00:00.000Z"),
    windowEnd: new Date("2026-06-01T11:00:00.000Z"),
    direction: "OUTBOUND",
    status: "SCHEDULED",
    tmsLoadId: null,
    tmsCarrierBookingRef: null,
    gateCheckedInAt: null,
    atDockAt: null,
    departedAt: null,
    ...p,
  };
}

describe("intervalsOverlapInclusive", () => {
  it("detects overlap", () => {
    expect(intervalsOverlapInclusive(0, 100, 50, 150)).toBe(true);
    expect(intervalsOverlapInclusive(0, 100, 100, 200)).toBe(false);
  });
});

describe("buildTmsAppointmentHintsBf90Doc", () => {
  it("flags overlapping SCHEDULED windows on the same dock", () => {
    const now = new Date("2026-06-01T09:00:00.000Z");
    const doc = buildTmsAppointmentHintsBf90Doc({
      now,
      warehouseIdFilter: null,
      detentionPolicyJson: null,
      appointments: [
        baseAppt({
          id: "a1",
          windowStart: new Date("2026-06-01T12:00:00.000Z"),
          windowEnd: new Date("2026-06-01T13:00:00.000Z"),
        }),
        baseAppt({
          id: "a2",
          windowStart: new Date("2026-06-01T12:30:00.000Z"),
          windowEnd: new Date("2026-06-01T14:00:00.000Z"),
        }),
      ],
    });

    expect(doc.schemaVersion).toBe("bf90.v1");
    expect(doc.advisoryOnly).toBe(true);
    const overlaps = doc.hints.filter((h) => h.kind === "OVERLAPPING_WINDOWS");
    expect(overlaps.length).toBe(2);
    expect(overlaps.every((h) => h.severity === "WARN")).toBe(true);
  });

  it("emits queue-depth hints when many trailers stack at one dock", () => {
    const now = new Date("2026-06-01T09:00:00.000Z");
    const appointments: Bf90AppointmentInput[] = [];
    for (let i = 0; i < 3; i += 1) {
      appointments.push(
        baseAppt({
          id: `q${i}`,
          windowStart: new Date(`2026-06-02T${10 + i}:00:00.000Z`),
          windowEnd: new Date(`2026-06-02T${11 + i}:00:00.000Z`),
        }),
      );
    }
    const doc = buildTmsAppointmentHintsBf90Doc({
      now,
      warehouseIdFilter: null,
      detentionPolicyJson: null,
      appointments,
    });

    const depth = doc.hints.filter((h) => h.kind === "QUEUE_DEPTH");
    expect(depth.length).toBeGreaterThanOrEqual(1);
    expect(depth.some((h) => h.appointmentId === "q2")).toBe(true);
  });

  it("surfaces BF-54 detention breach via hints", () => {
    const now = new Date("2026-06-01T14:00:00.000Z");
    const doc = buildTmsAppointmentHintsBf90Doc({
      now,
      warehouseIdFilter: null,
      detentionPolicyJson: {
        enabled: true,
        freeMinutesGateToDock: 120,
        freeMinutesDockToDepart: 240,
      },
      appointments: [
        baseAppt({
          id: "slow",
          gateCheckedInAt: new Date("2026-06-01T11:00:00.000Z"),
          atDockAt: null,
        }),
      ],
    });

    const breach = doc.hints.filter((h) => h.kind === "DETENTION_BREACH");
    expect(breach.length).toBe(1);
    expect(breach[0]!.severity).toBe("WARN");
    expect(breach[0]!.context.phase).toBe("GATE_TO_DOCK");
  });

  it("emits detention pressure before BF-54 breach", () => {
    const now = new Date("2026-06-01T12:10:00.000Z");
    const doc = buildTmsAppointmentHintsBf90Doc({
      now,
      warehouseIdFilter: null,
      detentionPolicyJson: {
        enabled: true,
        freeMinutesGateToDock: 120,
        freeMinutesDockToDepart: 240,
      },
      appointments: [
        baseAppt({
          id: "warm",
          gateCheckedInAt: new Date("2026-06-01T10:15:00.000Z"),
          atDockAt: null,
        }),
      ],
    });

    const pressure = doc.hints.filter((h) => h.kind === "DETENTION_PRESSURE");
    expect(pressure.length).toBe(1);
    expect(pressure[0]!.severity).toBe("INFO");
    expect(Number(pressure[0]!.context.minutesRemaining)).toBeLessThanOrEqual(BF90_DETENTION_PRESSURE_LEAD_MINUTES);

    const breach = doc.hints.filter((h) => h.kind === "DETENTION_BREACH");
    expect(breach.length).toBe(0);
  });

  it("records policyParseError when detention JSON is invalid", () => {
    const doc = buildTmsAppointmentHintsBf90Doc({
      now: new Date(),
      warehouseIdFilter: null,
      detentionPolicyJson: [],
      appointments: [baseAppt({ id: "x1" })],
    });

    expect(doc.detentionPolicySummary.policyParseError).toMatch(/object/i);
    expect(doc.detentionPolicySummary.enabled).toBe(false);
  });
});
