import { describe, expect, it } from "vitest";

import { mergeAssistSuggestedFilters, sanitizeAssistSuggestedFilters } from "./assist-sanitize";

/** Prisma-style cuid: length 20–32, starts with `c`. */
const VALID_CUID_20 = `c${"0".repeat(19)}`;

describe("sanitizeAssistSuggestedFilters", () => {
  it("returns empty object for non-objects", () => {
    expect(sanitizeAssistSuggestedFilters(null)).toEqual({});
    expect(sanitizeAssistSuggestedFilters("x")).toEqual({});
  });

  it("caps q and strips invalid modes/statuses", () => {
    const longQ = "a".repeat(300);
    const r = sanitizeAssistSuggestedFilters({
      q: `  ${longQ}  `,
      mode: "INVALID",
      status: "NOT_A_STATUS",
    });
    expect(r.q?.length).toBe(240);
    expect(r.mode).toBeUndefined();
    expect(r.status).toBeUndefined();
  });

  it("keeps valid mode, status, and onlyOverdueEta", () => {
    const r = sanitizeAssistSuggestedFilters({
      mode: "OCEAN",
      status: "IN_TRANSIT",
      onlyOverdueEta: true,
    });
    expect(r).toEqual({ mode: "OCEAN", status: "IN_TRANSIT", onlyOverdueEta: true });
  });

  it("ignores onlyOverdueEta unless strictly true", () => {
    expect(sanitizeAssistSuggestedFilters({ onlyOverdueEta: "true" as unknown as boolean })).toEqual({});
  });

  it("sanitizes lane length and port codes", () => {
    expect(
      sanitizeAssistSuggestedFilters({
        lane: "  de-ham  ",
        originCode: "deham",
        destinationCode: "ab",
      }),
    ).toEqual({ lane: "DEHAM", originCode: "DEHAM" });
  });

  it("accepts probable cuids for entity ids", () => {
    const r = sanitizeAssistSuggestedFilters({
      supplierId: `  ${VALID_CUID_20}  `,
      customerCrmAccountId: VALID_CUID_20,
      carrierSupplierId: VALID_CUID_20,
      dispatchOwnerUserId: VALID_CUID_20,
    });
    expect(r.supplierId).toBe(VALID_CUID_20);
    expect(r.customerCrmAccountId).toBe(VALID_CUID_20);
    expect(r.carrierSupplierId).toBe(VALID_CUID_20);
    expect(r.dispatchOwnerUserId).toBe(VALID_CUID_20);
  });

  it("rejects ids that do not look like cuids", () => {
    expect(sanitizeAssistSuggestedFilters({ supplierId: "short" }).supplierId).toBeUndefined();
  });

  it("accepts only known routeAction prefixes", () => {
    expect(sanitizeAssistSuggestedFilters({ routeAction: "Send booking" }).routeAction).toBe("Send booking");
    expect(sanitizeAssistSuggestedFilters({ routeAction: "Unknown" }).routeAction).toBeUndefined();
  });

  it("parses productTraceQ with allowed charset prefix", () => {
    expect(
      sanitizeAssistSuggestedFilters({ productTraceQ: "  SKU-1.0_extra stuff  " }).productTraceQ,
    ).toBe("SKU-1.0_extra");
  });

  it("sanitizes exceptionCode and alertType", () => {
    const r = sanitizeAssistSuggestedFilters({
      exceptionCode: "  ERR.code-1  ",
      alertType: "sla.breach",
    });
    expect(r.exceptionCode).toBe("ERR.code-1");
    expect(r.alertType).toBe("sla.breach");
  });

  it("maps shipmentSource aliases", () => {
    expect(sanitizeAssistSuggestedFilters({ shipmentSource: "  po  " }).shipmentSource).toBe("PO");
    expect(sanitizeAssistSuggestedFilters({ shipmentSource: "export" }).shipmentSource).toBe("UNLINKED");
    expect(sanitizeAssistSuggestedFilters({ shipmentSource: "unlinked" }).shipmentSource).toBe("UNLINKED");
  });
});

describe("mergeAssistSuggestedFilters", () => {
  it("merges patch over base and skips undefined patch keys", () => {
    const r = mergeAssistSuggestedFilters(
      { q: "a", onlyOverdueEta: true },
      { mode: "AIR", onlyOverdueEta: undefined },
    );
    expect(r.q).toBe("a");
    expect(r.mode).toBe("AIR");
    expect(r.onlyOverdueEta).toBe(true);
  });

  it("removes string keys when patch sets empty string", () => {
    const r = mergeAssistSuggestedFilters({ q: "x", mode: "OCEAN" }, { q: "  " });
    expect(r.q).toBeUndefined();
    expect(r.mode).toBe("OCEAN");
  });

  it("sets onlyOverdueEta true from patch", () => {
    const r = mergeAssistSuggestedFilters({}, { onlyOverdueEta: true });
    expect(r.onlyOverdueEta).toBe(true);
  });

  it("clears onlyOverdueEta when patch sets false", () => {
    const r = mergeAssistSuggestedFilters({ onlyOverdueEta: true }, { onlyOverdueEta: false });
    expect(r.onlyOverdueEta).toBeUndefined();
  });

  it("overwrites prior string fields from patch", () => {
    const r = mergeAssistSuggestedFilters(
      { q: "keep", mode: "OCEAN", status: "BOOKED" },
      { mode: "AIR", status: "IN_TRANSIT" },
    );
    expect(r).toEqual({ q: "keep", mode: "AIR", status: "IN_TRANSIT" });
  });
});
