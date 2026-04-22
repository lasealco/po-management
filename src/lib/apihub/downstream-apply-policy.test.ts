import { describe, expect, it } from "vitest";

import {
  apiHubIngestionUpsertAllowed,
  apiHubPurchaseOrderLineMergeAllowed,
  type ApiHubIngestionApplyMatchKey,
  type ApiHubIngestionApplyWriteMode,
  type ApiHubStagingApplyTarget,
} from "./constants";

/**
 * Locks the R3 policy matrix documented in docs/apihub/downstream-apply-semantics.md
 * (must stay aligned with ingestion-apply-repo + staging-batch-apply).
 */
describe("downstream apply policy (R3 matrix)", () => {
  const W: ApiHubIngestionApplyWriteMode = "upsert";
  const C: ApiHubIngestionApplyWriteMode = "create_only";

  it("disallows upsert for control_tower_audit for every matchKey", () => {
    const keys: ApiHubIngestionApplyMatchKey[] = [
      "none",
      "sales_order_external_ref",
      "purchase_order_buyer_reference",
    ];
    for (const matchKey of keys) {
      expect(apiHubIngestionUpsertAllowed("control_tower_audit", matchKey)).toBe(false);
    }
  });

  it("allows SO upsert only with sales_order_external_ref", () => {
    expect(apiHubIngestionUpsertAllowed("sales_order", "none")).toBe(false);
    expect(apiHubIngestionUpsertAllowed("sales_order", "purchase_order_buyer_reference")).toBe(false);
    expect(apiHubIngestionUpsertAllowed("sales_order", "sales_order_external_ref")).toBe(true);
  });

  it("allows PO upsert only with purchase_order_buyer_reference", () => {
    expect(apiHubIngestionUpsertAllowed("purchase_order", "none")).toBe(false);
    expect(apiHubIngestionUpsertAllowed("purchase_order", "sales_order_external_ref")).toBe(false);
    expect(apiHubIngestionUpsertAllowed("purchase_order", "purchase_order_buyer_reference")).toBe(true);
  });

  it("allows purchaseOrderLineMerge only for PO + buyer ref + upsert", () => {
    const so: ApiHubStagingApplyTarget = "sales_order";
    const po: ApiHubStagingApplyTarget = "purchase_order";
    const ct: ApiHubStagingApplyTarget = "control_tower_audit";
    const br: ApiHubIngestionApplyMatchKey = "purchase_order_buyer_reference";

    expect(apiHubPurchaseOrderLineMergeAllowed(po, br, W)).toBe(true);
    expect(apiHubPurchaseOrderLineMergeAllowed(po, br, C)).toBe(false);
    expect(apiHubPurchaseOrderLineMergeAllowed(po, "none", W)).toBe(false);
    expect(apiHubPurchaseOrderLineMergeAllowed(so, br, W)).toBe(false);
    expect(apiHubPurchaseOrderLineMergeAllowed(ct, br, W)).toBe(false);
  });
});
