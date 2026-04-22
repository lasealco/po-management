import { beforeEach, describe, expect, it, vi } from "vitest";

import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const listMock = vi.fn();
const createMock = vi.fn();
const processMock = vi.fn(() => Promise.resolve());

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({ getActorUserId: getActorUserIdMock }));
vi.mock("@/lib/apihub/mapping-analysis-jobs-repo", () => ({
  listApiHubMappingAnalysisJobs: listMock,
  createApiHubMappingAnalysisJob: createMock,
}));
vi.mock("@/lib/apihub/mapping-analysis-job-process", () => ({
  processApiHubMappingAnalysisJob: processMock,
}));
vi.mock("@/lib/apihub/mapping-analysis-job-dto", () => ({
  toApiHubMappingAnalysisJobDto: (row: { id: string }) => ({ id: `dto-${row.id}`, status: "queued" }),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (fn: () => void) => {
      fn();
    },
  };
});

describe("/api/apihub/mapping-analysis-jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
  });

  it("GET lists jobs", async () => {
    listMock.mockResolvedValue([{ id: "j1" }]);
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/apihub/mapping-analysis-jobs?limit=5", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "maj-list" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { jobs: { id: string }[] };
    expect(body.jobs[0]?.id).toBe("dto-j1");
    expect(listMock).toHaveBeenCalledWith({ tenantId: "tenant-1", limit: 5 });
  });

  it("POST creates job and schedules processing", async () => {
    createMock.mockResolvedValue({
      id: "job-new",
      tenantId: "tenant-1",
      requestedByUserId: "user-1",
      status: "queued",
      inputPayload: {},
      outputProposal: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      startedAt: null,
      finishedAt: null,
    });
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/apihub/mapping-analysis-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", [APIHUB_REQUEST_ID_HEADER]: "maj-post" },
        body: JSON.stringify({ records: [{ a: 1 }] }),
      }),
    );
    expect(res.status).toBe(201);
    expect(createMock).toHaveBeenCalled();
    expect(processMock).toHaveBeenCalledWith("job-new", "tenant-1");
  });

  it("POST returns 400 for invalid body", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/apihub/mapping-analysis-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: "nope" }),
      }),
    );
    expect(res.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });
});
