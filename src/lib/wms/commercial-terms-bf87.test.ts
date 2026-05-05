import { describe, expect, it } from "vitest";

import {
  emptyCommercialTermsBf87V1,
  isCommercialTermsBf87DocEmpty,
  mergeOutboundCommercialTermsPatchBf87,
  parseWmsCommercialTermsBf87FromDb,
} from "./commercial-terms-bf87";

describe("commercial-terms-bf87", () => {
  it("parses bf87.v1 from DB JSON", () => {
    const d = parseWmsCommercialTermsBf87FromDb({
      schemaVersion: "bf87.v1",
      incoterm: " FOB ",
      paymentTermsDays: 45,
      paymentTermsLabel: " Net 45 ",
      billTo: { name: "Acme", countryCode: "de" },
    });
    expect(d?.schemaVersion).toBe("bf87.v1");
    expect(d?.incoterm).toBe("FOB");
    expect(d?.paymentTermsDays).toBe(45);
    expect(d?.paymentTermsLabel).toBe("Net 45");
    expect(d?.billTo?.name).toBe("Acme");
    expect(d?.billTo?.countryCode).toBe("de");
  });

  it("returns null for wrong schema version", () => {
    expect(
      parseWmsCommercialTermsBf87FromDb({ schemaVersion: "bf86.v1", incoterm: "FOB" }),
    ).toBeNull();
  });

  it("mergeOutboundCommercialTermsPatchBf87 replaces patched slices", () => {
    const existing = emptyCommercialTermsBf87V1();
    existing.incoterm = "EXW";
    existing.billTo = { name: "OldCo", line1: "1 Main" };
    const merged = mergeOutboundCommercialTermsPatchBf87(existing, {
      incoterm: "DAP",
      billToName: "NewCo",
    });
    expect(merged.incoterm).toBe("DAP");
    expect(merged.billTo?.name).toBe("NewCo");
    expect(merged.billTo?.line1).toBe("1 Main");
  });

  it("merge clears bill-to when every patched bill field empty", () => {
    const existing = emptyCommercialTermsBf87V1();
    existing.billTo = { name: "X" };
    const merged = mergeOutboundCommercialTermsPatchBf87(existing, {
      billToName: "",
      billToLine1: null,
      billToCity: null,
      billToRegion: null,
      billToPostalCode: null,
      billToCountryCode: null,
    });
    expect(merged.billTo).toBeNull();
  });

  it("isCommercialTermsBf87DocEmpty true when only schemaVersion remains", () => {
    expect(isCommercialTermsBf87DocEmpty(emptyCommercialTermsBf87V1())).toBe(true);
  });
});
