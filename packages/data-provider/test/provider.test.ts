import { describe, expect, it } from "vitest";

import { moneyFromDecimal } from "@camircode/twofree-core/money.js";
import {
  createInMemoryFinanceProviderFactory,
  type FinanceScope,
  type ProviderDependencies,
} from "@/in-memory-provider.js";
import { ValidationError, type AccountInput, type TransactionInput } from "@/provider.js";

const dependencies: ProviderDependencies = {
  ids: {
    next: (() => {
      let sequence = 0;
      return () => `id-${++sequence}`;
    })(),
  },
  clock: { now: () => new Date("2026-01-01T00:00:00.000Z") },
};
const owner = { ownerId: "provider-test-owner" } satisfies FinanceScope;

function provider() {
  const scoped = createInMemoryFinanceProviderFactory(dependencies)(owner);
  return {
    createAccount: (input: AccountInput) => scoped.createAccount(owner, input),
    updateAccount: (id: string, input: AccountInput) => scoped.updateAccount(owner, id, input),
    deleteAccount: (id: string) => scoped.deleteAccount(owner, id),
    createTransaction: (input: TransactionInput, key: string) =>
      scoped.createTransaction(owner, input, key),
    updateTransaction: (id: string, input: TransactionInput) =>
      scoped.updateTransaction(owner, id, input),
    deleteTransaction: (id: string) => scoped.deleteTransaction(owner, id),
    listAccounts: () => scoped.listAccounts(owner),
    listTransactions: () => scoped.listTransactions(owner),
    export: () => scoped.export(owner),
    import: (serialized: string) => scoped.import(owner, serialized),
  };
}

function populate(target: ReturnType<typeof provider>): void {
  const account = target.createAccount({
    type: "debit",
    label: "Daily spending",
    currency: "MXN",
    metadata: { institution: "Local credit union" },
  });
  target.createTransaction(
    {
      accountId: account.id,
      amount: moneyFromDecimal("MXN", "19.990", 3),
      metadata: { category: "groceries" },
    },
    "populate-transaction",
  );
}

