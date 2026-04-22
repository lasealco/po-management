import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  amountToMinor,
  convertAmount,
  minorToAmount,
  normalizeCurrency,
} from "./currency";

describe("normalizeCurrency", () => {
  it("trims and uppercases valid ISO codes", () => {
    expect(normalizeCurrency("  eur  ")).toBe("EUR");
  });

  it("returns fallback when empty or invalid", () => {
    expect(normalizeCurrency(null)).toBe("USD");
    expect(normalizeCurrency("EURO", "GBP")).toBe("GBP");
  });
});

describe("minorToAmount / amountToMinor", () => {
  it("round-trips cents", () => {
    expect(minorToAmount(BigInt(199))).toBe(1.99);
    expect(amountToMinor(1.99)).toBe(BigInt(199));
  });

  it("rounds amount to nearest cent for minor units", () => {
    expect(amountToMinor(10.99)).toBe(BigInt(1099));
    expect(amountToMinor(0.004)).toBe(BigInt(0));
  });
});

describe("convertAmount", () => {
  const d2024 = new Date("2024-01-15T00:00:00.000Z");

  it("returns same amount when currencies match", () => {
    const r = convertAmount({
      amount: 100,
      sourceCurrency: "usd",
      targetCurrency: "USD",
      rates: [],
    });
    expect(r).toEqual({ converted: 100, fxDate: null });
  });

  it("applies direct base→quote rate", () => {
    const r = convertAmount({
      amount: 100,
      sourceCurrency: "EUR",
      targetCurrency: "USD",
      rates: [{ baseCurrency: "EUR", quoteCurrency: "USD", rate: new Prisma.Decimal("1.1"), rateDate: d2024 }],
    });
    expect(r.converted).toBeCloseTo(110);
    expect(r.fxDate).toBe(d2024.toISOString());
  });

  it("applies inverse quote when only target→source exists", () => {
    const r = convertAmount({
      amount: 110,
      sourceCurrency: "USD",
      targetCurrency: "EUR",
      rates: [{ baseCurrency: "EUR", quoteCurrency: "USD", rate: new Prisma.Decimal("1.1"), rateDate: d2024 }],
    });
    expect(r.converted).toBeCloseTo(100);
    expect(r.fxDate).toBe(d2024.toISOString());
  });

  it("returns null when no path and currencies differ", () => {
    const r = convertAmount({
      amount: 50,
      sourceCurrency: "JPY",
      targetCurrency: "BRL",
      rates: [],
    });
    expect(r).toEqual({ converted: null, fxDate: null });
  });

  it("returns null when inverse rate is non-positive", () => {
    const r = convertAmount({
      amount: 10,
      sourceCurrency: "USD",
      targetCurrency: "EUR",
      rates: [{ baseCurrency: "EUR", quoteCurrency: "USD", rate: new Prisma.Decimal("0"), rateDate: d2024 }],
    });
    expect(r.converted).toBeNull();
  });
});
