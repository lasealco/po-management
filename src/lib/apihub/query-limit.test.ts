import { describe, expect, it } from "vitest";

import {
  APIHUB_LIST_LIMIT_DEFAULT,
  APIHUB_LIST_LIMIT_MAX,
  parseApiHubListLimitFromUrl,
  parseApiHubListLimitQueryInput,
} from "./query-limit";

describe("parseApiHubListLimitQueryInput", () => {
  it("uses default when missing or blank", () => {
    expect(parseApiHubListLimitQueryInput(null)).toEqual({ ok: true, limit: APIHUB_LIST_LIMIT_DEFAULT });
    expect(parseApiHubListLimitQueryInput("")).toEqual({ ok: true, limit: APIHUB_LIST_LIMIT_DEFAULT });
    expect(parseApiHubListLimitQueryInput("   ")).toEqual({ ok: true, limit: APIHUB_LIST_LIMIT_DEFAULT });
  });

  it("clamps finite values to max", () => {
    expect(parseApiHubListLimitQueryInput("500")).toEqual({ ok: true, limit: APIHUB_LIST_LIMIT_MAX });
    expect(parseApiHubListLimitQueryInput("100")).toEqual({ ok: true, limit: 100 });
  });

  it("clamps finite values to min", () => {
    expect(parseApiHubListLimitQueryInput("0")).toEqual({ ok: true, limit: 1 });
    expect(parseApiHubListLimitQueryInput("-5")).toEqual({ ok: true, limit: 1 });
  });

  it("truncates decimals", () => {
    expect(parseApiHubListLimitQueryInput("5.9")).toEqual({ ok: true, limit: 5 });
  });

  it("rejects non-finite numbers when query value is present", () => {
    expect(parseApiHubListLimitQueryInput("NaN")).toEqual({ ok: false, raw: "NaN" });
    expect(parseApiHubListLimitQueryInput("Infinity")).toEqual({ ok: false, raw: "Infinity" });
    expect(parseApiHubListLimitQueryInput("abc")).toEqual({ ok: false, raw: "abc" });
  });
});

describe("parseApiHubListLimitFromUrl", () => {
  it("reads limit query", () => {
    const url = new URL("http://localhost/api?limit=7");
    expect(parseApiHubListLimitFromUrl(url)).toEqual({ ok: true, limit: 7 });
  });

  it("supports custom param name", () => {
    const url = new URL("http://localhost/api?pageSize=12");
    expect(parseApiHubListLimitFromUrl(url, "pageSize")).toEqual({ ok: true, limit: 12 });
  });
});
