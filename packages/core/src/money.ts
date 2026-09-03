import { requireNonEmptyString, requireNonNegativeScale, ValidationError } from "./validation.js";
import { assertPrivacySafeText } from "./privacy.js";

export type RoundingMode = "HALF_EVEN" | "HALF_UP" | "DOWN";
export type Decimal = Readonly<{ coefficient: bigint; scale: number }>;
export type Money = Readonly<{ currency: string; coefficient: bigint; scale: number }>;
export type MoneyDto = { currency: string; coefficient: string; scale: number };

const decimalPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const integerPattern = /^-?(?:0|[1-9]\d*)$/;

function freezeDecimal(coefficient: bigint, scale: number): Decimal {
  return Object.freeze({ coefficient, scale: requireNonNegativeScale(scale) });
}

function freezeMoney(currency: string, coefficient: bigint, scale: number): Money {
  const safeCurrency = requireNonEmptyString(currency, "currency");
  assertPrivacySafeText(safeCurrency, "currency");
  return Object.freeze({
    currency: safeCurrency,
    coefficient,
    scale: requireNonNegativeScale(scale),
  });
}

function powerOfTen(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

function roundQuotient(coefficient: bigint, divisor: bigint, mode: RoundingMode): bigint {
  const quotient = coefficient / divisor;
  const remainder = coefficient % divisor;
  if (remainder === 0n || mode === "DOWN") return quotient;

  const absoluteRemainder = remainder < 0n ? -remainder : remainder;
  const comparison = absoluteRemainder * 2n - divisor;
  const increment = coefficient < 0n ? -1n : 1n;
  if (comparison > 0n || (comparison === 0n && (mode === "HALF_UP" || quotient % 2n !== 0n))) {
    return quotient + increment;
  }

  return quotient;
}

function quantizeDecimal(value: Decimal, scale: number, mode: RoundingMode): Decimal {
  requireNonNegativeScale(scale);
  if (value.scale === scale) return value;
  if (value.scale < scale)
    return freezeDecimal(value.coefficient * powerOfTen(scale - value.scale), scale);
  return freezeDecimal(
    roundQuotient(value.coefficient, powerOfTen(value.scale - scale), mode),
    scale,
  );
}

function alignedCoefficient(value: Decimal, scale: number): bigint {
  if (value.scale > scale)
    throw new ValidationError("value must be quantized explicitly before this operation");
  return value.coefficient * powerOfTen(scale - value.scale);
}

export function parseDecimal(value: string): Decimal {
  if (!decimalPattern.test(value)) throw new ValidationError("value must be a decimal string");
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction = ""] = unsigned.split(".");
  const coefficient = BigInt(`${negative ? "-" : ""}${whole}${fraction}`);
  return freezeDecimal(coefficient, fraction.length);
}

export function moneyFromDecimal(currency: string, value: string, scale: number): Money {
  const decimal = parseDecimal(value);
  requireNonNegativeScale(scale);
  if (decimal.scale > scale)
    throw new ValidationError("value has excess precision; call quantize explicitly");
  return freezeMoney(currency, alignedCoefficient(decimal, scale), scale);
}

export function moneyFromDto(dto: MoneyDto): Money {
  if (typeof dto.coefficient !== "string" || !integerPattern.test(dto.coefficient))
    throw new ValidationError("coefficient must be an integer string");
  return freezeMoney(dto.currency, BigInt(dto.coefficient), dto.scale);
}

export function moneyToDto(money: Money): MoneyDto {
  return {
    currency: money.currency,
    coefficient: money.coefficient.toString(),
    scale: money.scale,
  };
}

export function quantize(money: Money, scale: number, mode: RoundingMode): Money {
  const decimal = quantizeDecimal(money, scale, mode);
  return freezeMoney(money.currency, decimal.coefficient, decimal.scale);
}

function assertCurrency(left: Money, right: Money): void {
  if (left.currency !== right.currency) throw new ValidationError("currency mismatch");
}

export function add(left: Money, right: Money, scale: number, mode: RoundingMode): Money {
  assertCurrency(left, right);
  requireNonNegativeScale(scale);
  const intermediateScale = Math.max(left.scale, right.scale);
  const result = freezeDecimal(
    alignedCoefficient(left, intermediateScale) + alignedCoefficient(right, intermediateScale),
    intermediateScale,
  );
  const rounded = quantizeDecimal(result, scale, mode);
  return freezeMoney(left.currency, rounded.coefficient, rounded.scale);
}

export function subtract(left: Money, right: Money, scale: number, mode: RoundingMode): Money {
  assertCurrency(left, right);
  requireNonNegativeScale(scale);
  const intermediateScale = Math.max(left.scale, right.scale);
  const result = freezeDecimal(
    alignedCoefficient(left, intermediateScale) - alignedCoefficient(right, intermediateScale),
    intermediateScale,
  );
  const rounded = quantizeDecimal(result, scale, mode);
  return freezeMoney(left.currency, rounded.coefficient, rounded.scale);
}

export function multiply(money: Money, factor: Decimal, scale: number, mode: RoundingMode): Money {
  const result = freezeDecimal(money.coefficient * factor.coefficient, money.scale + factor.scale);
  const rounded = quantizeDecimal(result, scale, mode);
  return freezeMoney(money.currency, rounded.coefficient, rounded.scale);
}
