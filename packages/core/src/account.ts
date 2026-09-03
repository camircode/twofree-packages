import { type Clock, type IdGenerator, nextIdentifier, nowIso } from "./identifiers.js";
import { type Money, subtract } from "./money.js";
import { assertPrivacySafeText, type Metadata, sanitizeMetadata } from "./privacy.js";
import { requireNonEmptyString, ValidationError } from "./validation.js";

export type AccountType = "debit" | "yield" | "revolving-credit" | "charge-card";
type AccountBase = Readonly<{
  id: string;
  label: string;
  currency: string;
  metadata: Metadata;
  createdAt: string;
}>;
export type DebitAccount = AccountBase & Readonly<{ type: "debit" }>;
export type YieldAccount = AccountBase & Readonly<{ type: "yield" }>;
export type RevolvingCreditAccount = AccountBase &
  Readonly<{ type: "revolving-credit"; statementBalance: Money }>;
export type ChargeCardAccount = AccountBase &
  Readonly<{ type: "charge-card"; statementBalance: Money }>;
export type Account = DebitAccount | YieldAccount | RevolvingCreditAccount | ChargeCardAccount;
export type CreditAccount = RevolvingCreditAccount | ChargeCardAccount;

export interface AccountDependencies {
  ids: IdGenerator;
  clock: Clock;
}

export type AccountInput = Readonly<{
  type: AccountType;
  label: string;
  currency: string;
  metadata?: Record<string, string>;
  statementBalance?: Money;
}>;

function accountValues(input: AccountInput): Omit<AccountBase, "id" | "createdAt"> {
  const label = requireNonEmptyString(input.label, "label");
  assertPrivacySafeText(label, "label");
  const currency = requireNonEmptyString(input.currency, "currency");
  assertPrivacySafeText(currency, "currency");
  return { label, currency, metadata: sanitizeMetadata(input.metadata) };
}

function baseAccount(input: AccountInput, dependencies: AccountDependencies): AccountBase {
  return Object.freeze({
    id: nextIdentifier(dependencies.ids),
    ...accountValues(input),
    createdAt: nowIso(dependencies.clock),
  });
}

export function createAccount(input: AccountInput, dependencies: AccountDependencies): Account {
  if (
    input.type !== "debit" &&
    input.type !== "yield" &&
    input.type !== "revolving-credit" &&
    input.type !== "charge-card"
  ) {
    throw new ValidationError("account type is invalid");
  }
  const base = baseAccount(input, dependencies);
  if (input.type === "debit" || input.type === "yield")
    return Object.freeze({ ...base, type: input.type });
  if (!input.statementBalance)
    throw new ValidationError("credit accounts require a statement balance");
  const statementBalance = Object.freeze({ ...input.statementBalance });
  if (statementBalance.currency !== base.currency)
    throw new ValidationError("statement balance currency must match account currency");
  return Object.freeze({ ...base, type: input.type, statementBalance });
}

export function updateAccount(account: Account, input: AccountInput): Account {
  const values = {
    ...accountValues(input),
    metadata: Object.freeze({ ...account.metadata, ...sanitizeMetadata(input.metadata) }),
  };
  if (input.type !== account.type) throw new ValidationError("account type cannot be changed");
  if (input.currency !== account.currency) {
    throw new ValidationError("account currency cannot be changed");
  }
  if (input.type === "debit" || input.type === "yield") {
    return Object.freeze({
      id: account.id,
      ...values,
      type: input.type,
      createdAt: account.createdAt,
    });
  }
  if (!input.statementBalance)
    throw new ValidationError("credit accounts require a statement balance");
  if (input.statementBalance.currency !== values.currency) {
    throw new ValidationError("statement balance currency must match account currency");
  }
  return Object.freeze({
    id: account.id,
    ...values,
    type: input.type,
    statementBalance: Object.freeze({ ...input.statementBalance }),
    createdAt: account.createdAt,
  });
}

export function applyStatementPayment(
  account: Account,
  payment: Money,
): Readonly<{ account: CreditAccount; remainingBalance: Money }> {
  if (account.type !== "revolving-credit" && account.type !== "charge-card") {
    throw new ValidationError("only credit accounts accept statement payments");
  }
  if (payment.currency !== account.currency)
    throw new ValidationError("payment currency must match account currency");
  if (payment.coefficient < 0n) throw new ValidationError("payment must not be negative");
  if (payment.scale > account.statementBalance.scale) {
    throw new ValidationError("payment must be quantized explicitly before statement evaluation");
  }
  const remaining = subtract(
    account.statementBalance,
    payment,
    account.statementBalance.scale,
    "DOWN",
  );
  if (remaining.coefficient < 0n)
    throw new ValidationError("payment cannot exceed statement balance");
  if (account.type === "charge-card" && remaining.coefficient !== 0n) {
    throw new ValidationError("charge-card payments must pay the full statement balance");
  }
  return Object.freeze({
    account: Object.freeze({ ...account, statementBalance: remaining }),
    remainingBalance: remaining,
  });
}
