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

export type ReportingCockpitSnapshot = {
  generatedAt: string;
  currency: string;
  summary: {
    openPoCount: number;
    inTransitShipmentCount: number;
    openCtExceptionCount: number;
    activeOpportunityCount: number;
    onHoldInventoryQty: number;
    uninvoicedBillingAmount: number;
  };
  exceptions: CockpitException[];
  cashCycle: CockpitCashFlowStage[];
};
