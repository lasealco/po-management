import { describe, expect, it } from "vitest";

import {
  ATP_RESERVATION_POLICY_BF88_SCHEMA_VERSION,
  parseAtpReservationPolicyBf88Json,
  resolveTierForSoftReservationBf88,
  validateAtpReservationPolicyDraftFromPost,
} from "./atp-reservation-policy-bf88";

describe("atp-reservation-policy-bf88", () => {
  it("parseAtpReservationPolicyBf88Json yields defaults when null", () => {
    const { policy } = parseAtpReservationPolicyBf88Json(null);
    expect(policy.schemaVersion).toBe(ATP_RESERVATION_POLICY_BF88_SCHEMA_VERSION);
    expect(policy.defaultTtlSeconds).toBe(3600);
    expect(policy.pickAllocationSoftReservationPriorityFloorBf88).toBeNull();
    expect(policy.tiers).toEqual([]);
  });

  it("resolveTierForSoftReservationBf88 matches first tier by prefix", () => {
    const { policy } = parseAtpReservationPolicyBf88Json({
      schemaVersion: ATP_RESERVATION_POLICY_BF88_SCHEMA_VERSION,
      defaultTtlSeconds: 3600,
      defaultPriorityBf88: 100,
      pickAllocationSoftReservationPriorityFloorBf88: null,
      tiers: [
        {
          ttlSeconds: 7200,
          priorityBf88: 500,
          matchReferenceTypePrefix: "CHANNEL:",
        },
      ],
    });
    const hit = resolveTierForSoftReservationBf88(policy, {
      referenceType: "CHANNEL:ECOM",
      referenceId: null,
      tierTag: null,
    });
    expect(hit.ttlSeconds).toBe(7200);
    expect(hit.priorityBf88).toBe(500);
    const miss = resolveTierForSoftReservationBf88(policy, {
      referenceType: "OTHER",
      referenceId: "x",
      tierTag: null,
    });
    expect(miss.ttlSeconds).toBe(3600);
    expect(miss.priorityBf88).toBe(100);
  });

  it("resolveTierForSoftReservationBf88 matches tier tag", () => {
    const { policy } = parseAtpReservationPolicyBf88Json({
      schemaVersion: ATP_RESERVATION_POLICY_BF88_SCHEMA_VERSION,
      defaultTtlSeconds: 1800,
      defaultPriorityBf88: 200,
      pickAllocationSoftReservationPriorityFloorBf88: null,
      tiers: [{ ttlSeconds: 900, priorityBf88: 800, matchTierTag: "VIP" }],
    });
    const hit = resolveTierForSoftReservationBf88(policy, {
      referenceType: "",
      referenceId: "",
      tierTag: "VIP",
    });
    expect(hit.ttlSeconds).toBe(900);
    expect(hit.priorityBf88).toBe(800);
  });

  it("validateAtpReservationPolicyDraftFromPost rejects invalid tiers", () => {
    const bad = validateAtpReservationPolicyDraftFromPost({
      defaultTtlSeconds: 3600,
      defaultPriorityBf88: 100,
      pickAllocationSoftReservationPriorityFloorBf88: null,
      tiers: [{}],
    });
    expect(bad.ok).toBe(false);
  });

  it("validateAtpReservationPolicyDraftFromPost accepts floor null via omit", () => {
    const ok = validateAtpReservationPolicyDraftFromPost({
      defaultTtlSeconds: 7200,
      defaultPriorityBf88: 300,
      pickAllocationSoftReservationPriorityFloorBf88: null,
      tiers: [],
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.policy.pickAllocationSoftReservationPriorityFloorBf88).toBeNull();
    }
  });
});
