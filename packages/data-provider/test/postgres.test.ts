import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";

import { moneyFromDecimal } from "@camircode/twofree-core/money.js";
import { createPostgresFinanceProvider, migratePostgres } from "@/postgres-provider.js";

const databaseUrl = process.env.DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;

suite("PostgreSQL finance provider", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  let sequence = 0;

  beforeAll(async () => {
    await migratePostgres(pool);
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE transaction_idempotency, transactions, accounts");
    sequence = 0;
  });

  afterAll(async () => {
    await pool.end();
  });

  function provider() {
    return createPostgresFinanceProvider(pool, {
      ids: { next: () => `postgres-${++sequence}` },
      clock: { now: () => new Date("2026-01-01T00:00:00.000Z") },
    });
  }

  it("preserves exact money and rejects malformed, unsafe, and conflicting imports atomically", async () => {
    const target = provider();
    const account = await target.createAccount({
      type: "debit",
      label: "Daily spending",
      currency: "MXN",
      metadata: { source: "fixture" },
    });
    await target.createTransaction(
      {
        accountId: account.id,
        amount: moneyFromDecimal("MXN", "19.990", 3),
      },
      "initial-transaction",
    );
    const before = await target.export();

    const unsafe = JSON.stringify({
      version: 1,
      accounts: [
        {
          id: "unsafe-account",
          type: "debit",
          label: "Unsafe",
          currency: "MXN",
          metadata: { card: "4111-1111-1111-1111" },
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      transactions: [],
    });
    const conflicting = before;

    await expect(target.import("{")).rejects.toThrow("import must be valid JSON");
    await expect(target.import(unsafe)).rejects.toThrow();
    await expect(target.import(conflicting)).rejects.toThrow("import conflicts with existing data");

    expect(await target.export()).toBe(before);
  });

  it("returns the original transaction after a provider restart", async () => {
    const target = provider();
    const account = await target.createAccount({
      type: "debit",
      label: "Retry account",
      currency: "MXN",
    });
    const input = {
      accountId: account.id,
      amount: moneyFromDecimal("MXN", "19.99", 2),
    };

    const first = await target.createTransaction(input, "postgres-retry-1");
    const restarted = provider();
    const retry = await restarted.createTransaction(input, "postgres-retry-1");

    expect(retry).toEqual(first);
    expect(await restarted.listTransactions()).toHaveLength(1);
  });

  it("rejects a reused key for different account, amount, or metadata", async () => {
    const target = provider();
    const account = await target.createAccount({
      type: "debit",
      label: "Primary",
      currency: "MXN",
    });
    const otherAccount = await target.createAccount({
      type: "debit",
      label: "Other",
      currency: "MXN",
    });
    const input = {
      accountId: account.id,
      amount: moneyFromDecimal("MXN", "19.99", 2),
      metadata: { category: "groceries" },
    };

    for (const [key, change] of [
      ["different-account", { accountId: otherAccount.id }],
      ["different-amount", { amount: moneyFromDecimal("MXN", "20.00", 2) }],
      ["different-metadata", { metadata: { category: "rent" } }],
    ] as const) {
      await target.createTransaction(input, key);
      await expect(target.createTransaction({ ...input, ...change }, key)).rejects.toThrow(
        "idempotency key conflicts with a different transaction request",
      );
    }
    expect(await target.listTransactions()).toHaveLength(3);
  });
});
