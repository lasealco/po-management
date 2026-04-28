import { describe, expect, it } from "vitest";

import {
  buildMeetingIntelligencePacket,
  buildObjectLinks,
  buildTranscriptDigest,
  extractMeetingActions,
  extractMeetingDecisions,
  extractMeetingRisks,
  redactTranscript,
  type MeetingIntelligenceInputs,
} from "./meeting-intelligence";

const inputs: MeetingIntelligenceInputs = {
  transcripts: [
    {
      id: "crm-1",
      sourceType: "CRM_ACTIVITY",
      title: "Ops standup with Acme",
      body: "We decided to approve the recovery plan. Alex must follow up with customer@example.com and call +1 555 123 4567. Risk of delay is urgent if warehouse misses cutoff.",
      speakerLabel: "Ops",
      occurredAt: "2026-04-28T00:00:00.000Z",
      objectType: "crm_account",
      objectId: "acct-1",
      objectHref: "/crm/accounts/acct-1",
    },
    {
      id: "ship-note-1",
      sourceType: "SHIPMENT_NOTE",
      title: "Shipment note",
      body: "Carrier confirmed pickup. Assign warehouse to update POD and review exception before close.",
      speakerLabel: "Control Tower",
      occurredAt: "2026-04-28T01:00:00.000Z",
      objectType: "shipment",
      objectId: "ship-1",
      objectHref: "/control-tower/shipments/ship-1",
    },
  ],
};

describe("meeting intelligence helpers", () => {
  it("redacts sensitive transcript content", () => {
    const result = redactTranscript(inputs.transcripts[0].body);

    expect(result.redacted).toContain("[redacted-email]");
    expect(result.redacted).toContain("[redacted-phone]");
    expect(result.redactions.map((item) => item.type)).toEqual(expect.arrayContaining(["EMAIL", "PHONE"]));
  });

  it("builds transcript digest with redaction counts", () => {
    const digest = buildTranscriptDigest(inputs.transcripts);

    expect(digest).toHaveLength(2);
    expect(digest[0].redactionCount).toBe(2);
    expect(digest[0].excerpt).not.toContain("customer@example.com");
  });

  it("extracts actions, risks, and decisions", () => {
    const actions = extractMeetingActions(inputs.transcripts);
    const risks = extractMeetingRisks(inputs.transcripts);
    const decisions = extractMeetingDecisions(inputs.transcripts);

    expect(actions.map((item) => item.action).join(" ")).toContain("follow up");
    expect(actions.every((item) => item.guardrail.includes("Requires review"))).toBe(true);
    expect(risks[0]).toMatchObject({ severity: "HIGH" });
    expect(decisions[0]).toMatchObject({ confidence: "HIGH" });
  });

  it("links extracted context back to source objects", () => {
    const links = buildObjectLinks(inputs.transcripts);

    expect(links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ objectType: "crm_account", objectId: "acct-1" }),
        expect.objectContaining({ objectType: "shipment", objectId: "ship-1" }),
      ]),
    );
  });

  it("builds a review-gated meeting packet", () => {
    const packet = buildMeetingIntelligencePacket(inputs);

    expect(packet.meetingScore).toBeGreaterThan(0);
    expect(packet.extractedActionCount).toBeGreaterThan(0);
    expect(packet.riskCount).toBeGreaterThan(0);
    expect(packet.decisionCount).toBeGreaterThan(0);
    expect(packet.redactionCount).toBe(2);
    expect(packet.minutes.guardrail).toContain("not created automatically");
    expect(packet.leadershipSummary).toContain("approval-gated");
  });
});
