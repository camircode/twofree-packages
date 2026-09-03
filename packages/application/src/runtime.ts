import type { Account, AccountType } from "@camircode/twofree-core/account.js";
import type { Money } from "@camircode/twofree-core/money.js";
import type { Transaction } from "@camircode/twofree-core/transaction.js";
import type {
  AccountInput,
  FinanceProviderFactory as DataProviderFactory,
  FinanceProviderLike,
  FinanceScope,
  ScopedFinanceProviderLike,
  TransactionInput,
} from "@camircode/twofree-data-provider/provider.js";
import { requireFinanceScope, ValidationError } from "@camircode/twofree-data-provider/provider.js";

import { mapAccount, mapTransaction, type AccountView, type TransactionView } from "./mapping.js";
import { createProductApplication, type ProductApplication } from "./product.js";

export interface AsyncFinanceProvider {
  createAccount(scope: FinanceScope, input: AccountInput): Promise<Account>;
  updateAccount(scope: FinanceScope, id: string, input: AccountInput): Promise<Account>;
  deleteAccount(scope: FinanceScope, id: string): Promise<void>;
  createTransaction(
    scope: FinanceScope,
    input: TransactionInput,
    idempotencyKey: string,
  ): Promise<Transaction>;
  updateTransaction(scope: FinanceScope, id: string, input: TransactionInput): Promise<Transaction>;
  deleteTransaction(scope: FinanceScope, id: string): Promise<void>;
  listAccounts(scope: FinanceScope): Promise<readonly Account[]>;
  listTransactions(scope: FinanceScope): Promise<readonly Transaction[]>;
  export(scope: FinanceScope): Promise<string>;
  import(scope: FinanceScope, serialized: string): Promise<void>;
  reset(scope: FinanceScope): Promise<void>;
}

export type FinanceProviderFactory =
  | DataProviderFactory
  | (() => FinanceProviderLike | ScopedFinanceProviderLike);

export function toAsyncFinanceProvider(provider: ScopedFinanceProviderLike): AsyncFinanceProvider {
  const asyncProvider: AsyncFinanceProvider = {
    async createAccount(scope, input) {
      return await provider.createAccount(scope, input);
    },
    async updateAccount(scope, id, input) {
      return await provider.updateAccount(scope, id, input);
    },
    async deleteAccount(scope, id) {
      await provider.deleteAccount(scope, id);
    },
    async createTransaction(scope, input, idempotencyKey) {
      return await provider.createTransaction(scope, input, idempotencyKey);
    },
    async updateTransaction(scope, id, input) {
      return await provider.updateTransaction(scope, id, input);
    },
    async deleteTransaction(scope, id) {
      await provider.deleteTransaction(scope, id);
    },
    async listAccounts(scope) {
      return await provider.listAccounts(scope);
    },
    async listTransactions(scope) {
      return await provider.listTransactions(scope);
    },
    async export(scope) {
      return await provider.export(scope);
    },
    async import(scope, serialized) {
      await provider.import(scope, serialized);
    },
    async reset(scope) {
      await provider.reset(scope);
    },
  };
  return asyncProvider;
}

export type RuntimeSnapshot = Readonly<{
  accounts: readonly AccountView[];
  transactions: readonly TransactionView[];
}>;

export type SeedResult = Readonly<{ seeded: boolean; snapshot: RuntimeSnapshot }>;

export interface RuntimeApplication extends ProductApplication {
  snapshot(scope?: FinanceScope): Promise<RuntimeSnapshot>;
  seed(scope?: FinanceScope): Promise<SeedResult>;
  reset(scope?: FinanceScope): Promise<RuntimeSnapshot>;
}

const seedMarker = "runnable-product-foundation";

export function createRuntimeApplication(factory: FinanceProviderFactory): RuntimeApplication {
  function bind(scope: FinanceScope | undefined): readonly [FinanceScope, AsyncFinanceProvider] {
    const owner = requireFinanceScope(scope);
    if (factory.length === 0) throw new ValidationError("finance boundary locked");
    const provider = toAsyncFinanceProvider((factory as DataProviderFactory)(owner));
    return [owner, provider];
  }

  async function snapshotFor(
    owner: FinanceScope,
    provider: AsyncFinanceProvider,
  ): Promise<RuntimeSnapshot> {
    const [accounts, transactions] = await Promise.all([
      provider.listAccounts(owner),
      provider.listTransactions(owner),
    ]);
    return Object.freeze({
      accounts: Object.freeze(accounts.map(mapAccount)),
      transactions: Object.freeze(transactions.map(mapTransaction)),
    });
  }

  async function use<T>(
    scope: FinanceScope | undefined,
    action: (product: ProductApplication, owner: FinanceScope) => Promise<T>,
  ): Promise<T> {
    const [owner, provider] = bind(scope);
    return action(createProductApplication(provider), owner);
  }

  return {
    listAccounts: (scope) => use(scope, (product, owner) => product.listAccounts(owner)),
    createAccount: (scopeOrInput, input) =>
      use(scopeOrInput as FinanceScope, (product, owner) => product.createAccount(owner, input)),
    updateAccount: (scope, id, input) =>
      use(scope, (product, owner) => product.updateAccount(owner, id, input)),
    deleteAccount: (scope, id) => use(scope, (product, owner) => product.deleteAccount(owner, id)),
    listTransactions: (scope) => use(scope, (product, owner) => product.listTransactions(owner)),
    createTransaction: (scopeOrInput, input, idempotencyKey) =>
      use(scopeOrInput as FinanceScope, (product, owner) =>
        product.createTransaction(owner, input, idempotencyKey),
      ),
    updateTransaction: (scope, id, input) =>
      use(scope, (product, owner) => product.updateTransaction(owner, id, input)),
    deleteTransaction: (scope, id) =>
      use(scope, (product, owner) => product.deleteTransaction(owner, id)),
    dashboard: (scope) => use(scope, (product, owner) => product.dashboard(owner)),
    export: (scope) => use(scope, (product, owner) => product.export(owner)),
    import: (scopeOrSerialized, serialized) =>
      use(scopeOrSerialized as FinanceScope, (product, owner) => product.import(owner, serialized)),
    async snapshot(scope) {
      const [owner, provider] = bind(scope);
      return await snapshotFor(owner, provider);
    },
    async seed(scope) {
      const [owner, provider] = bind(scope);
      const current = await snapshotFor(owner, provider);
      if (current.accounts.some((account) => account.metadata.seed === seedMarker)) {
        return { seeded: false, snapshot: current };
      }

      const account = await provider.createAccount(owner, {
        type: "debit" satisfies AccountType,
        label: "Demo daily spending",
        currency: "MXN",
        metadata: { seed: seedMarker, source: "demo" },
      });
      await provider.createTransaction(
        owner,
        {
          accountId: account.id,
          amount: { currency: "MXN", coefficient: 19990n, scale: 2 } satisfies Money,
          metadata: { seed: seedMarker, source: "demo", category: "groceries" },
        },
        `${seedMarker}-transaction`,
      );
      return { seeded: true, snapshot: await snapshotFor(owner, provider) };
    },
    async reset(scope) {
      const [owner, provider] = bind(scope);
      await provider.reset(owner);
      return snapshotFor(owner, provider);
    },
  };
}

export type { AccountInput, TransactionInput };
export type { FinanceScope } from "@camircode/twofree-data-provider/provider.js";
export type { AccountView, TransactionView } from "./mapping.js";
