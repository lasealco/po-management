import { beforeEach, describe, expect, it, vi } from "vitest";

import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({ getActorUserId: getActorUserIdMock }));

describe("POST /api/apihub/mapping-diff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
  });

  it("returns diff summary for two valid rule lists", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/mapping-diff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [APIHUB_REQUEST_ID_HEADER]: "map-diff-ok-1",
        },
        body: JSON.stringify({
          baselineRules: [{ sourcePath: "a", targetField: "x", transform: "trim" }],
          compareRules: [
            { sourcePath: "a", targetField: "x", transform: "trim" },
            { sourcePath: "n", targetField: "y", transform: "lower" },
          ],
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get(APIHUB_REQUEST_ID_HEADER)).toBe("map-diff-ok-1");
    const body = (await response.json()) as {
      diff: {
        summary: { added: number; removed: number; changed: number; unchanged: number };
        added: { targetField: string }[];
      };
    };
    expect(body.diff.summary).toEqual({ added: 1, removed: 0, changed: 0, unchanged: 1 });
    expect(body.diff.added[0]?.targetField).toBe("y");
  });

  it("returns 400 when baselineRules is not an array", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/mapping-diff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [APIHUB_REQUEST_ID_HEADER]: "map-diff-bad-1",
        },
        body: JSON.stringify({
          baselineRules: {},
          compareRules: [{ sourcePath: "a", targetField: "x" }],
        }),
      }),
    );
    expect(response.status).toBe(400);
  });
});
