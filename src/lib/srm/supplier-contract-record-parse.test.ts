import { describe, expect, it } from "vitest";

import {
  parseContractRecordCreateBody,
  parseContractRecordPatchBody,
} from "./supplier-contract-record-parse";

describe("parseContractRecordCreateBody", () => {
  it("requires title", () => {
    expect(parseContractRecordCreateBody({ title: "  " }).ok).toBe(false);
  });

  it("rejects bad status", () => {
    const r = parseContractRecordCreateBody({ title: "MSA", status: "live" });
    expect(r.ok).toBe(false);
  });

  it("accepts minimal create", () => {
    const r = parseContractRecordCreateBody({ title: " Framework agreement " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.title).toBe("Framework agreement");
      expect(r.data.status).toBe("draft");
    }
  });
});

describe("parseContractRecordPatchBody", () => {
  it("rejects empty patch", () => {
    expect(parseContractRecordPatchBody({}).ok).toBe(false);
  });

  it("accepts status only", () => {
    const r = parseContractRecordPatchBody({ status: "active" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.status).toBe("active");
  });
});