describe("in-memory finance provider", () => {
  it("creates and reads sanitized entities entirely offline", () => {
    const target = provider();
    populate(target);

    expect(target.listAccounts()).toHaveLength(1);
    expect(target.listTransactions()).toMatchObject([
      { accountId: "id-1", amount: { currency: "MXN", coefficient: 19990n, scale: 3 } },
    ]);
  });

  it("rejects a transaction whose currency differs from its account", () => {
    const target = provider();
    const account = target.createAccount({
      type: "debit",
      label: "Daily spending",
      currency: "MXN",
    });

    expect(() =>
      target.createTransaction(
        {
          accountId: account.id,
          amount: moneyFromDecimal("USD", "19.99", 2),
        },
        "currency-mismatch",
      ),
    ).toThrow("transaction amount currency must match account currency");
    expect(target.listTransactions()).toHaveLength(0);
  });

  it("returns the original transaction for an idempotent retry", () => {
    const target = provider();
    const account = target.createAccount({
      type: "debit",
      label: "Daily spending",
      currency: "MXN",
    });
    const input = {
      accountId: account.id,
      amount: moneyFromDecimal("MXN", "19.99", 2),
    };

    const first = target.createTransaction(input, "web-retry-1");
    const retry = target.createTransaction(input, "web-retry-1");

    expect(retry).toEqual(first);
    expect(target.listTransactions()).toHaveLength(1);
  });

  it("updates records and protects accounts with associated transactions", () => {
    const target = provider();
    const account = target.createAccount({
      type: "debit",
      label: "Before",
      currency: "MXN",
    });
    const transaction = target.createTransaction(
      {
        accountId: account.id,
        amount: moneyFromDecimal("MXN", "10.00", 2),
        metadata: { description: "Before" },
      },
      "crud-transaction",
    );

    expect(
      target.updateAccount(account.id, { ...account, label: "After", metadata: {} }),
    ).toMatchObject({ id: account.id, label: "After", createdAt: account.createdAt });
    expect(
      target.updateTransaction(transaction.id, {
        accountId: account.id,
        amount: moneyFromDecimal("MXN", "12.50", 2),
        metadata: { description: "After" },
      }),
    ).toMatchObject({
      id: transaction.id,
      amount: { coefficient: 1250n, scale: 2 },
      metadata: { description: "After" },
    });
    expect(() => target.deleteAccount(account.id)).toThrow(
      "delete associated transactions before deleting the account",
    );
    target.deleteTransaction(transaction.id);
    expect(target.listTransactions()).toHaveLength(0);
    target.deleteAccount(account.id);
    expect(target.listAccounts()).toHaveLength(0);
  });

  it("preserves behavior through the provider replacement boundary", () => {
    const first = provider();
    const replacement = provider();
    populate(first);
    replacement.import(first.export());

    expect(replacement.export()).toBe(first.export());
  });

  it("exports a deterministic, ID-sorted v1 envelope with exact money", () => {
    const target = provider();
    populate(target);
    target.createAccount({ type: "yield", label: "Savings", currency: "MXN" });
    const exported = JSON.parse(target.export()) as {
      version: number;
      accounts: Array<{ id: string }>;
      transactions: Array<{ amount: { coefficient: string; scale: number } }>;
    };

    expect(exported.version).toBe(1);
    expect(exported.accounts.map((account) => account.id)).toEqual(
      [...exported.accounts.map((account) => account.id)].sort(),
    );
    expect(exported.transactions).toEqual([
      expect.objectContaining({ amount: { currency: "MXN", coefficient: "19990", scale: 3 } }),
    ]);
  });

  it.each([
    ["malformed", "{"],
    [
      "unsafe card data",
      JSON.stringify({
        version: 1,
        accounts: [
          {
            id: "account-unsafe",
            type: "debit",
            label: "Unsafe",
            currency: "MXN",
            metadata: { note: "4111-1111-1111-1111" },
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        transactions: [],
      }),
    ],
    [
      "dangling reference",
      JSON.stringify({
        version: 1,
        accounts: [],
        transactions: [
          {
            id: "transaction-1",
            accountId: "missing",
            amount: { currency: "MXN", coefficient: "1", scale: 0 },
            metadata: {},
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    ],
    [
      "numeric money coefficient",
      JSON.stringify({
        version: 1,
        accounts: [
          {
            id: "account-money",
            type: "debit",
            label: "Money",
            currency: "MXN",
            metadata: {},
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        transactions: [
          {
            id: "transaction-money",
            accountId: "account-money",
            amount: { currency: "MXN", coefficient: 19990, scale: 3 },
            metadata: {},
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    ],
    ["unsupported version", JSON.stringify({ version: 2, accounts: [], transactions: [] })],
  ])("rejects %s atomically", (_label, serialized) => {
    const target = provider();
    populate(target);
    const before = target.export();

    expect(() => target.import(serialized)).toThrow(ValidationError);
    expect(target.export()).toBe(before);
  });

  it("rejects an imported transaction with a different currency atomically", () => {
    const target = provider();
    populate(target);
    const before = target.export();
    const envelope = JSON.parse(before) as {
      transactions: Array<{ amount: { currency: string } }>;
    };
    envelope.transactions[0].amount.currency = "USD";

    expect(() => target.import(JSON.stringify(envelope))).toThrow(
      "transaction amount currency must match account currency",
    );
    expect(target.export()).toBe(before);
  });

  it.each(["account", "transaction"])(
    "rejects an imported %s identifier containing a card number atomically",
    (kind) => {
      const target = provider();
      populate(target);
      const before = target.export();
      const envelope = JSON.parse(before) as {
        accounts: Array<{ id: string }>;
        transactions: Array<{ id: string }>;
      };
      const cardNumber = "4111111111111111";
      if (kind === "account") envelope.accounts[0].id = cardNumber;
      else envelope.transactions[0].id = cardNumber;

      expect(() => target.import(JSON.stringify(envelope))).toThrow(ValidationError);
      expect(target.export()).toBe(before);
    },
  );

  it.each(["4111111111111111", "ending 1111"])(
    "rejects an imported account label containing a card number %# atomically",
    (label) => {
      const target = provider();
      populate(target);
      const before = target.export();
      const serialized = JSON.stringify({
        version: 1,
        accounts: [
          {
            id: "account-unsafe",
            type: "debit",
            label,
            currency: "MXN",
            metadata: {},
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        transactions: [],
      });

      expect(() => target.import(serialized)).toThrow(ValidationError);
      expect(target.export()).toBe(before);
    },
  );

  it("requires scope and isolates two owners through reset and export", () => {
    let sequence = 0;
    const factory = createInMemoryFinanceProviderFactory({
      ids: { next: () => `owner-${++sequence}` },
      clock: { now: () => new Date("2026-01-01T00:00:00.000Z") },
    });
    const aliceScope = { ownerId: "alice" } satisfies FinanceScope;
    const bobScope = { ownerId: "bob" } satisfies FinanceScope;
    expect(() => factory(undefined as unknown as FinanceScope)).toThrow("ownerId");
    const alice = factory(aliceScope);
    const bob = factory(bobScope);
    const aliceAccount = alice.createAccount(aliceScope, {
      type: "debit",
      label: "Alice",
      currency: "MXN",
    });
    const bobAccount = bob.createAccount(bobScope, {
      type: "debit",
      label: "Bob",
      currency: "MXN",
    });
    alice.createTransaction(
      aliceScope,
      { accountId: aliceAccount.id, amount: moneyFromDecimal("MXN", "1.00", 2) },
      "same-key",
    );
    bob.createTransaction(
      bobScope,
      { accountId: bobAccount.id, amount: moneyFromDecimal("MXN", "2.00", 2) },
      "same-key",
    );
    expect(
      [alice.listTransactions(aliceScope), bob.listTransactions(bobScope)].map(
        (items) => items.length,
      ),
    ).toEqual([1, 1]);
    expect(alice.export(aliceScope)).not.toContain("ownerId");
    bob.reset(bobScope);
    expect(bob.listAccounts(bobScope)).toHaveLength(0);
    expect(alice.listAccounts(aliceScope)).toHaveLength(1);
  });
});
