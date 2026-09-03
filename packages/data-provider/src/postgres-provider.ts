import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import type { Pool, PoolClient, QueryResultRow } from "pg";

import { createAccount, updateAccount, type Account } from "@camircode/twofree-core/account.js";
import { moneyToDto } from "@camircode/twofree-core/money.js";
import { sanitizeMetadata } from "@camircode/twofree-core/privacy.js";
import {
  createTransaction,
  updateTransaction,
  type Transaction,
} from "@camircode/twofree-core/transaction.js";
import { ValidationError } from "@camircode/twofree-core/validation.js";

import { exportV1, importV1 } from "./portability.js";
import { requireIdempotencyKey } from "./provider.js";
import type {
  AccountInput,
  FinanceProviderLike,
  ProviderDependencies,
  TransactionInput,
} from "./provider.js";

type AccountRow = QueryResultRow & {
  id: string;
  type: Account["type"];
  label: string;
  currency: string;
  metadata: Record<string, string>;
  created_at: string;
  statement_balance_coefficient: string | null;
  statement_balance_scale: number | null;
};

type TransactionRow = QueryResultRow & {
  id: string;
  account_id: string;
  amount_coefficient: string;
  amount_scale: number;
  amount_currency: string;
  metadata: Record<string, string>;
  created_at: string;
};

const migrationUrls = [
  new URL("./migrations/001_initial.sql", import.meta.url),
  new URL("./migrations/002_transaction_idempotency.sql", import.meta.url),
];

function defaultDependencies(): ProviderDependencies {
  return {
    ids: { next: () => randomUUID() },
    clock: { now: () => new Date() },
  };
}

