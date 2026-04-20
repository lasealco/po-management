import { describe, expect, it } from "vitest";

import { parsePromoteImportRequestBody } from "@/app/api/tariffs/import-batches/_lib/promote-import-body";

describe("parsePromoteImportRequestBody", () => {
  it("accepts trimmed contractHeaderId", () => {
    expect(parsePromoteImportRequestBody({ contractHeaderId: "  hdr_1  " })).toEqual({
      ok: true,
      contractHeaderId: "hdr_1",
    });
  });

  it("rejects non-objects and missing id", () => {
    expect(parsePromoteImportRequestBody(null)).toEqual({
      ok: false,
      error: "Expected object body.",
    });
    expect(parsePromoteImportRequestBody({})).toEqual({
      ok: false,
      error: "contractHeaderId is required.",
    });
    expect(parsePromoteImportRequestBody({ contractHeaderId: 12 })).toEqual({
      ok: false,
      error: "contractHeaderId is required.",
    });
  });

  it("rejects whitespace-only contractHeaderId", () => {
    expect(parsePromoteImportRequestBody({ contractHeaderId: "   " })).toEqual({
      ok: false,
      error: "contractHeaderId is required.",
    });
    expect(parsePromoteImportRequestBody({ contractHeaderId: "\t\n" })).toEqual({
      ok: false,
      error: "contractHeaderId is required.",
    });
  });

  it("rejects array bodies as invalid payload shape", () => {
    expect(parsePromoteImportRequestBody([])).toEqual({
      ok: false,
      error: "Expected object body.",
    });
  });
});
