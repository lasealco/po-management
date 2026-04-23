/** Human labels for `ScriEventRecommendation.recommendationType` (R5 v0). */
export const SCR_RECOMMENDATION_TYPE_LABELS: Record<string, string> = {
  EXEC_ESCALATION: "Executive escalation",
  CONTACT_LOGISTICS_PARTNER: "Contact carrier / forwarder",
  ALERT_AFFECTED_SITE: "Alert affected site",
  VERIFY_STOCK_POSITION: "Verify stock position",
  NARROW_SHIPMENT_CANDIDATES: "Narrow shipment candidates",
  TRIAGE_WIDE_PO_EXPOSURE: "Triage broad PO exposure",
  TRADE_COMPLIANCE_DESK: "Trade & compliance desk",
  CONFIRM_GEO_COVERAGE: "Confirm geography coverage",
};

export function scriRecommendationTypeLabel(type: string): string {
  return SCR_RECOMMENDATION_TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}