function accountDto(row: AccountRow) {
  const base = {
    id: row.id,
    type: row.type,
    label: row.label,
    currency: row.currency,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
  return row.statement_balance_coefficient === null
    ? base
    : {
        ...base,
        statementBalance: {
          currency: row.currency,
          coefficient: row.statement_balance_coefficient,
          scale: row.statement_balance_scale,
        },
      };
}

function transactionDto(row: TransactionRow) {
  return {
    id: row.id,
    accountId: row.account_id,
    amount: {
      currency: row.amount_currency,
      coefficient: row.amount_coefficient,
      scale: row.amount_scale,
    },
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

function stateFromRows(accounts: AccountRow[], transactions: TransactionRow[]) {
  return importV1(
    JSON.stringify({
      version: 1,
      accounts: accounts.map(accountDto),
      transactions: transactions.map(transactionDto),
    }),
  );
}

async function transactionForId(client: PoolClient, id: string | undefined): Promise<Transaction> {
  if (!id) throw new ValidationError("idempotency key references a missing transaction");
  const transaction = await client.query<TransactionRow>(
    `SELECT id, account_id, amount_coefficient, amount_scale, amount_currency,
            metadata, created_at
       FROM transactions
      WHERE id = $1`,
    [id],
  );
  if (transaction.rowCount === 0)
    throw new ValidationError("idempotency key references a missing transaction");
  const account = await client.query<AccountRow>(
    `SELECT id, type, label, currency, metadata, created_at,
            statement_balance_coefficient, statement_balance_scale
       FROM accounts
      WHERE id = $1`,
    [transaction.rows[0]?.account_id],
  );
  if (account.rowCount === 0)
    throw new ValidationError("transaction references an unknown account");
  const restored = stateFromRows(account.rows, transaction.rows).transactions[0];
  if (!restored) throw new ValidationError("idempotency key references a missing transaction");
  return restored;
}

async function readRows(pool: Pool): Promise<{
  accounts: AccountRow[];
  transactions: TransactionRow[];
}> {
  const [accounts, transactions] = await Promise.all([
    pool.query<AccountRow>(
      `SELECT id, type, label, currency, metadata, created_at,
              statement_balance_coefficient, statement_balance_scale
         FROM accounts
        ORDER BY id`,
    ),
    pool.query<TransactionRow>(
      `SELECT id, account_id, amount_coefficient, amount_scale, amount_currency,
              metadata, created_at
         FROM transactions
        ORDER BY id`,
    ),
  ]);
  return { accounts: accounts.rows, transactions: transactions.rows };
}

async function rollback(client: PoolClient): Promise<never> {
  await client.query("ROLLBACK").catch(() => undefined);
  throw new ValidationError("import conflicts with existing data");
}

function sameMetadata(
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, string>>,
): boolean {
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key]);
}

export async function migratePostgres(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         version INTEGER PRIMARY KEY,
         applied_at TEXT NOT NULL
       )`,
    );
    for (const [index, migrationUrl] of migrationUrls.entries()) {
      const version = index + 1;
      const applied = await client.query<{ version: number }>(
        "SELECT version FROM schema_migrations WHERE version = $1",
        [version],
      );
      if (applied.rowCount === 0) {
        await client.query(await readFile(migrationUrl, "utf8"));
        await client.query("INSERT INTO schema_migrations (version, applied_at) VALUES ($1, $2)", [
          version,
          new Date().toISOString(),
        ]);
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function createPostgresFinanceProvider(
  pool: Pool,
  dependencies: ProviderDependencies = defaultDependencies(),
): FinanceProviderLike {
  return Object.freeze({
    async createAccount(input: AccountInput): Promise<Account> {
      const account = createAccount(input, dependencies);
      await pool.query(
        `INSERT INTO accounts (
           id, type, label, currency, metadata, created_at,
           statement_balance_coefficient, statement_balance_scale
         ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
        [
          account.id,
          account.type,
          account.label,
          account.currency,
          JSON.stringify(account.metadata),
          account.createdAt,
          account.type === "revolving-credit" || account.type === "charge-card"
            ? account.statementBalance.coefficient.toString()
            : null,
          account.type === "revolving-credit" || account.type === "charge-card"
            ? account.statementBalance.scale
            : null,
        ],
      );
      return account;
    },

    async updateAccount(id: string, input: AccountInput): Promise<Account> {
      const result = await pool.query<AccountRow>(
        `SELECT id, type, label, currency, metadata, created_at,
                statement_balance_coefficient, statement_balance_scale
           FROM accounts WHERE id = $1`,
        [id],
      );
      const current = stateFromRows(result.rows, []).accounts[0];
      if (!current) throw new ValidationError("account was not found");
      const account = updateAccount(current, input);
      await pool.query(
        `UPDATE accounts SET label = $2, metadata = $3::jsonb,
          statement_balance_coefficient = $4, statement_balance_scale = $5 WHERE id = $1`,
        [
          id,
          account.label,
          JSON.stringify(account.metadata),
          account.type === "revolving-credit" || account.type === "charge-card"
            ? account.statementBalance.coefficient.toString()
            : null,
          account.type === "revolving-credit" || account.type === "charge-card"
            ? account.statementBalance.scale
            : null,
        ],
      );
      return account;
    },

    async deleteAccount(id: string): Promise<void> {
      const related = await pool.query("SELECT 1 FROM transactions WHERE account_id = $1 LIMIT 1", [
        id,
      ]);
      if ((related.rowCount ?? 0) > 0) {
        throw new ValidationError("delete associated transactions before deleting the account");
      }
      const result = await pool.query("DELETE FROM accounts WHERE id = $1", [id]);
      if (result.rowCount === 0) throw new ValidationError("account was not found");
    },

    async createTransaction(input: TransactionInput, idempotencyKey: string): Promise<Transaction> {
      const key = requireIdempotencyKey(idempotencyKey);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [key]);
        const existing = await client.query<{ transaction_id: string }>(
          "SELECT transaction_id FROM transaction_idempotency WHERE idempotency_key = $1",
          [key],
        );
        if (existing.rowCount !== 0) {
          const transaction = await transactionForId(client, existing.rows[0]?.transaction_id);
          const metadata = sanitizeMetadata(input.metadata);
          if (
            transaction.accountId !== input.accountId ||
            transaction.amount.currency !== input.amount.currency ||
            transaction.amount.coefficient !== input.amount.coefficient ||
            transaction.amount.scale !== input.amount.scale ||
            !sameMetadata(transaction.metadata, metadata)
          ) {
            throw new ValidationError(
              "idempotency key conflicts with a different transaction request",
            );
          }
          await client.query("COMMIT");
          return transaction;
        }

        const account = await client.query<{ currency: string }>(
          "SELECT currency FROM accounts WHERE id = $1",
          [input.accountId],
        );
        if (account.rowCount === 0)
          throw new ValidationError("transaction references an unknown account");
        if (account.rows[0]?.currency !== input.amount.currency) {
          throw new ValidationError("transaction amount currency must match account currency");
        }
        const transaction = createTransaction(input, dependencies);
        await client.query(
          `INSERT INTO transactions (
             id, account_id, amount_coefficient, amount_scale, amount_currency, metadata, created_at
           ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
          [
            transaction.id,
            transaction.accountId,
            transaction.amount.coefficient.toString(),
            transaction.amount.scale,
            transaction.amount.currency,
            JSON.stringify(transaction.metadata),
            transaction.createdAt,
          ],
        );
        await client.query(
          "INSERT INTO transaction_idempotency (idempotency_key, transaction_id) VALUES ($1, $2)",
          [key, transaction.id],
        );
        await client.query("COMMIT");
        return transaction;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },

    async updateTransaction(id: string, input: TransactionInput): Promise<Transaction> {
      const rows = await readRows(pool);
      const current = stateFromRows(rows.accounts, rows.transactions).transactions.find(
        (item) => item.id === id,
      );
      if (!current) throw new ValidationError("transaction was not found");
      const account = stateFromRows(rows.accounts, []).accounts.find(
        (item) => item.id === input.accountId,
      );
      if (!account) throw new ValidationError("transaction references an unknown account");
      if (account.currency !== input.amount.currency) {
        throw new ValidationError("transaction amount currency must match account currency");
      }
      const transaction = updateTransaction(current, input);
      await pool.query(
        `UPDATE transactions SET account_id = $2, amount_coefficient = $3,
          amount_scale = $4, amount_currency = $5, metadata = $6::jsonb WHERE id = $1`,
        [
          id,
          transaction.accountId,
          transaction.amount.coefficient.toString(),
          transaction.amount.scale,
          transaction.amount.currency,
          JSON.stringify(transaction.metadata),
        ],
      );
      return transaction;
    },

    async deleteTransaction(id: string): Promise<void> {
      const result = await pool.query("DELETE FROM transactions WHERE id = $1", [id]);
      if (result.rowCount === 0) throw new ValidationError("transaction was not found");
    },

    async listAccounts(): Promise<readonly Account[]> {
      const result = await pool.query<AccountRow>(
        `SELECT id, type, label, currency, metadata, created_at,
                statement_balance_coefficient, statement_balance_scale
           FROM accounts
          ORDER BY id`,
      );
      return stateFromRows(result.rows, []).accounts;
    },

    async listTransactions(): Promise<readonly Transaction[]> {
      const rows = await readRows(pool);
      return stateFromRows(rows.accounts, rows.transactions).transactions;
    },

    async export(): Promise<string> {
      const rows = await readRows(pool);
      const state = stateFromRows(rows.accounts, rows.transactions);
      return exportV1(state.accounts, state.transactions);
    },

    async import(serialized: string): Promise<void> {
      const imported = importV1(serialized);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const accountIds = imported.accounts.map((account) => account.id);
        const transactionIds = imported.transactions.map((transaction) => transaction.id);
        const existing = await client.query(
          `SELECT 1 FROM accounts WHERE id = ANY($1::text[])
           UNION ALL
           SELECT 1 FROM transactions WHERE id = ANY($2::text[])`,
          [accountIds, transactionIds],
        );
        if ((existing.rowCount ?? 0) > 0) await rollback(client);

        for (const account of imported.accounts) {
          await client.query(
            `INSERT INTO accounts (
               id, type, label, currency, metadata, created_at,
               statement_balance_coefficient, statement_balance_scale
             ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
            [
              account.id,
              account.type,
              account.label,
              account.currency,
              JSON.stringify(sanitizeMetadata(account.metadata)),
              account.createdAt,
              account.type === "revolving-credit" || account.type === "charge-card"
                ? moneyToDto(account.statementBalance).coefficient
                : null,
              account.type === "revolving-credit" || account.type === "charge-card"
                ? account.statementBalance.scale
                : null,
            ],
          );
        }
        for (const transaction of imported.transactions) {
          await client.query(
            `INSERT INTO transactions (
               id, account_id, amount_coefficient, amount_scale, amount_currency, metadata, created_at
             ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
            [
              transaction.id,
              transaction.accountId,
              transaction.amount.coefficient.toString(),
              transaction.amount.scale,
              transaction.amount.currency,
              JSON.stringify(sanitizeMetadata(transaction.metadata)),
              transaction.createdAt,
            ],
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        if (error instanceof ValidationError) throw error;
        if ((error as { code?: string }).code === "23505") {
          throw new ValidationError("import conflicts with existing data");
        }
        throw error;
      } finally {
        client.release();
      }
    },

    async reset(): Promise<void> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("DELETE FROM transactions");
        await client.query("DELETE FROM accounts");
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
  });
}
