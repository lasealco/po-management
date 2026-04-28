export type TransportationProcurementCandidate = {
  responseId: string;
  supplierId: string | null;
  carrierName: string;
  currency: string;
  totalAmount: number | null;
  quoteStatus: string;
  snapshotCount: number;
  shipmentCount: number;
  lateShipmentCount: number;
  invoiceIntakeCount: number;
  invoiceRedLineCount: number;
  invoiceAmberLineCount: number;
};

export type CarrierScorecard = TransportationProcurementCandidate & {
  costScore: number;
  serviceScore: number;
  invoiceScore: number;
  evidenceScore: number;
  allocationScore: number;
  riskFlags: string[];
  recommendation: "RECOMMENDED" | "SHORTLIST" | "WATCH" | "BLOCKED";
};

export function normalizeAmount(value: unknown): number | null {
  if (value == null) return null;
  const raw = typeof value === "object" && value !== null && "toString" in value ? String(value.toString()) : String(value);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function buildCarrierScorecards(candidates: TransportationProcurementCandidate[]): CarrierScorecard[] {
  const priced = candidates.map((candidate) => candidate.totalAmount).filter((value): value is number => value != null);
  const lowest = priced.length > 0 ? Math.min(...priced) : null;

  return candidates
    .map((candidate) => {
      const costScore =
        lowest == null || candidate.totalAmount == null || candidate.totalAmount <= 0
          ? 55
          : clampScore(100 - ((candidate.totalAmount - lowest) / Math.max(lowest, 1)) * 80);
      const serviceScore =
        candidate.shipmentCount <= 0
          ? 60
          : clampScore(100 - (candidate.lateShipmentCount / Math.max(candidate.shipmentCount, 1)) * 70);
      const invoicePenalty = candidate.invoiceRedLineCount * 18 + candidate.invoiceAmberLineCount * 7;
      const invoiceScore = candidate.invoiceIntakeCount <= 0 ? 65 : clampScore(100 - invoicePenalty);
      const evidenceScore = clampScore(
        25 +
          (candidate.totalAmount != null ? 25 : 0) +
          Math.min(20, candidate.snapshotCount * 10) +
          Math.min(20, candidate.shipmentCount * 4) +
          Math.min(10, candidate.invoiceIntakeCount * 5),
      );
      const riskFlags = [
        candidate.totalAmount == null ? "Missing all-in quote amount" : null,
        candidate.snapshotCount === 0 ? "No frozen booking/pricing snapshot yet" : null,
        candidate.shipmentCount === 0 ? "No shipment execution history visible" : null,
        candidate.lateShipmentCount > 0 ? `${candidate.lateShipmentCount} late shipment signal${candidate.lateShipmentCount === 1 ? "" : "s"}` : null,
        candidate.invoiceRedLineCount > 0 ? `${candidate.invoiceRedLineCount} red invoice audit line${candidate.invoiceRedLineCount === 1 ? "" : "s"}` : null,
      ].filter((flag): flag is string => Boolean(flag));
      const allocationScore = clampScore(costScore * 0.35 + serviceScore * 0.25 + invoiceScore * 0.2 + evidenceScore * 0.2);
      const recommendation: CarrierScorecard["recommendation"] =
        allocationScore >= 80 && riskFlags.length <= 1
          ? "RECOMMENDED"
          : allocationScore >= 65
            ? "SHORTLIST"
            : allocationScore >= 45
              ? "WATCH"
              : "BLOCKED";

      return {
        ...candidate,
        costScore,
        serviceScore,
        invoiceScore,
        evidenceScore,
        allocationScore,
        riskFlags,
        recommendation,
      };
    })
    .sort((a, b) => b.allocationScore - a.allocationScore || a.carrierName.localeCompare(b.carrierName));
}

export function buildTransportationAllocationPlan(scorecards: CarrierScorecard[]) {
  const recommended = scorecards[0] ?? null;
  return {
    status: recommended == null ? "NO_RESPONSES" : recommended.allocationScore >= 70 ? "READY_FOR_APPROVAL" : "PROCUREMENT_REVIEW",
    recommendedCarrier: recommended?.carrierName ?? null,
    recommendedResponseId: recommended?.responseId ?? null,
    recommendedSupplierId: recommended?.supplierId ?? null,
    allocationScore: recommended?.allocationScore ?? 0,
    rationale: recommended
      ? [
          `${recommended.carrierName} leads with ${recommended.allocationScore}/100 allocation confidence.`,
          `Cost ${recommended.costScore}/100, service ${recommended.serviceScore}/100, invoice ${recommended.invoiceScore}/100, evidence ${recommended.evidenceScore}/100.`,
          recommended.riskFlags.length > 0
            ? `Risks to review: ${recommended.riskFlags.join("; ")}.`
            : "No major cost/service/invoice risk flag in current evidence.",
        ]
      : ["No comparable RFQ response is available yet."],
    nextActions: [
      recommended ? `Approve allocation to ${recommended.carrierName} or shortlist the next carrier.` : "Collect at least one submitted carrier response.",
      "Freeze or link booking/pricing snapshot before tender release.",
      "Use invoice audit feedback after execution to validate promised cost.",
      "Queue tender/escalation draft for human approval before sending anything externally.",
    ],
  };
}

export function buildTenderDraft(input: {
  rfqTitle: string;
  originLabel: string;
  destinationLabel: string;
  equipmentSummary: string | null;
  allocationPlan: ReturnType<typeof buildTransportationAllocationPlan>;
}) {
  const carrier = input.allocationPlan.recommendedCarrier ?? "selected carrier";
  return {
    subject: `Tender allocation review: ${input.rfqTitle}`,
    body: [
      `Please review the proposed allocation to ${carrier} for ${input.originLabel} to ${input.destinationLabel}.`,
      input.equipmentSummary ? `Equipment / cargo basis: ${input.equipmentSummary}.` : "Equipment / cargo basis: confirm before tender.",
      `Assistant rationale: ${input.allocationPlan.rationale.join(" ")}`,
      "No tender has been sent automatically. Approve the queued action before external communication.",
    ].join("\n\n"),
  };
}

export function buildTransportationProcurementSummary(plan: ReturnType<typeof buildTransportationAllocationPlan>) {
  return [
    plan.recommendedCarrier
      ? `${plan.recommendedCarrier} is recommended at ${plan.allocationScore}/100 allocation confidence.`
      : "No carrier recommendation is available.",
    plan.rationale[1] ?? "",
    "Human approval is required before allocation, tender, booking mutation, or external carrier communication.",
  ]
    .filter(Boolean)
    .join("\n");
}
