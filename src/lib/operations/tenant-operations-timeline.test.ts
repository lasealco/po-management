import { describe, expect, it } from "vitest";

import {
  TIMELINE_SK_CT_AUDIT,
  clampTimelineLimit,
  decodeOperationsTimelineCursor,
  encodeOperationsTimelineCursor,
  mapRawTimelineRow,
  parseTimelineSourcesParam,
} from "./tenant-operations-timeline";

describe("tenant-operations-timeline", () => {
  it("clampTimelineLimit bounds", () => {
    expect(clampTimelineLimit(NaN)).toBe(40);
    expect(clampTimelineLimit(40)).toBe(40);
    expect(clampTimelineLimit(0)).toBe(1);
    expect(clampTimelineLimit(999)).toBe(100);
  });

  it("parseTimelineSourcesParam defaults and filters", () => {
    const all = parseTimelineSourcesParam(null);
    expect(all.size).toBe(3);
    expect(parseTimelineSourcesParam("ct_audit").has("ct_audit")).toBe(true);
    expect(parseTimelineSourcesParam("ct_audit").has("inventory_movement")).toBe(false);
    expect(parseTimelineSourcesParam("bogus").size).toBe(3);
  });

  it("roundtrips cursor", () => {
    const t = new Date("2026-04-29T12:00:00.000Z");
    const enc = encodeOperationsTimelineCursor({ t, sk: TIMELINE_SK_CT_AUDIT, id: "cuid1" });
    const dec = decodeOperationsTimelineCursor(enc);
    expect(dec.ok).toBe(true);
    if (!dec.ok) return;
    expect(dec.t.toISOString()).toBe(t.toISOString());
    expect(dec.sk).toBe(TIMELINE_SK_CT_AUDIT);
    expect(dec.id).toBe("cuid1");
  });

  it("rejects bad cursor", () => {
    expect(decodeOperationsTimelineCursor("").ok).toBe(false);
    expect(decodeOperationsTimelineCursor("!!!").ok).toBe(false);
  });

  it("mapRawTimelineRow drops unknown kind", () => {
    expect(
      mapRawTimelineRow({
        id: "x",
        sk: 1,
        t: new Date(),
        kind: "other",
        title: "t",
        detail: {},
      }),
    ).toBe(null);
  });

  it("mapRawTimelineRow maps audit row", () => {
    const d = new Date("2026-01-01T00:00:00.000Z");
    const row = mapRawTimelineRow({
      id: "a1",
      sk: 2,
      t: d,
      kind: "ct_audit",
      title: "outbound_mark_shipped",
      detail: { shipmentId: "s1" },
    });
    expect(row?.kind).toBe("ct_audit");
    expect(row?.title).toBe("outbound_mark_shipped");
    expect(row?.detail.shipmentId).toBe("s1");
  });
});
