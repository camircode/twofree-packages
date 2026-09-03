import { describe, expect, it } from "vitest";

import {
  add,
  moneyFromDecimal,
  moneyFromDto,
  moneyToDto,
  multiply,
  parseDecimal,
  quantize,
  subtract,
} from "@/money.js";

describe("Money", () => {
  it("parses decimal strings without floating-point conversion", () => {
    expect(parseDecimal("123.4500")).toEqual({ coefficient: 1234500n, scale: 4 });
    expect(() => parseDecimal("1e3")).toThrow("decimal string");
  });

  it("round trips the canonical DTO exactly", () => {
    const money = moneyFromDecimal("MXN", "19.990", 3);

    expect(moneyFromDto(moneyToDto(money))).toEqual(money);
  });

  it("rejects arithmetic across currencies", () => {
    expect(() =>
      add(moneyFromDecimal("MXN", "1", 2), moneyFromDecimal("USD", "1", 2), 2, "DOWN"),
    ).toThrow("currency");
  });

  it("requires caller-selected scales and rounding modes", () => {
    const amount = moneyFromDecimal("MXN", "1.00", 2);
    const third = parseDecimal("0.333");

    expect(multiply(amount, third, 2, "HALF_UP")).toEqual({
      currency: "MXN",
      coefficient: 33n,
      scale: 2,
    });
    expect(multiply(amount, third, 2, "HALF_EVEN")).toEqual({
      currency: "MXN",
      coefficient: 33n,
      scale: 2,
    });
    expect(quantize(moneyFromDecimal("MXN", "2.5", 1), 0, "HALF_EVEN")).toEqual({
      currency: "MXN",
      coefficient: 2n,
      scale: 0,
    });
    expect(quantize(moneyFromDecimal("MXN", "2.5", 1), 0, "HALF_UP")).toEqual({
      currency: "MXN",
      coefficient: 3n,
      scale: 0,
    });
    expect(
      subtract(moneyFromDecimal("MXN", "5", 0), moneyFromDecimal("MXN", "1", 0), 0, "DOWN"),
    ).toEqual({
      currency: "MXN",
      coefficient: 4n,
      scale: 0,
    });
  });

  it("rejects implicit precision loss", () => {
    expect(() => moneyFromDecimal("MXN", "1.001", 2)).toThrow("quantize");
    expect(() => moneyFromDto({ currency: "MXN", coefficient: "10.5", scale: 2 })).toThrow(
      "integer",
    );
  });

  it("rejects numeric DTO coefficients before parsing", () => {
    expect(() =>
      moneyFromDto({ currency: "MXN", coefficient: 19990 as unknown as string, scale: 2 }),
    ).toThrow("integer string");
  });
});
