import Decimal from "decimal.js";

import { moneyFromDto, moneyToDto, type Money, type MoneyDto } from "./money.js";
import { ValidationError } from "./validation.js";

export type Comparator = "gt" | "gte" | "lt" | "lte" | "eq";
export type ProductKind =
  | "budget"
  | "savings-goal"
  | "shared-group"
  | "shared-expense"
  | "credit-card"
  | "charge-card"
  | "debit-profile"
  | "yield-account"
  | "notification-rule";

export type BudgetStatus = "on-track" | "risk" | "exceeded";
export type Budget = Readonly<{
  id: string;
  category: string;
  month: string;
  limit: Money;
  actual: Money;
  riskPercent: string;
  status: BudgetStatus;
  description?: string;
}>;
export type SavingsGoal = Readonly<{
  id: string;
  name: string;
  target: Money;
  saved: Money;
  targetDate?: string;
}>;
export type SharedMember = Readonly<{ userId: string; role: "owner" | "member" }>;
export type SharedGroup = Readonly<{ id: string; name: string; members: readonly SharedMember[] }>;
export type ExactSplit = Readonly<{ userId: string; amount: Money }>;
export type SharedExpense = Readonly<{
  id: string;
  groupId: string;
  paidByUserId: string;
  description: string;
  amount: Money;
  splits: readonly ExactSplit[];
}>;

type CardDates = Readonly<{ cutoffDay: number; dueDay: number }>;
export type CreditCardProfile = CardDates &
  Readonly<{
    id: string;
    accountId: string;
    kind: "credit-card";
    catAnnualPercent: string;
    annualFee: Money;
    minimumUseFee: Money;
    minimumUseThreshold: Money;
    minimumUsePeriod: "monthly" | "annual";
    annualInterestPercent: string;
    creditLimit: Money;
    creditUsed: Money;
    limitHistory: readonly Readonly<{ effectiveAt: string; limit: Money }>[];
    movements: readonly CardMovement[];
  }>;
export type ChargeCardProfile = CardDates &
  Readonly<{
    id: string;
    accountId: string;
    kind: "charge-card";
    annualFee: Money;
    fullStatementPaymentRequired: true;
    lateFee: Money;
    movements: readonly Exclude<CardMovement, { type: "cash-advance" }>[];
  }>;
export type CardMovement = Readonly<{
  id: string;
  type: "purchase" | "payment" | "cash-advance" | "transfer";
  amount: Money;
  occurredAt: string;
  description?: string;
}>;
export type DebitProfile = Readonly<{
  id: string;
  accountId: string;
  freeTransferCount: number;
  freeTransferAmount: Money;
  excessTransferFee: Money;
}>;
export type YieldAccountProfile = Readonly<{
  id: string;
  accountId: string;
  investmentCap: Money;
  belowCapAnnualPercent: string;
  aboveCapAnnualPercent: string;
  dayBasis: 360 | 365;
}>;
export type NotificationRule = Readonly<{
  id: string;
  name: string;
  source: string;
  field: string;
  comparator: Comparator;
  threshold: string;
  condition?: "payment-due" | "cutoff" | "budget" | "card" | "yield";
  enabled: boolean;
}>;
export type NotificationEvent = Readonly<{
  ruleId: string;
  source: string;
  field: string;
  observed: string;
  threshold: string;
  occurredAt: string;
}>;

const panKey =
  /(?:^|[_-])(pan|card_?number|card_?no|last_?(?:4|four)|card_?(?:suffix|ending)|cvv|cvc|pin)(?:$|[_-])/iu;
const panValue = /(?<!\d)(?:\d[\s-]*){13,19}(?!\d)/u;

