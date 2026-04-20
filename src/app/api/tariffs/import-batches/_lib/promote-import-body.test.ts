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
});
