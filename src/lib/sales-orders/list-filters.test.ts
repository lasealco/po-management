import { describe, expect, it } from "vitest";

import {
  buildSalesOrdersListSearch,
  normalizeSalesOrderStatusFilter,
  parseSalesOrdersListQuery,
  parseSalesOrdersListQueryFromNext,
  salesOrdersListPrismaWhere,
  salesOrdersListQueryString,
} from "./list-filters";

describe("parseSalesOrdersListQuery", () => {
  it("reads status and q", () => {
    const sp = new URLSearchParams("status=OPEN&q=acme");
    expect(parseSalesOrdersListQuery(sp)).toEqual({ status: "OPEN", q: "acme" });
  });

  it("trims values", () => {
    const sp = new URLSearchParams("status=%20draft%20&q=%20so-%20");
    expect(parseSalesOrdersListQuery(sp)).toEqual({ status: "draft", q: "so-" });
  });
});

describe("parseSalesOrdersListQueryFromNext", () => {
  it("maps Next searchParams record", () => {
    expect(parseSalesOrdersListQueryFromNext({ status: "OPEN", q: "x" })).toEqual({ status: "OPEN", q: "x" });
    expect(parseSalesOrdersListQueryFromNext({ status: ["OPEN", "ignored"], q: "y" })).toEqual({
      status: "OPEN",
      q: "y",
    });
  });
});

describe("normalizeSalesOrderStatusFilter", () => {
  it("accepts known statuses case-insensitively", () => {
    expect(normalizeSalesOrderStatusFilter("draft")).toBe("DRAFT");
    expect(normalizeSalesOrderStatusFilter("OPEN")).toBe("OPEN");
    expect(normalizeSalesOrderStatusFilter(" closed ")).toBe("CLOSED");
  });

  it("returns null for empty or unknown", () => {
    expect(normalizeSalesOrderStatusFilter("")).toBeNull();
    expect(normalizeSalesOrderStatusFilter("  ")).toBeNull();
    expect(normalizeSalesOrderStatusFilter("PENDING")).toBeNull();
  });
});

describe("buildSalesOrdersListSearch", () => {
  it("sets non-empty keys and removes empty ones; preserves unrelated keys", () => {
    const base = new URLSearchParams("foo=bar");
    const out = buildSalesOrdersListSearch(base, { status: "OPEN", q: "" });
    const next = new URLSearchParams(out);
    expect(next.get("foo")).toBe("bar");
    expect(next.get("status")).toBe("OPEN");
    expect(next.has("q")).toBe(false);
  });

  it("clears q when patched to whitespace", () => {
    const base = new URLSearchParams("q=old");
    const out = buildSalesOrdersListSearch(base, { q: "   " });
    expect(new URLSearchParams(out).has("q")).toBe(false);
  });
});

describe("salesOrdersListPrismaWhere", () => {
  it("includes tenant and optional filters", () => {
    const w1 = salesOrdersListPrismaWhere("t1", { status: "", q: "" });
    expect(w1).toEqual({ tenantId: "t1" });

    const w2 = salesOrdersListPrismaWhere("t1", { status: "OPEN", q: "" });
    expect(w2).toEqual({ tenantId: "t1", status: "OPEN" });

    const w3 = salesOrdersListPrismaWhere("t1", { status: "", q: "ACME" });
    expect(w3.tenantId).toBe("t1");
    expect(w3.OR).toHaveLength(3);
  });

  it("ignores invalid status string", () => {
    const w = salesOrdersListPrismaWhere("t1", { status: "bogus", q: "x" });
    expect(w).not.toHaveProperty("status");
    expect(w.OR).toBeDefined();
  });
});

describe("salesOrdersListQueryString", () => {
  it("serializes only non-empty filters", () => {
    expect(salesOrdersListQueryString({ status: "DRAFT", q: "" })).toBe("status=DRAFT");
    expect(salesOrdersListQueryString({ status: "", q: "so" })).toBe("q=so");
    expect(salesOrdersListQueryString({ status: "", q: "" })).toBe("");
  });
});
