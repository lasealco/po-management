import { describe, expect, it } from "vitest";

import {
  evaluateWmsReceiptQaSamplingBf80,
  shipmentItemDemandsQaSamplingBf80,
} from "./qa-sampling-receipt-bf80";

describe("shipmentItemDemandsQaSamplingBf80", () => {
  it("requires linked BF-42 template, non skip-lot, and pct > 0", () => {
    expect(
      shipmentItemDemandsQaSamplingBf80({
        wmsReceivingDispositionTemplateId: "tpl",
        wmsQaSamplingSkipLot: false,
        wmsQaSamplingPct: 5,
      }),
    ).toBe(true);
    expect(
      shipmentItemDemandsQaSamplingBf80({
        wmsReceivingDispositionTemplateId: null,
        wmsQaSamplingSkipLot: false,
        wmsQaSamplingPct: 5,
      }),
    ).toBe(false);
    expect(
      shipmentItemDemandsQaSamplingBf80({
        wmsReceivingDispositionTemplateId: "tpl",
        wmsQaSamplingSkipLot: true,
        wmsQaSamplingPct: 5,
      }),
    ).toBe(false);
    expect(
      shipmentItemDemandsQaSamplingBf80({
        wmsReceivingDispositionTemplateId: "tpl",
        wmsQaSamplingSkipLot: false,
        wmsQaSamplingPct: 0,
      }),
    ).toBe(false);
    expect(
      shipmentItemDemandsQaSamplingBf80({
        wmsReceivingDispositionTemplateId: "tpl",
        wmsQaSamplingSkipLot: false,
        wmsQaSamplingPct: null,
      }),
    ).toBe(false);
  });
});

describe("evaluateWmsReceiptQaSamplingBf80", () => {
  const demanding = {
    shipmentItemId: "si1",
    wmsReceivingDispositionTemplateId: "tpl",
    wmsQaSamplingSkipLot: false,
    wmsQaSamplingPct: 10,
    wmsVarianceNote: null as string | null,
  };

  it("passes when shipment variance note is present", () => {
    const r = evaluateWmsReceiptQaSamplingBf80({
      shipmentItems: [{ ...demanding, wmsVarianceNote: "QA OK — template applied" }],
      receiptLinesByShipmentItemId: new Map(),
    });
    expect(r.policyApplied).toBe(true);
    expect(r.complete).toBe(true);
    expect(r.incompleteShipmentItemIds).toEqual([]);
  });

  it("passes when dock receipt line variance note is present", () => {
    const r = evaluateWmsReceiptQaSamplingBf80({
      shipmentItems: [demanding],
      receiptLinesByShipmentItemId: new Map([
        ["si1", { shipmentItemId: "si1", wmsVarianceNote: "Sampled 10%" }],
      ]),
    });
    expect(r.complete).toBe(true);
  });

  it("fails when documentation missing", () => {
    const r = evaluateWmsReceiptQaSamplingBf80({
      shipmentItems: [demanding],
      receiptLinesByShipmentItemId: new Map(),
    });
    expect(r.complete).toBe(false);
    expect(r.incompleteShipmentItemIds).toEqual(["si1"]);
  });

  it("ignores non-demanding lines", () => {
    const r = evaluateWmsReceiptQaSamplingBf80({
      shipmentItems: [
        {
          shipmentItemId: "plain",
          wmsReceivingDispositionTemplateId: null,
          wmsQaSamplingSkipLot: false,
          wmsQaSamplingPct: null,
          wmsVarianceNote: null,
        },
      ],
      receiptLinesByShipmentItemId: new Map(),
    });
    expect(r.policyApplied).toBe(false);
    expect(r.complete).toBe(true);
  });
});