export function assertNoPanLikeData(value: unknown, field = "input"): void {
  if (typeof value === "string") {
    if (panValue.test(value)) throw new ValidationError(`${field} must not contain PAN data`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoPanLikeData(entry, `${field}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (panKey.test(key)) throw new ValidationError(`${field} contains a prohibited PAN field`);
      assertNoPanLikeData(entry, `${field}.${key}`);
    }
  }
}

function assertSameCurrency(left: Money, right: Money): void {
  if (left.currency !== right.currency) throw new ValidationError("currency mismatch");
}

function aligned(value: Money, scale: number): bigint {
  if (value.scale > scale) throw new ValidationError("money must be explicitly quantized");
  return value.coefficient * 10n ** BigInt(scale - value.scale);
}

export function budgetStatus(limit: Money, actual: Money, riskPercent = "80"): BudgetStatus {
  assertSameCurrency(limit, actual);
  const risk = new Decimal(riskPercent);
  if (!risk.isFinite() || risk.lt(0) || risk.gt(100))
    throw new ValidationError("riskPercent is invalid");
  const scale = Math.max(limit.scale, actual.scale);
  const maximum = aligned(limit, scale);
  const used = aligned(actual, scale);
  if (used > maximum) return "exceeded";
  const riskBoundary = new Decimal(maximum.toString()).mul(risk).div(100).floor();
  return new Decimal(used.toString()).gte(riskBoundary) ? "risk" : "on-track";
}

export function splitExactly(
  amount: Money,
  shares: readonly Readonly<{ userId: string; weight: string }>[],
): readonly ExactSplit[] {
  if (amount.coefficient < 0n) throw new ValidationError("shared expense must not be negative");
  if (shares.length === 0) throw new ValidationError("shared expense requires splits");
  const weights = shares.map(({ weight }) => new Decimal(weight));
  if (weights.some((weight) => !weight.isInteger() || weight.lte(0)))
    throw new ValidationError("split weights must be positive integers");
  const total = weights.reduce((sum, weight) => sum.plus(weight), new Decimal(0));
  let assigned = 0n;
  return Object.freeze(
    shares.map((share, index) => {
      const coefficient =
        index === shares.length - 1
          ? amount.coefficient - assigned
          : BigInt(
              new Decimal(amount.coefficient.toString())
                .mul(weights[index]!)
                .div(total)
                .floor()
                .toFixed(0),
            );
      assigned += coefficient;
      return Object.freeze({
        userId: share.userId,
        amount: Object.freeze({ ...amount, coefficient }),
      });
    }),
  );
}

export function calculateDailyYield(balance: Money, profile: YieldAccountProfile): Money {
  assertSameCurrency(balance, profile.investmentCap);
  if (balance.coefficient < 0n) throw new ValidationError("yield balance must not be negative");
  const scale = Math.max(balance.scale, profile.investmentCap.scale);
  const balanceCoefficient = aligned(balance, scale);
  const capCoefficient = aligned(profile.investmentCap, scale);
  const below = balanceCoefficient < capCoefficient ? balanceCoefficient : capCoefficient;
  const above = balanceCoefficient - below;
  const daily = new Decimal(below.toString())
    .mul(profile.belowCapAnnualPercent)
    .plus(new Decimal(above.toString()).mul(profile.aboveCapAnnualPercent))
    .div(100)
    .div(profile.dayBasis)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN);
  return Object.freeze({
    currency: balance.currency,
    coefficient: BigInt(daily.toFixed(0)),
    scale,
  });
}

export function assertCardProfile(
  kind: "credit-card" | "charge-card",
  input: Readonly<Record<string, unknown>>,
): void {
  if (kind === "charge-card") {
    for (const field of [
      "catAnnualPercent",
      "annualInterestPercent",
      "creditLimit",
      "creditUsed",
      "minimumUseFee",
      "minimumUseThreshold",
    ]) {
      if (field in input) throw new ValidationError(`charge cards must not contain ${field}`);
    }
    if (input.fullStatementPaymentRequired !== true)
      throw new ValidationError("charge cards require full statement payment");
    if (
      Array.isArray(input.movements) &&
      input.movements.some(
        (movement) =>
          movement &&
          typeof movement === "object" &&
          (movement as { type?: unknown }).type === "cash-advance",
      )
    ) {
      throw new ValidationError("charge cards do not support cash advances");
    }
    return;
  }
  const limit = moneyFromDto(input.creditLimit as MoneyDto);
  const used = moneyFromDto(input.creditUsed as MoneyDto);
  assertSameCurrency(limit, used);
  const scale = Math.max(limit.scale, used.scale);
  if (aligned(used, scale) > aligned(limit, scale))
    throw new ValidationError("credit usage must not exceed the credit limit");
}

export function evaluateRules(
  rules: readonly NotificationRule[],
  observations: Readonly<Record<string, Readonly<Record<string, string>>>>,
  occurredAt: string,
): readonly NotificationEvent[] {
  const compare = (left: Decimal, operator: Comparator, right: Decimal): boolean =>
    ({
      gt: left.gt(right),
      gte: left.gte(right),
      lt: left.lt(right),
      lte: left.lte(right),
      eq: left.eq(right),
    })[operator];
  return Object.freeze(
    rules
      .filter((rule) => rule.enabled)
      .flatMap((rule) => {
        const observed = observations[rule.source]?.[rule.field];
        if (observed === undefined) return [];
        const left = new Decimal(observed);
        const right = new Decimal(rule.threshold);
        if (!left.isFinite() || !right.isFinite() || !compare(left, rule.comparator, right))
          return [];
        return [
          Object.freeze({
            ruleId: rule.id,
            source: rule.source,
            field: rule.field,
            observed,
            threshold: rule.threshold,
            occurredAt,
          }),
        ];
      })
      .sort((left, right) => left.ruleId.localeCompare(right.ruleId)),
  );
}

export function moneyDto(value: Money): MoneyDto {
  return moneyToDto(value);
}
export function domainMoney(value: MoneyDto): Money {
  return moneyFromDto(value);
}
