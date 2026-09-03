import { createAccount, updateAccount, type Account } from "@camircode/twofree-core/account.js";
import {
  createTransaction,
  updateTransaction,
  type Transaction,
} from "@camircode/twofree-core/transaction.js";
import { ValidationError } from "@camircode/twofree-core/validation.js";

import { exportV1, importV1 } from "./portability.js";
import { requireFinanceScope, requireIdempotencyKey } from "./provider.js";
import type {
  AccountInput,
  FinanceProvider,
  FinanceScope,
  ProviderDependencies,
  TransactionInput,
} from "./provider.js";

export type {
  FinanceProvider,
  FinanceProviderFactory,
  FinanceScope,
  ProviderDependencies,
} from "./provider.js";

type InMemoryState = {
  accounts: Map<string, readonly Account[]>;
  transactions: Map<string, readonly Transaction[]>;
  idempotencyKeys: Map<string, Map<string, Transaction>>;
};

function createScopedProvider(
  state: InMemoryState,
  dependencies: ProviderDependencies,
  boundScope: FinanceScope,
): FinanceProvider {
  const check = (scope: FinanceScope): string => {
    const requested = requireFinanceScope(scope);
    if (requested.ownerId !== boundScope.ownerId)
      throw new ValidationError("finance scope does not match provider owner");
    return requested.ownerId;
  };
  const accounts = (ownerId: string): readonly Account[] => state.accounts.get(ownerId) ?? [];
  const transactions = (ownerId: string): readonly Transaction[] =>
    state.transactions.get(ownerId) ?? [];
  return Object.freeze({
    createAccount(scope: FinanceScope, input: AccountInput): Account {
      const owner = check(scope);
      const created = createAccount(input, dependencies);
      state.accounts.set(owner, Object.freeze([...accounts(owner), created]));
      return created;
    },
    updateAccount(scope: FinanceScope, id: string, input: AccountInput): Account {
      const owner = check(scope);
      const current = accounts(owner).find((item) => item.id === id);
      if (!current) throw new ValidationError("account was not found");
      const updated = updateAccount(current, input);
      state.accounts.set(
        owner,
        Object.freeze(accounts(owner).map((item) => (item.id === id ? updated : item))),
      );
      return updated;
    },
    deleteAccount(scope: FinanceScope, id: string): void {
      const owner = check(scope);
      if (transactions(owner).some((item) => item.accountId === id)) {
        throw new ValidationError("delete associated transactions before deleting the account");
      }
      if (!accounts(owner).some((item) => item.id === id))
        throw new ValidationError("account was not found");
      state.accounts.set(owner, Object.freeze(accounts(owner).filter((item) => item.id !== id)));
    },
    createTransaction(
      scope: FinanceScope,
      input: TransactionInput,
      idempotencyKey: string,
    ): Transaction {
      const owner = check(scope);
      const key = requireIdempotencyKey(idempotencyKey);
      const idempotency = state.idempotencyKeys.get(owner) ?? new Map<string, Transaction>();
      state.idempotencyKeys.set(owner, idempotency);
      const existing = idempotency.get(key);
      if (existing) return existing;
      const account = accounts(owner).find((item) => item.id === input.accountId);
      if (!account) {
        throw new ValidationError("transaction references an unknown account");
      }
      if (input.amount.currency !== account.currency) {
        throw new ValidationError("transaction amount currency must match account currency");
      }
      const created = createTransaction(input, dependencies);
      state.transactions.set(owner, Object.freeze([...transactions(owner), created]));
      idempotency.set(key, created);
      return created;
    },
    updateTransaction(scope: FinanceScope, id: string, input: TransactionInput): Transaction {
      const owner = check(scope);
      const current = transactions(owner).find((item) => item.id === id);
      if (!current) throw new ValidationError("transaction was not found");
      const account = accounts(owner).find((item) => item.id === input.accountId);
      if (!account) throw new ValidationError("transaction references an unknown account");
      if (input.amount.currency !== account.currency) {
        throw new ValidationError("transaction amount currency must match account currency");
      }
      const updated = updateTransaction(current, input);
      state.transactions.set(
        owner,
        Object.freeze(transactions(owner).map((item) => (item.id === id ? updated : item))),
      );
      return updated;
    },
    deleteTransaction(scope: FinanceScope, id: string): void {
      const owner = check(scope);
      if (!transactions(owner).some((item) => item.id === id))
        throw new ValidationError("transaction was not found");
      state.transactions.set(
        owner,
        Object.freeze(transactions(owner).filter((item) => item.id !== id)),
      );
      const keys = state.idempotencyKeys.get(owner);
      for (const [key, transaction] of keys ?? []) if (transaction.id === id) keys?.delete(key);
    },
    listAccounts(scope: FinanceScope): readonly Account[] {
      return accounts(check(scope));
    },
    listTransactions(scope: FinanceScope): readonly Transaction[] {
      return transactions(check(scope));
    },
    export(scope: FinanceScope): string {
      const owner = check(scope);
      return exportV1(accounts(owner), transactions(owner));
    },
    import(scope: FinanceScope, serialized: string): void {
      const owner = check(scope);
      const imported = importV1(serialized);
      state.accounts.set(owner, imported.accounts);
      state.transactions.set(owner, imported.transactions);
      state.idempotencyKeys.delete(owner);
    },
    reset(scope: FinanceScope): void {
      const owner = check(scope);
      state.accounts.delete(owner);
      state.transactions.delete(owner);
      state.idempotencyKeys.delete(owner);
    },
  });
}

export function createInMemoryFinanceProviderFactory(
  dependencies: ProviderDependencies,
): (scope: FinanceScope) => FinanceProvider {
  const state: InMemoryState = {
    accounts: new Map(),
    transactions: new Map(),
    idempotencyKeys: new Map(),
  };

  return (scope: FinanceScope): FinanceProvider =>
    createScopedProvider(state, dependencies, requireFinanceScope(scope));
}
