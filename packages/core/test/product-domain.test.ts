import { describe, expect, it } from "vitest";

import {
  assertCardProfile,
  assertNoPanLikeData,
  budgetStatus,
  calculateDailyYield,
  evaluateRules,
  splitExactly,
  type NotificationRule,
  type YieldAccountProfile,
} from "../src/product-domain.js";
import { moneyFromDecimal } from "../src/money.js";

describe("original finance domain", () => {
  it("calculates tiered daily yield exactly on a 365-day basis", () => {
    const profile = {
      id: "yield-1",
      accountId: "account-1",
      investmentCap: moneyFromDecimal("MXN", "10000", 2),
      belowCapAnnualPercent: "10",
      aboveCapAnnualPercent: "5",
      dayBasis: 365,
    } satisfies YieldAccountProfile;
    expect(calculateDailyYield(moneyFromDecimal("MXN", "15000", 2), profile)).toEqual({
      currency: "MXN",
      coefficient: 342n,
      scale: 2,
    });
  });

  it("distributes an indivisible exact amount deterministically", () => {
    expect(
      splitExactly(moneyFromDecimal("MXN", "1.00", 2), [
        { userId: "a", weight: "1" },
        { userId: "b", weight: "1" },
        { userId: "c", weight: "1" },
      ]).map((split) => split.amount.coefficient),
    ).toEqual([33n, 33n, 34n]);
  });

  it("keeps charge cards distinct from revolving credit", () => {
    expect(() =>
      assertCardProfile("charge-card", {
        fullStatementPaymentRequired: true,
        creditLimit: { currency: "MXN", coefficient: "1", scale: 0 },
      }),
    ).toThrow("must not contain creditLimit");
    expect(() =>
      assertCardProfile("credit-card", {
        creditLimit: { currency: "MXN", coefficient: "100", scale: 0 },
        creditUsed: { currency: "MXN", coefficient: "101", scale: 0 },
      }),
    ).toThrow("must not exceed");
  });

  it("evaluates arbitrary sources and comparators deterministically", () => {
    const rules: NotificationRule[] = [
      {
        id: "b",
        name: "Rendimiento bajo",
        source: "yield-account:principal",
        field: "annualPercent",
        comparator: "lt",
        threshold: "100",
        enabled: true,
      },
      {
        id: "a",
        name: "Budget",
        source: "budget:food",
        field: "percent",
        comparator: "gte",
        threshold: "80",
        condition: "budget",
        enabled: true,
      },
    ];
    expect(
      evaluateRules(
        rules,
        {
          "yield-account:principal": { annualPercent: "99.99" },
          "budget:food": { percent: "80" },
        },
        "2026-01-01T00:00:00.000Z",
      ).map((event) => event.ruleId),
    ).toEqual(["a", "b"]);
    expect(budgetStatus(moneyFromDecimal("MXN", "100", 0), moneyFromDecimal("MXN", "81", 0))).toBe(
      "risk",
    );
  });

  it("rejects PAN-like keys and values recursively", () => {
    expect(() => assertNoPanLikeData({ cardNumber: "anything" })).toThrow("prohibited PAN field");
    expect(() => assertNoPanLikeData({ reference: "4111 1111 1111 1111" })).toThrow("PAN data");
  });
});
