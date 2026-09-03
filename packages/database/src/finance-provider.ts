import { createHash, randomUUID } from "node:crypto";

import {
  createAccount,
  updateAccount,
  type Account,
  type AccountType,
} from "@camircode/twofree-core/account.js";
import { moneyFromDto } from "@camircode/twofree-core/money.js";
import { sanitizeMetadata } from "@camircode/twofree-core/privacy.js";
import {
  createTransaction,
  updateTransaction,
  type Transaction,
} from "@camircode/twofree-core/transaction.js";
import { importV1, exportV1 } from "@camircode/twofree-data-provider/portability.js";
import {
  requireFinanceScope,
  requireIdempotencyKey,
  type FinanceProviderFactory,
  type FinanceScope,
  type ProviderDependencies,
  type ScopedFinanceProviderLike,
  ValidationError,
} from "@camircode/twofree-data-provider/provider.js";

import type { PrismaClient } from "./client.js";
import { DataEncryption } from "./encryption.js";

type AccountRow = Readonly<{
  id: string;
  type: string;
  label: string;
  labelEncrypted: Uint8Array | null;
  currency: string;
  metadata: unknown;
  metadataEncrypted: Uint8Array | null;
  statementBalanceCoefficient: string | null;
  statementBalanceScale: number | null;
  createdAt: Date;
}>;

type TransactionRow = Readonly<{
  id: string;
  accountId: string;
  currency: string;
  amountCoefficient: string;
  amountScale: number;
  metadata: unknown;
  metadataEncrypted: Uint8Array | null;
  createdAt: Date;
}>;

const accountTypes = new Set<AccountType>(["debit", "yield", "revolving-credit", "charge-card"]);

function defaultDependencies(): ProviderDependencies {
  return {
    ids: { next: () => randomUUID() },
    clock: { now: () => new Date() },
  };
}

