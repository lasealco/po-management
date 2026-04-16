export type CockpitException = {
  id: string;
  label: string;
  count: number;
  severity: "high" | "medium";
  href: string;
};

export type CockpitCashFlowStage = {
  id: string;
  label: string;
  amount: number;
  hint: string;
};

export type CockpitRecommendedAction = {
  id: string;
  title: string;
  reason: string;
  href: string;
  priority: "P1" | "P2";
};

export type CockpitWeekPair = {
  last7: number;
  prev7: number;
};

export type CockpitActivityTrends = {
  /** Human-readable comparison window, e.g. last 7 calendar days vs the prior 7. */
  periodLabel: string;
  purchaseOrdersCreated: CockpitWeekPair;
  shipmentsCreated: CockpitWeekPair;
  ctExceptionsOpened: CockpitWeekPair;
  crmActivitiesCreated: CockpitWeekPair;
};

export type CockpitSummary = {
  openPoCount: number;
  inTransitShipmentCount: number;
  openCtExceptionCount: number;
  activeOpportunityCount: number;
  onHoldInventoryQty: number;
  uninvoicedBillingAmount: number;
};

/** Signed deltas vs the last stored cockpit headline snapshot for this user (see `reporting.cockpitHeadlineBaseline`). */
export type CockpitHeadlineChange = {
  sinceLabel: string;
  baselineGeneratedAt: string;
  openPoCount: number;
  inTransitShipmentCount: number;
  openCtExceptionCount: number;
  activeOpportunityCount: number;
  onHoldInventoryQty: number;
  uninvoicedBillingAmount: number;
};

export type ReportingCockpitSnapshot = {
  generatedAt: string;
  currency: string;
  summary: CockpitSummary;
  /** Null on first load per user, or when `actorUserId` was not passed. */
  headlineChange: CockpitHeadlineChange | null;
  activityTrends: CockpitActivityTrends;
  exceptions: CockpitException[];
  cashCycle: CockpitCashFlowStage[];
  recommendedActions: CockpitRecommendedAction[];
};
