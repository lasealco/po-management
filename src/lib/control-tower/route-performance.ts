/**
 * Plan vs actual vs PO requested delivery — for Shipment 360 routing / delay visibility.
 */

export type RoutePerformanceLeg = {
  legNo: number;
  originCode: string | null;
  destinationCode: string | null;
  plannedEtd: string | null;
  plannedEta: string | null;
  actualAtd: string | null;
  actualAta: string | null;
};

export type RoutePerformancePayload = {
  orderRequestedDeliveryAt: string | null;
  bookingEtd: string | null;
  bookingEta: string | null;
  bookingLatestEta: string | null;
  /** First departure in plan (booking ETD or first leg ETD). */
  plannedDepartureAt: string | null;
  /** First recorded actual departure (first leg ATD in leg order), when present. */
  actualDepartureAt: string | null;
  /** Best-effort planned arrival at destination (last leg ETA or booking ETA / latest ETA). */
  plannedArrivalAt: string | null;
  /** Last known actual arrival (last leg ATA, else shipment receivedAt). */
  actualArrivalAt: string | null;
  /** Positive = planned arrival after PO requested day (calendar days). */
  plannedVsRequestedDays: number | null;
  /** Positive = actual arrival after PO requested day. */
  actualVsRequestedDays: number | null;
  plannedVsRequestedStatus: "ok" | "at_risk" | "late" | "unknown";
  /** Human-readable one-liner for ops. */
  summary: string | null;
  legs: RoutePerformanceLeg[];
  /** True when legs are derived from booking only (no CtShipmentLeg rows). */
  hasSyntheticLeg: boolean;
};

function utcDayMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function calendarDaysDiff(later: Date, earlier: Date): number {
  return Math.round((utcDayMs(later) - utcDayMs(earlier)) / 86_400_000);
}

type BuildInput = {
  requestedDeliveryDate: Date | null;
  booking: {
    etd: Date | null;
    eta: Date | null;
    latestEta: Date | null;
    originCode: string | null;
    destinationCode: string | null;
  } | null;
  legs: Array<{
    legNo: number;
    originCode: string | null;
    destinationCode: string | null;
    plannedEtd: Date | null;
    plannedEta: Date | null;
    actualAtd: Date | null;
    actualAta: Date | null;
  }>;
  shipmentReceivedAt: Date | null;
  shipmentStatus: string;
};

export function buildRoutePerformance(input: BuildInput): RoutePerformancePayload {
  const req = input.requestedDeliveryDate;

  const sortedLegs = [...input.legs].sort((a, b) => a.legNo - b.legNo);

  let legsOut: RoutePerformanceLeg[];
  let hasSyntheticLeg = false;

  if (sortedLegs.length > 0) {
    legsOut = sortedLegs.map((leg) => ({
      legNo: leg.legNo,
      originCode: leg.originCode,
      destinationCode: leg.destinationCode,
      plannedEtd: leg.plannedEtd?.toISOString() ?? null,
      plannedEta: leg.plannedEta?.toISOString() ?? null,
      actualAtd: leg.actualAtd?.toISOString() ?? null,
      actualAta: leg.actualAta?.toISOString() ?? null,
    }));
  } else if (
    input.booking?.originCode?.trim() &&
    input.booking?.destinationCode?.trim() &&
    (input.booking.etd || input.booking.eta || input.booking.latestEta)
  ) {
    hasSyntheticLeg = true;
    const b = input.booking;
    legsOut = [
      {
        legNo: 1,
        originCode: b.originCode,
        destinationCode: b.destinationCode,
        plannedEtd: b.etd?.toISOString() ?? null,
        plannedEta: (b.latestEta ?? b.eta)?.toISOString() ?? null,
        actualAtd: null,
        actualAta: null,
      },
    ];
  } else {
    legsOut = [];
  }

  const bookingEtd = input.booking?.etd?.toISOString() ?? null;
  const bookingEta = input.booking?.eta?.toISOString() ?? null;
  const bookingLatestEta = input.booking?.latestEta?.toISOString() ?? null;

  let plannedDepartureAt: string | null = bookingEtd;
  let plannedArrivalAt: string | null = bookingLatestEta ?? bookingEta ?? null;

  if (sortedLegs.length > 0) {
    const first = sortedLegs[0];
    const last = sortedLegs[sortedLegs.length - 1];
    if (first?.plannedEtd) plannedDepartureAt = first.plannedEtd.toISOString();
    if (last?.plannedEta) plannedArrivalAt = last.plannedEta.toISOString();
  }

  let actualDepartureAt: string | null = null;
  if (sortedLegs.length > 0) {
    for (const leg of sortedLegs) {
      if (leg.actualAtd) {
        actualDepartureAt = leg.actualAtd.toISOString();
        break;
      }
    }
  }

  let actualArrivalAt: string | null = input.shipmentReceivedAt?.toISOString() ?? null;
  if (sortedLegs.length > 0) {
    for (let i = sortedLegs.length - 1; i >= 0; i -= 1) {
      const ata = sortedLegs[i]?.actualAta;
      if (ata) {
        actualArrivalAt = ata.toISOString();
        break;
      }
    }
  }

  const orderRequestedDeliveryAt = req?.toISOString() ?? null;

  let plannedVsRequestedDays: number | null = null;
  let actualVsRequestedDays: number | null = null;

  if (req && plannedArrivalAt) {
    plannedVsRequestedDays = calendarDaysDiff(new Date(plannedArrivalAt), req);
  }
  if (req && actualArrivalAt) {
    actualVsRequestedDays = calendarDaysDiff(new Date(actualArrivalAt), req);
  }

  const delivered =
    input.shipmentStatus === "DELIVERED" ||
    input.shipmentStatus === "RECEIVED" ||
    Boolean(input.shipmentReceivedAt);

  let plannedVsRequestedStatus: RoutePerformancePayload["plannedVsRequestedStatus"] = "unknown";

  if (!req || !plannedArrivalAt) {
    plannedVsRequestedStatus = "unknown";
  } else if (delivered && actualArrivalAt) {
    plannedVsRequestedStatus = (actualVsRequestedDays ?? 0) > 0 ? "late" : "ok";
  } else if ((plannedVsRequestedDays ?? 0) > 0) {
    plannedVsRequestedStatus = "at_risk";
  } else {
    plannedVsRequestedStatus = "ok";
  }

  let summary: string | null = null;
  if (!req) {
    summary = "Set a requested delivery date on the PO to compare plan vs commitment.";
  } else if (!plannedArrivalAt) {
    summary = "Add booking dates or legs to see planned arrival vs PO date.";
  } else if (delivered && actualArrivalAt && (actualVsRequestedDays ?? 0) > 0) {
    summary = `Delivered ${actualVsRequestedDays} calendar day(s) after PO requested date.`;
  } else if (delivered && actualArrivalAt) {
    summary = `Delivered on or before PO requested date (vs actual arrival).`;
  } else if ((plannedVsRequestedDays ?? 0) > 0) {
    summary = `Planned arrival is ${plannedVsRequestedDays} day(s) after PO requested date — monitor for delay.`;
  } else {
    summary = `Planned arrival is on or before PO requested date.`;
  }

  return {
    orderRequestedDeliveryAt,
    bookingEtd,
    bookingEta,
    bookingLatestEta,
    plannedDepartureAt,
    actualDepartureAt,
    plannedArrivalAt,
    actualArrivalAt,
    plannedVsRequestedDays,
    actualVsRequestedDays,
    plannedVsRequestedStatus,
    summary,
    legs: legsOut,
    hasSyntheticLeg,
  };
}
