import { describe, expect, it } from "vitest";

import { decodeIngestionRunTimelineCursor, encodeIngestionRunTimelineCursor } from "./ingestion-run-timeline-cursor";

describe("ingestion run timeline cursor", () => {
  it("round-trips offset", () => {
    const c = encodeIngestionRunTimelineCursor(12);
    expect(decodeIngestionRunTimelineCursor(c)).toEqual({ ok: true, offset: 12 });
  });

  it("rejects invalid payloads", () => {
    expect(decodeIngestionRunTimelineCursor("")).toMatchObject({ ok: false });
    expect(decodeIngestionRunTimelineCursor("!!!")).toMatchObject({ ok: false });
    const negativeOffset = Buffer.from(JSON.stringify({ v: 1, o: -1 }), "utf8").toString("base64url");
    expect(decodeIngestionRunTimelineCursor(negativeOffset)).toMatchObject({ ok: false });
  });
});
