import { describe, expect, it } from "vitest";

import {
  APIHUB_LIST_LIMIT_DEFAULT,
  APIHUB_LIST_LIMIT_MAX,
  parseApiHubListLimitFromUrl,
  parseApiHubListLimitParam,
} from "./query-limit";

describe("parseApiHubListLimitParam", () => {
  it("uses default when missing or blank", () => {
    expect(parseApiHubListLimitParam(null)).toBe(APIHUB_LIST_LIMIT_DEFAULT);
    expect(parseApiHubListLimitParam(undefined)).toBe(APIHUB_LIST_LIMIT_DEFAULT);
    expect(parseApiHubListLimitParam("")).toBe(APIHUB_LIST_LIMIT_DEFAULT);
    expect(parseApiHubListLimitParam("   ")).toBe(APIHUB_LIST_LIMIT_DEFAULT);
  });

  it("clamps to max", () => {
    expect(parseApiHubListLimitParam("500")).toBe(APIHUB_LIST_LIMIT_MAX);
    expect(parseApiHubListLimitParam("100")).toBe(100);
  });

  it("clamps to min", () => {
    expect(parseApiHubListLimitParam("0")).toBe(1);
    expect(parseApiHubListLimitParam("-5")).toBe(1);
  });

  it("truncates decimals", () => {
    expect(parseApiHubListLimitParam("5.9")).toBe(5);
  });

  it("falls back to default for non-finite numbers", () => {
    expect(parseApiHubListLimitParam("NaN")).toBe(APIHUB_LIST_LIMIT_DEFAULT);
    expect(parseApiHubListLimitParam("Infinity")).toBe(APIHUB_LIST_LIMIT_DEFAULT);
  });
});

describe("parseApiHubListLimitFromUrl", () => {
  it("reads limit query", () => {
    const url = new URL("http://localhost/api?limit=7");
    expect(parseApiHubListLimitFromUrl(url)).toBe(7);
  });

  it("supports custom param name", () => {
    const url = new URL("http://localhost/api?pageSize=12");
    expect(parseApiHubListLimitFromUrl(url, "pageSize")).toBe(12);
  });
});
