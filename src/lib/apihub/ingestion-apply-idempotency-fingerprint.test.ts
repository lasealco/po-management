import { describe, expect, it } from "vitest";

import { computeIngestionApplyIdempotencyFingerprint } from "./ingestion-apply-idempotency-fingerprint";

const W = "create_only" as const;

describe("computeIngestionApplyIdempotencyFingerprint", () => {
  it("returns v1:marker when no downstream", () => {
    expect(computeIngestionApplyIdempotencyFingerprint({})).toBe("v1:marker");
    expect(computeIngestionApplyIdempotencyFingerprint({ downstream: undefined })).toBe("v1:marker");
  });

  it("differs for resultSummary vs explicit body rows", () => {
    const fromSummary = computeIngestionApplyIdempotencyFingerprint({
      downstream: { target: "sales_order", matchKey: "none", writeMode: W },
    });
    const fromBody = computeIngestionApplyIdempotencyFingerprint({
      downstream: {
        target: "sales_order",
        matchKey: "none",
        writeMode: W,
        bodyRows: [{ mappedRecord: { customerCrmAccountId: "a" } }],
      },
    });
    expect(fromSummary.startsWith("v1:ds:")).toBe(true);
    expect(fromBody.startsWith("v1:ds:")).toBe(true);
    expect(fromSummary).not.toEqual(fromBody);
  });

  it("differs when matchKey changes for same target", () => {
    const none = computeIngestionApplyIdempotencyFingerprint({
      downstream: { target: "purchase_order", matchKey: "none", writeMode: W },
    });
    const buyerRef = computeIngestionApplyIdempotencyFingerprint({
      downstream: {
        target: "purchase_order",
        matchKey: "purchase_order_buyer_reference",
        writeMode: W,
      },
    });
    expect(none.startsWith("v1:ds:")).toBe(true);
    expect(buyerRef.startsWith("v1:ds:")).toBe(true);
    expect(none).not.toEqual(buyerRef);
  });

  it("differs when writeMode changes", () => {
    const createOnly = computeIngestionApplyIdempotencyFingerprint({
      downstream: {
        target: "sales_order",
        matchKey: "sales_order_external_ref",
        writeMode: "create_only",
      },
    });
    const upsert = computeIngestionApplyIdempotencyFingerprint({
      downstream: {
        target: "sales_order",
        matchKey: "sales_order_external_ref",
        writeMode: "upsert",
      },
    });
    expect(createOnly).not.toEqual(upsert);
  });

  it("is stable under key reordering in mappedRecord", () => {
    const a = computeIngestionApplyIdempotencyFingerprint({
      downstream: {
        target: "purchase_order",
        matchKey: "none",
        writeMode: W,
        bodyRows: [{ mappedRecord: { z: 1, a: 2 } }],
      },
    });
    const b = computeIngestionApplyIdempotencyFingerprint({
      downstream: {
        target: "purchase_order",
        matchKey: "none",
        writeMode: W,
        bodyRows: [{ mappedRecord: { a: 2, z: 1 } }],
      },
    });
    expect(a).toEqual(b);
  });
});
