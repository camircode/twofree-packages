import type { Account, AccountType } from "@camircode/twofree-core/account.js";
import type { IdGenerator, Clock } from "@camircode/twofree-core/identifiers.js";
import type { Money } from "@camircode/twofree-core/money.js";
import type { Transaction } from "@camircode/twofree-core/transaction.js";

import { ValidationError } from "@camircode/twofree-core/validation.js";

export { ValidationError } from "@camircode/twofree-core/validation.js";

export type AccountInput = Readonly<{
  type: AccountType;
  label: string;
  currency: string;
  metadata?: Record<string, string>;
  statementBalance?: Money;
}>;

export type TransactionInput = Readonly<{
  accountId: string;
  amount: Money;
  metadata?: Record<string, string>;
}>;

export type ProviderDependencies = Readonly<{ ids: IdGenerator; clock: Clock }>;

export type FinanceScope = Readonly<{ ownerId: string }>;

export function requireFinanceScope(value: unknown): FinanceScope {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("ownerId must be a non-empty string");
  }
  const ownerId = (value as { ownerId?: unknown }).ownerId;
  if (typeof ownerId !== "string" || ownerId.trim().length === 0) {
    throw new ValidationError("ownerId must be a non-empty string");
  }
  return Object.freeze({ ownerId });
}

export function requireIdempotencyKey(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 255 ||
    /\s/u.test(value) ||
    [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  ) {
    throw new ValidationError(
      "Idempotency-Key must be a non-empty value of at most 255 characters",
    );
  }
  return value;
}

export interface FinanceProvider {
  createAccount(scope: FinanceScope, input: AccountInput): Account;
  updateAccount(scope: FinanceScope, id: string, input: AccountInput): Account;
  deleteAccount(scope: FinanceScope, id: string): void;
  createTransaction(
    scope: FinanceScope,
    input: TransactionInput,
    idempotencyKey: string,
  ): Transaction;
  updateTransaction(scope: FinanceScope, id: string, input: TransactionInput): Transaction;
  deleteTransaction(scope: FinanceScope, id: string): void;
  listAccounts(scope: FinanceScope): readonly Account[];
  listTransactions(scope: FinanceScope): readonly Transaction[];
  export(scope: FinanceScope): string;
  import(scope: FinanceScope, serialized: string): void;
  reset(scope: FinanceScope): void;
}

export interface FinanceProviderLike {
  createAccount(input: AccountInput): Account | Promise<Account>;
  updateAccount(id: string, input: AccountInput): Account | Promise<Account>;
  deleteAccount(id: string): void | Promise<void>;
  createTransaction(
    input: TransactionInput,
    idempotencyKey: string,
  ): Transaction | Promise<Transaction>;
  updateTransaction(id: string, input: TransactionInput): Transaction | Promise<Transaction>;
  deleteTransaction(id: string): void | Promise<void>;
  listAccounts(): readonly Account[] | Promise<readonly Account[]>;
  listTransactions(): readonly Transaction[] | Promise<readonly Transaction[]>;
  export(): string | Promise<string>;
  import(serialized: string): void | Promise<void>;
  reset?(): void | Promise<void>;
}

export interface ScopedFinanceProviderLike {
  createAccount(scope: FinanceScope, input: AccountInput): Account | Promise<Account>;
  updateAccount(scope: FinanceScope, id: string, input: AccountInput): Account | Promise<Account>;
  deleteAccount(scope: FinanceScope, id: string): void | Promise<void>;
  createTransaction(
    scope: FinanceScope,
    input: TransactionInput,
    idempotencyKey: string,
  ): Transaction | Promise<Transaction>;
  updateTransaction(
    scope: FinanceScope,
    id: string,
    input: TransactionInput,
  ): Transaction | Promise<Transaction>;
  deleteTransaction(scope: FinanceScope, id: string): void | Promise<void>;
  listAccounts(scope: FinanceScope): readonly Account[] | Promise<readonly Account[]>;
  listTransactions(scope: FinanceScope): readonly Transaction[] | Promise<readonly Transaction[]>;
  export(scope: FinanceScope): string | Promise<string>;
  import(scope: FinanceScope, serialized: string): void | Promise<void>;
  reset(scope: FinanceScope): void | Promise<void>;
}

export type FinanceProviderFactory = (scope: FinanceScope) => ScopedFinanceProviderLike;

export type LegacyFinanceProviderLike = FinanceProviderLike;