function accountFromRow(row: AccountRow, encryption: DataEncryption): Account {
  if (!accountTypes.has(row.type as AccountType)) {
    throw new ValidationError("stored account type is invalid");
  }
  const base = {
    id: row.id,
    type: row.type as AccountType,
    label: row.labelEncrypted ? encryption.decrypt<string>(row.labelEncrypted) : row.label,
    currency: row.currency,
    metadata: row.metadataEncrypted
      ? sanitizeMetadata(encryption.decrypt(row.metadataEncrypted))
      : sanitizeMetadata(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
  if (base.type === "debit" || base.type === "yield") return Object.freeze(base) as Account;
  if (row.statementBalanceCoefficient === null || row.statementBalanceScale === null) {
    throw new ValidationError("stored credit account is missing its statement balance");
  }
  return Object.freeze({
    ...base,
    statementBalance: moneyFromDto({
      currency: row.currency,
      coefficient: row.statementBalanceCoefficient,
      scale: row.statementBalanceScale,
    }),
  }) as Account;
}

function transactionFromRow(row: TransactionRow, encryption: DataEncryption): Transaction {
  return Object.freeze({
    id: row.id,
    accountId: row.accountId,
    amount: moneyFromDto({
      currency: row.currency,
      coefficient: row.amountCoefficient,
      scale: row.amountScale,
    }),
    metadata: row.metadataEncrypted
      ? sanitizeMetadata(encryption.decrypt(row.metadataEncrypted))
      : sanitizeMetadata(row.metadata),
    createdAt: row.createdAt.toISOString(),
  });
}

function fingerprint(input: Parameters<ScopedFinanceProviderLike["createTransaction"]>[1]): string {
  const metadata = Object.fromEntries(Object.entries(sanitizeMetadata(input.metadata)).sort());
  return createHash("sha256")
    .update(
      JSON.stringify({
        accountId: input.accountId,
        amount: {
          currency: input.amount.currency,
          coefficient: input.amount.coefficient.toString(),
          scale: input.amount.scale,
        },
        metadata,
      }),
    )
    .digest("hex");
}

function assertBoundScope(bound: FinanceScope, value: FinanceScope): FinanceScope {
  const scope = requireFinanceScope(value);
  if (scope.ownerId !== bound.ownerId) throw new ValidationError("finance scope mismatch");
  return scope;
}

export function createPrismaFinanceProviderFactory(
  prisma: PrismaClient,
  dependencies: ProviderDependencies = defaultDependencies(),
  encryption: DataEncryption = DataEncryption.fromBase64(
    process.env.DATA_ENCRYPTION_KEY,
    process.env.NODE_ENV === "test",
  ),
): FinanceProviderFactory {
  return (requestedScope) => {
    const bound = requireFinanceScope(requestedScope);
    const provider: ScopedFinanceProviderLike = {
      async createAccount(scope, input) {
        const owner = assertBoundScope(bound, scope);
        const account = createAccount(input, dependencies);
        await prisma.financeAccount.create({
          data: {
            id: account.id,
            ownerId: owner.ownerId,
            type: account.type,
            label: "[encrypted]",
            labelEncrypted: encryption.encrypt(account.label),
            currency: account.currency,
            metadata: {},
            metadataEncrypted: encryption.encrypt(account.metadata),
            statementBalanceCoefficient:
              account.type === "revolving-credit" || account.type === "charge-card"
                ? account.statementBalance.coefficient.toString()
                : null,
            statementBalanceScale:
              account.type === "revolving-credit" || account.type === "charge-card"
                ? account.statementBalance.scale
                : null,
            createdAt: new Date(account.createdAt),
          },
        });
        return account;
      },

      async updateAccount(scope, id, input) {
        const owner = assertBoundScope(bound, scope);
        const row = await prisma.financeAccount.findUnique({
          where: { id_ownerId: { id, ownerId: owner.ownerId } },
        });
        if (!row) throw new ValidationError("account was not found");
        const account = updateAccount(accountFromRow(row, encryption), input);
        await prisma.financeAccount.update({
          where: { id_ownerId: { id, ownerId: owner.ownerId } },
          data: {
            label: "[encrypted]",
            labelEncrypted: encryption.encrypt(account.label),
            metadata: {},
            metadataEncrypted: encryption.encrypt(account.metadata),
            statementBalanceCoefficient:
              account.type === "revolving-credit" || account.type === "charge-card"
                ? account.statementBalance.coefficient.toString()
                : null,
            statementBalanceScale:
              account.type === "revolving-credit" || account.type === "charge-card"
                ? account.statementBalance.scale
                : null,
          },
        });
        return account;
      },

      async deleteAccount(scope, id) {
        const owner = assertBoundScope(bound, scope);
        const transactionCount = await prisma.financeTransaction.count({
          where: { ownerId: owner.ownerId, accountId: id },
        });
        if (transactionCount > 0) {
          throw new ValidationError("delete associated transactions before deleting the account");
        }
        const result = await prisma.financeAccount.deleteMany({
          where: { id, ownerId: owner.ownerId },
        });
        if (result.count === 0) throw new ValidationError("account was not found");
      },

      async createTransaction(scope, input, idempotencyKey) {
        const owner = assertBoundScope(bound, scope);
        const key = requireIdempotencyKey(idempotencyKey);
        const requestFingerprint = fingerprint(input);
        return prisma.$transaction(async (database) => {
          await database.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${owner.ownerId}\0${key}`}, 0))`;
          const existing = await database.transactionIdempotency.findUnique({
            where: { ownerId_key: { ownerId: owner.ownerId, key } },
            include: { transaction: true },
          });
          if (existing) {
            if (existing.requestFingerprint !== requestFingerprint) {
              throw new ValidationError(
                "idempotency key conflicts with a different transaction request",
              );
            }
            return transactionFromRow(existing.transaction, encryption);
          }

          const account = await database.financeAccount.findUnique({
            where: { id_ownerId: { id: input.accountId, ownerId: owner.ownerId } },
          });
          if (!account) throw new ValidationError("transaction references an unknown account");
          if (account.currency !== input.amount.currency) {
            throw new ValidationError("transaction amount currency must match account currency");
          }

          const transaction = createTransaction(input, dependencies);
          await database.financeTransaction.create({
            data: {
              id: transaction.id,
              ownerId: owner.ownerId,
              accountId: transaction.accountId,
              currency: transaction.amount.currency,
              amountCoefficient: transaction.amount.coefficient.toString(),
              amountScale: transaction.amount.scale,
              metadata: {},
              metadataEncrypted: encryption.encrypt(transaction.metadata),
              createdAt: new Date(transaction.createdAt),
            },
          });
          await database.transactionIdempotency.create({
            data: {
              id: dependencies.ids.next(),
              ownerId: owner.ownerId,
              key,
              requestFingerprint,
              transactionId: transaction.id,
            },
          });
          return transaction;
        });
      },

      async updateTransaction(scope, id, input) {
        const owner = assertBoundScope(bound, scope);
        const [row, account] = await Promise.all([
          prisma.financeTransaction.findUnique({
            where: { id_ownerId: { id, ownerId: owner.ownerId } },
          }),
          prisma.financeAccount.findUnique({
            where: { id_ownerId: { id: input.accountId, ownerId: owner.ownerId } },
          }),
        ]);
        if (!row) throw new ValidationError("transaction was not found");
        if (!account) throw new ValidationError("transaction references an unknown account");
        if (account.currency !== input.amount.currency) {
          throw new ValidationError("transaction amount currency must match account currency");
        }
        const transaction = updateTransaction(transactionFromRow(row, encryption), input);
        await prisma.financeTransaction.update({
          where: { id_ownerId: { id, ownerId: owner.ownerId } },
          data: {
            accountId: transaction.accountId,
            currency: transaction.amount.currency,
            amountCoefficient: transaction.amount.coefficient.toString(),
            amountScale: transaction.amount.scale,
            metadata: {},
            metadataEncrypted: encryption.encrypt(transaction.metadata),
          },
        });
        return transaction;
      },

      async deleteTransaction(scope, id) {
        const owner = assertBoundScope(bound, scope);
        const result = await prisma.financeTransaction.deleteMany({
          where: { id, ownerId: owner.ownerId },
        });
        if (result.count === 0) throw new ValidationError("transaction was not found");
      },

      async listAccounts(scope) {
        const owner = assertBoundScope(bound, scope);
        const rows = await prisma.financeAccount.findMany({
          where: { ownerId: owner.ownerId },
          orderBy: { id: "asc" },
        });
        return rows.map((row) => accountFromRow(row, encryption));
      },

      async listTransactions(scope) {
        const owner = assertBoundScope(bound, scope);
        const rows = await prisma.financeTransaction.findMany({
          where: { ownerId: owner.ownerId },
          orderBy: { id: "asc" },
        });
        return rows.map((row) => transactionFromRow(row, encryption));
      },

      async export(scope) {
        const owner = assertBoundScope(bound, scope);
        const [accounts, transactions] = await Promise.all([
          provider.listAccounts(owner),
          provider.listTransactions(owner),
        ]);
        return exportV1(accounts, transactions);
      },

      async import(scope, serialized) {
        const owner = assertBoundScope(bound, scope);
        const imported = importV1(serialized);
        await prisma.$transaction(async (database) => {
          const accountIds = imported.accounts.map(({ id }) => id);
          const transactionIds = imported.transactions.map(({ id }) => id);
          const [accountConflict, transactionConflict] = await Promise.all([
            database.financeAccount.findFirst({ where: { id: { in: accountIds } } }),
            database.financeTransaction.findFirst({ where: { id: { in: transactionIds } } }),
          ]);
          if (accountConflict || transactionConflict) {
            throw new ValidationError("import conflicts with existing data");
          }
          for (const account of imported.accounts) {
            await database.financeAccount.create({
              data: {
                id: account.id,
                ownerId: owner.ownerId,
                type: account.type,
                label: "[encrypted]",
                labelEncrypted: encryption.encrypt(account.label),
                currency: account.currency,
                metadata: {},
                metadataEncrypted: encryption.encrypt(account.metadata),
                statementBalanceCoefficient:
                  account.type === "revolving-credit" || account.type === "charge-card"
                    ? account.statementBalance.coefficient.toString()
                    : null,
                statementBalanceScale:
                  account.type === "revolving-credit" || account.type === "charge-card"
                    ? account.statementBalance.scale
                    : null,
                createdAt: new Date(account.createdAt),
              },
            });
          }
          for (const transaction of imported.transactions) {
            await database.financeTransaction.create({
              data: {
                id: transaction.id,
                ownerId: owner.ownerId,
                accountId: transaction.accountId,
                currency: transaction.amount.currency,
                amountCoefficient: transaction.amount.coefficient.toString(),
                amountScale: transaction.amount.scale,
                metadata: {},
                metadataEncrypted: encryption.encrypt(transaction.metadata),
                createdAt: new Date(transaction.createdAt),
              },
            });
          }
        });
      },

      async reset(scope) {
        const owner = assertBoundScope(bound, scope);
        await prisma.$transaction([
          prisma.transactionIdempotency.deleteMany({ where: { ownerId: owner.ownerId } }),
          prisma.financeTransaction.deleteMany({ where: { ownerId: owner.ownerId } }),
          prisma.financeAccount.deleteMany({ where: { ownerId: owner.ownerId } }),
        ]);
      },
    };
    return Object.freeze(provider);
  };
}
