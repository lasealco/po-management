import { describe, expect, it } from "vitest";

import {
  buildConnectorReadiness,
  buildMappingReview,
  buildPartnerEcosystemPacket,
  buildPartnerScope,
  type PartnerEcosystemInputs,
} from "./partner-ecosystem";

const inputs: PartnerEcosystemInputs = {
  connectors: [
    {
      id: "conn-ready",
      name: "Ready TMS",
      sourceKind: "api",
      authMode: "oauth",
      authState: "configured",
      status: "active",
      healthSummary: "Healthy",
      lastSyncAt: "2026-04-28T00:00:00.000Z",
    },
    {
      id: "conn-blocked",
      name: "Carrier Portal",
      sourceKind: "file",
      authMode: "api_key",
      authState: "not_configured",
      status: "draft",
      healthSummary: null,
      lastSyncAt: null,
    },
  ],
  mappings: [
    {
      id: "batch-1",
      sourceType: "STAGING_BATCH",
      title: "Carrier onboarding rows",
      status: "open",
      rowCount: 12,
      issueCount: 2,
      updatedAt: "2026-04-28T00:00:00.000Z",
    },
    {
      id: "job-1",
      sourceType: "MAPPING_JOB",
      title: "Supplier mapping job",
      status: "failed",
      issueCount: 1,
      severity: "ERROR",
      updatedAt: "2026-04-28T00:00:00.000Z",
    },
  ],
  partners: [
    { id: "supplier-ready", name: "Ready Supplier", type: "SUPPLIER", portalLinked: true, status: "active", countryCode: "DE" },
    { id: "customer-gap", name: "Acme Customer", type: "CUSTOMER", portalLinked: false, status: "active", countryCode: "enterprise" },
    { id: "supplier-gap", name: "Unknown Supplier", type: "SUPPLIER", portalLinked: true, status: "active", countryCode: null },
  ],
};

describe("partner ecosystem assistant helpers", () => {
  it("scores connector readiness and exposes launch blockers", () => {
    const readiness = buildConnectorReadiness(inputs.connectors);

    expect(readiness[0]).toMatchObject({ launchState: "READY", readinessScore: 100 });
    expect(readiness[1].launchState).toBe("BLOCKED");
    expect(readiness[1].blockers).toEqual(
      expect.arrayContaining(["Connector is not active.", "Authentication is not configured.", "No successful sync evidence yet."]),
    );
  });

  it("identifies partner portal scope gaps", () => {
    const scope = buildPartnerScope(inputs.partners);

    expect(scope.supplierCount).toBe(2);
    expect(scope.customerCount).toBe(1);
    expect(scope.portalReadyCount).toBe(2);
    expect(scope.gaps.map((gap) => gap.gap)).toEqual(expect.arrayContaining(["No portal-linked user.", "Missing country/region scope."]));
  });

  it("summarizes staging and mapping review issues", () => {
    const review = buildMappingReview(inputs.mappings);

    expect(review.issueCount).toBeGreaterThanOrEqual(3);
    expect(review.openReviewCount).toBe(2);
    expect(review.items[1]).toMatchObject({ severity: "ERROR", requiredAction: "Resolve failed mapping or review item before launch." });
  });

  it("builds a launch packet with no-auto-launch guardrails", () => {
    const packet = buildPartnerEcosystemPacket(inputs);

    expect(packet.readinessScore).toBeGreaterThan(0);
    expect(packet.mappingIssueCount).toBeGreaterThan(0);
    expect(packet.onboardingPlan.steps.map((step) => step.step)).toEqual(
      expect.arrayContaining(["Connector readiness", "Partner portal scope", "Mapping and staging review", "Launch approval"]),
    );
    expect(packet.launchChecklist.guardrail).toContain("Do not activate partner workflows");
    expect(packet.leadershipSummary).toContain("human-approved");
  });
});
