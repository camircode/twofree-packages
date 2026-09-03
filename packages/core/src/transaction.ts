import { type Clock, type IdGenerator, nextIdentifier, nowIso } from "./identifiers.js";
import { type Money } from "./money.js";
import { type Metadata, sanitizeMetadata } from "./privacy.js";
import { requireNonEmptyString } from "./validation.js";

export type Transaction = Readonly<{
  id: string;
  accountId: string;
  amount: Money;
  metadata: Metadata;
  createdAt: string;
}>;
export type TransactionInput = Readonly<{
  accountId: string;
  amount: Money;
  metadata?: Record<string, string>;
}>;
export type TransactionDependencies = Readonly<{ ids: IdGenerator; clock: Clock }>;

export function createTransaction(
  input: TransactionInput,
  dependencies: TransactionDependencies,
): Transaction {
  return Object.freeze({
    id: nextIdentifier(dependencies.ids),
    accountId: requireNonEmptyString(input.accountId, "account identifier"),
    amount: Object.freeze({ ...input.amount }),
    metadata: sanitizeMetadata(input.metadata),
    createdAt: nowIso(dependencies.clock),
  });
}

export function updateTransaction(transaction: Transaction, input: TransactionInput): Transaction {
  return Object.freeze({
    id: transaction.id,
    accountId: requireNonEmptyString(input.accountId, "account identifier"),
    amount: Object.freeze({ ...input.amount }),
    metadata: Object.freeze({ ...transaction.metadata, ...sanitizeMetadata(input.metadata) }),
    createdAt: transaction.createdAt,
  });
}
