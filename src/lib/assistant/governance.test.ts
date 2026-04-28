import { describe, expect, it } from "vitest";

import {
  buildDeletionRequests,
  buildExportManifest,
  buildGovernancePacket,
  buildLegalHoldReview,
  buildPrivacyReview,
  buildRetentionPlan,
  type GovernanceInputs,
} from "./governance";

const oldDate = new Date(Date.now() - 120 * 86_400_000).toISOString();
const recentDate = new Date(Date.now() - 10 * 86_400_000).toISOString();

const inputs: GovernanceInputs = {
  retentionDays: 90,
  records: [
    {
      id: "audit-1",
      sourceType: "AUDIT_EVENT",
      title: "Assistant answer with customer email",
      status: "not_helpful",
      createdAt: oldDate,
      archivedAt: null,
      hasPersonalData: true,
      hasExportPayload: true,
      legalHold: false,
      objectType: "shipment",
      objectId: "ship-1",
    },
    {
      id: "evidence-1",
      sourceType: "EVIDENCE_RECORD",
      title: "Litigation hold evidence",
      status: "LINK",
      createdAt: oldDate,
      archivedAt: null,
      hasPersonalData: false,
      hasExportPayload: true,
      legalHold: true,
      objectType: "assistant_evidence_record",
      objectId: "evidence-1",
    },
    {
      id: "email-1",
      sourceType: "EMAIL_THREAD",
      title: "Archived customer thread",
      status: "OPEN",
      createdAt: oldDate,
      archivedAt: oldDate,
      hasPersonalData: true,
      hasExportPayload: false,
      legalHold: false,
      objectType: "assistant_email_thread",
      objectId: "email-1",
    },
    {
      id: "prompt-1",
      sourceType: "PROMPT",
      title: "Recent approved prompt",
      status: "APPROVED",
      createdAt: recentDate,
      archivedAt: null,
      hasPersonalData: false,
      hasExportPayload: false,
      legalHold: false,
      objectType: "assistant_prompt",
      objectId: "prompt-1",
    },
  ],
};

describe("assistant governance helpers", () => {
  it("builds a retention dry-run and blocks legal-hold records", () => {
    const plan = buildRetentionPlan(inputs);

    expect(plan.candidateCount).toBe(2);
    expect(plan.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceId: "audit-1", recommendedAction: "ARCHIVE_REVIEW" }),
        expect.objectContaining({ sourceId: "evidence-1", recommendedAction: "HOLD" }),
      ]),
    );
    expect(plan.guardrail).toContain("dry-run");
  });

  it("creates privacy-safe export metadata without exposing sensitive titles", () => {
    const manifest = buildExportManifest(inputs.records);
    const privacy = buildPrivacyReview(inputs.records);

    expect(manifest.recordCount).toBe(2);
    expect(manifest.records.find((record) => record.sourceId === "audit-1")?.title).toBe("AUDIT_EVENT:audit-1");
    expect(privacy.risks[0].safeExcerpt).toContain("withheld");
  });

  it("surfaces deletion requests only after archive and without legal hold", () => {
    const deletions = buildDeletionRequests(inputs.records);
    const holds = buildLegalHoldReview(inputs.records);

    expect(deletions.requestCount).toBe(1);
    expect(deletions.requests[0]).toMatchObject({ sourceId: "email-1", status: "READY_FOR_REVIEW" });
    expect(holds.holdCount).toBe(1);
  });

  it("builds a review-gated governance packet without mutating source records", () => {
    const packet = buildGovernancePacket(inputs);

    expect(packet.governanceScore).toBeLessThan(80);
    expect(packet.retentionCandidateCount).toBe(2);
    expect(packet.privacyRiskCount).toBe(2);
    expect(packet.legalHoldBlockCount).toBe(1);
    expect(packet.auditPlan.blockedActions[0]).toContain("legal-hold");
    expect(packet.leadershipSummary).toContain("does not mutate source records");
  });
});
