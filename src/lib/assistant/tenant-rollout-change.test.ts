import { describe, expect, it } from "vitest";

import { buildTenantRolloutPacket, type TenantRolloutInputs } from "./tenant-rollout-change";

const baseInputs: TenantRolloutInputs = {
  tenant: { id: "tenant-1", name: "Demo Company", slug: "demo-company", legalName: "Demo Company GmbH", countryCode: "DE" },
  users: [
    { id: "user-1", email: "admin@example.com", name: "Admin User", isActive: true, roleNames: ["Admin"], primaryOrgUnit: "Global", createdAt: "2026-04-29T00:00:00.000Z" },
    { id: "user-2", email: "ops@example.com", name: "Ops User", isActive: true, roleNames: ["Operations"], primaryOrgUnit: "EU", createdAt: "2026-04-29T00:00:00.000Z" },
    { id: "user-3", email: "warehouse@example.com", name: "Warehouse User", isActive: true, roleNames: ["Warehouse"], primaryOrgUnit: "WH-DEMO-DC1", createdAt: "2026-04-29T00:00:00.000Z" },
  ],
  orgUnits: [
    { id: "org-1", code: "GLOBAL", name: "Global", kind: "GROUP", parentId: null, roleCount: 1 },
    { id: "org-2", code: "EU", name: "EU", kind: "REGION", parentId: "org-1", roleCount: 1 },
    { id: "org-3", code: "WH-DEMO-DC1", name: "Demo DC", kind: "SITE", parentId: "org-2", roleCount: 1 },
  ],
  roles: [
    { id: "role-1", name: "Admin", isSystem: true, permissionCount: 10, userCount: 1 },
    { id: "role-2", name: "Operations", isSystem: false, permissionCount: 8, userCount: 1 },
    { id: "role-3", name: "Warehouse", isSystem: false, permissionCount: 6, userCount: 1 },
    { id: "role-4", name: "Finance", isSystem: false, permissionCount: 6, userCount: 0 },
    { id: "role-5", name: "Commercial", isSystem: false, permissionCount: 6, userCount: 0 },
    { id: "role-6", name: "Integration", isSystem: false, permissionCount: 6, userCount: 0 },
  ],
  adminControls: [{ id: "control-1", controlKey: "assistant-control", rolloutMode: "PILOT", packetStatus: "DRAFT", pilotRoleCount: 2, pilotSiteCount: 1, updatedAt: "2026-04-29T00:00:00.000Z" }],
  rolloutFactoryPackets: [{ id: "rollout-1", title: "Rollout factory", status: "APPROVED", readinessScore: 85, roleGrantGapCount: 0, moduleGapCount: 0, seedGapCount: 0, rollbackStepCount: 5 }],
  aiQualityReleasePackets: [{ id: "quality-1", title: "AI quality release", status: "APPROVED", qualityScore: 90, releaseBlockerCount: 0, failedEvalCount: 0 }],
  auditEvents: [
    { id: "audit-1", surface: "assistant", answerKind: "answer", feedback: "helpful", actorUserId: "user-1", createdAt: "2026-04-29T00:00:00.000Z" },
    { id: "audit-2", surface: "assistant", answerKind: "answer", feedback: "helpful", actorUserId: "user-2", createdAt: "2026-04-29T00:00:00.000Z" },
  ],
  actionQueue: [{ id: "action-1", actionKind: "tenant_rollout_change_review", status: "PENDING", priority: "MEDIUM", objectType: "assistant_tenant_rollout_packet", dueAt: null }],
};

describe("buildTenantRolloutPacket", () => {
  it("builds a tenant rollout and change enablement packet with review signals", () => {
    const packet = buildTenantRolloutPacket(baseInputs);

    expect(packet.title).toContain("Sprint 11 Tenant Rollout");
    expect(packet.tenantProfile.activeUserCount).toBe(3);
    expect(packet.tenantProfile.orgRoleCoveragePct).toBe(100);
    expect(packet.rolloutWaves.pilotUserCount).toBe(3);
    expect(packet.enablementPlan.trainingModuleCount).toBeGreaterThan(4);
    expect(packet.communicationPlan.channelCount).toBe(4);
    expect(packet.supportModel.supportOwnerCount).toBeGreaterThan(0);
    expect(packet.cutoverChecklist.checkCount).toBe(6);
    expect(packet.rollbackPlan.rollbackStepCount).toBeGreaterThan(4);
    expect(packet.leadershipSummary).toContain("Sprint 11 Tenant Rollout score");
  });

  it("keeps rollout and tenant changes review-gated", () => {
    const packet = buildTenantRolloutPacket(baseInputs);

    expect(packet.tenantProfile.guardrail).toContain("does not create tenants");
    expect(packet.stakeholderMap.guardrail).toContain("does not assign users");
    expect(packet.rolloutWaves.guardrail).toContain("no users are invited");
    expect(packet.enablementPlan.guardrail).toContain("does not send training invitations");
    expect(packet.communicationPlan.guardrail).toContain("does not email");
    expect(packet.adoptionTelemetry.guardrail).toContain("does not alter user status");
    expect(packet.supportModel.guardrail).toContain("does not assign owners");
    expect(packet.cutoverChecklist.guardrail).toContain("does not launch tenants");
    expect(packet.rollbackPlan.guardrail).toContain("does not revoke access");
    expect(packet.responsePlan.guardrail).toContain("review-only");
  });
});
