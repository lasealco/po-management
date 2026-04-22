import { beforeEach, describe, expect, it, vi } from "vitest";

import { encodeIngestionRunTimelineCursor } from "@/lib/apihub/ingestion-run-timeline-cursor";
import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const getTimelinePageMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({ getActorUserId: getActorUserIdMock, userHasGlobalGrant: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/apihub/ingestion-run-timeline-repo", () => ({
  getApiHubIngestionRunTimelinePage: getTimelinePageMock,
}));

describe("GET /api/apihub/ingestion-jobs/:jobId/timeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
  });

  it("returns 404 when run is missing", async () => {
    getTimelinePageMock.mockResolvedValue(null);
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/ingestion-jobs/missing/timeline", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "tl-404" },
      }),
      { params: Promise.resolve({ jobId: "missing" }) },
    );
    expect(response.status).toBe(404);
  });

  it("returns paged events and forwards limit and cursor offset", async () => {
    getTimelinePageMock.mockResolvedValue({
      items: [{ runId: "r1", attempt: 1, status: "queued", at: "2026-04-22T10:00:00.000Z" }],
      nextCursor: "next",
    });
    const { GET } = await import("./route");
    const cursor = encodeIngestionRunTimelineCursor(2);
    const response = await GET(
      new Request(`http://localhost/api/apihub/ingestion-jobs/r1/timeline?limit=5&cursor=${encodeURIComponent(cursor)}`, {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "tl-ok" },
      }),
      { params: Promise.resolve({ jobId: "r1" }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      events: [{ runId: "r1", attempt: 1, status: "queued", at: "2026-04-22T10:00:00.000Z" }],
      nextCursor: "next",
    });
    expect(getTimelinePageMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      runId: "r1",
      limit: 5,
      cursorOffset: 2,
    });
  });

  it("returns 400 for invalid cursor", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/ingestion-jobs/r1/timeline?cursor=not-base64", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "tl-bad-cursor" },
      }),
      { params: Promise.resolve({ jobId: "r1" }) },
    );
    expect(response.status).toBe(400);
    expect(getTimelinePageMock).not.toHaveBeenCalled();
  });
});
