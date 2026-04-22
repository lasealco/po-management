import { beforeEach, describe, expect, it, vi } from "vitest";

import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const listApiHubMappingTemplateAuditLogsPageMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({ getActorUserId: getActorUserIdMock }));
vi.mock("@/lib/apihub/mapping-templates-repo", () => ({
  listApiHubMappingTemplateAuditLogsPage: listApiHubMappingTemplateAuditLogsPageMock,
}));

describe("GET /api/apihub/mapping-templates/:templateId/audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
  });

  it("returns 400 for invalid page", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/mapping-templates/tpl-1/audit?page=0", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "mtpl-audit-bad-page" },
      }),
      { params: Promise.resolve({ templateId: "tpl-1" }) },
    );
    expect(response.status).toBe(400);
  });

  it("returns audit page", async () => {
    const createdAt = new Date("2026-04-22T09:00:00.000Z");
    listApiHubMappingTemplateAuditLogsPageMock.mockResolvedValue({
      items: [
        {
          id: "log-1",
          tenantId: "tenant-1",
          templateId: "tpl-1",
          actorUserId: "user-1",
          action: "apihub.mapping_template.updated",
          note: null,
          createdAt,
        },
      ],
      hasMore: false,
    });
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/mapping-templates/tpl-1/audit?limit=5", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "mtpl-audit-ok" },
      }),
      { params: Promise.resolve({ templateId: "tpl-1" }) },
    );
    expect(response.status).toBe(200);
    expect(listApiHubMappingTemplateAuditLogsPageMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      templateId: "tpl-1",
      limit: 5,
      offset: 0,
    });
    expect(await response.json()).toEqual({
      templateId: "tpl-1",
      page: 1,
      limit: 5,
      hasMore: false,
      audit: [
        {
          id: "log-1",
          templateId: "tpl-1",
          actorUserId: "user-1",
          action: "apihub.mapping_template.updated",
          note: null,
          createdAt: createdAt.toISOString(),
        },
      ],
    });
  });
});
