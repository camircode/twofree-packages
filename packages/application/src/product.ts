import { add, moneyFromDto, moneyToDto, type MoneyDto } from "@camircode/twofree-core/money.js";
import {
  requireFinanceScope,
  type FinanceScope,
} from "@camircode/twofree-data-provider/provider.js";
import type { AsyncFinanceProvider } from "./runtime.js";
import { mapAccount, mapTransaction, type AccountView, type TransactionView } from "./mapping.js";

export type AccountCommand = Readonly<{
  type: "debit" | "yield" | "revolving-credit" | "charge-card";
  label: string;
  currency: string;
  metadata?: Record<string, string>;
  statementBalance?: MoneyDto;
}>;

export type TransactionCommand = Readonly<{
  accountId: string;
  amount: MoneyDto;
  metadata?: Record<string, string>;
}>;

export type DashboardView = Readonly<{
  accountCount: number;
  transactionCount: number;
  accounts: readonly AccountView[];
  transactions: readonly TransactionView[];
  totals: readonly MoneyDto[];
}>;

const dashboardActivityLimit = 12;

export interface ProductApplication {
  listAccounts(scope?: FinanceScope): Promise<readonly AccountView[]>;
  createAccount(
    scopeOrInput: FinanceScope | AccountCommand,
    input?: AccountCommand,
  ): Promise<AccountView>;
  updateAccount(scope: FinanceScope, id: string, input: AccountCommand): Promise<AccountView>;
  deleteAccount(scope: FinanceScope, id: string): Promise<void>;
  listTransactions(scope?: FinanceScope): Promise<readonly TransactionView[]>;
  createTransaction(
    scopeOrInput: FinanceScope | TransactionCommand,
    input?: TransactionCommand | string,
    idempotencyKey?: string,
  ): Promise<TransactionView>;
  updateTransaction(
    scope: FinanceScope,
    id: string,
    input: TransactionCommand,
  ): Promise<TransactionView>;
  deleteTransaction(scope: FinanceScope, id: string): Promise<void>;
  dashboard(scope?: FinanceScope): Promise<DashboardView>;
  export(scope?: FinanceScope): Promise<string>;
  import(scopeOrSerialized: FinanceScope | string, serialized?: string): Promise<void>;
}

function totalsFor(transactions: readonly TransactionView[]): readonly MoneyDto[] {
  const totals = new Map<string, ReturnType<typeof moneyFromDto>>();
  for (const transaction of transactions) {
    const money = moneyFromDto(transaction.amount);
    const current = totals.get(money.currency);
    totals.set(
      money.currency,
      current ? add(current, money, Math.max(current.scale, money.scale), "DOWN") : money,
    );
  }
  return [...totals.values()]
    .sort((left, right) => left.currency.localeCompare(right.currency))
    .map(moneyToDto);
}

export function createProductApplication(provider: AsyncFinanceProvider): ProductApplication {
  return {
    async listAccounts(scope) {
      const owner = requireFinanceScope(scope);
      return (await provider.listAccounts(owner)).map(mapAccount);
    },
    async createAccount(scopeOrInput, input) {
      const owner = requireFinanceScope(input === undefined ? undefined : scopeOrInput);
      const command = input as AccountCommand;
      const account = await provider.createAccount(owner, {
        type: command.type,
        label: command.label,
        currency: command.currency,
        metadata: command.metadata,
        statementBalance: command.statementBalance
          ? moneyFromDto(command.statementBalance)
          : undefined,
      });
      return mapAccount(account);
    },
    async updateAccount(scope, id, command) {
      const owner = requireFinanceScope(scope);
      return mapAccount(
        await provider.updateAccount(owner, id, {
          ...command,
          statementBalance: command.statementBalance
            ? moneyFromDto(command.statementBalance)
            : undefined,
        }),
      );
    },
    async deleteAccount(scope, id) {
      await provider.deleteAccount(requireFinanceScope(scope), id);
    },
    async listTransactions(scope) {
      const owner = requireFinanceScope(scope);
      return (await provider.listTransactions(owner)).map(mapTransaction);
    },
    async createTransaction(scopeOrInput, input, idempotencyKey) {
      const owner = requireFinanceScope(idempotencyKey === undefined ? undefined : scopeOrInput);
      const command = input as TransactionCommand;
      const transaction = await provider.createTransaction(
        owner,
        {
          ...command,
          amount: moneyFromDto(command.amount),
        },
        idempotencyKey as string,
      );
      return mapTransaction(transaction);
    },
    async updateTransaction(scope, id, command) {
      return mapTransaction(
        await provider.updateTransaction(requireFinanceScope(scope), id, {
          ...command,
          amount: moneyFromDto(command.amount),
        }),
      );
    },
    async deleteTransaction(scope, id) {
      await provider.deleteTransaction(requireFinanceScope(scope), id);
    },
    async dashboard(scope) {
      const owner = requireFinanceScope(scope);
      const [accounts, transactions] = await Promise.all([
        this.listAccounts(owner),
        this.listTransactions(owner),
      ]);
      const recentTransactions = [...transactions]
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, dashboardActivityLimit);
      return {
        accountCount: accounts.length,
        transactionCount: transactions.length,
        accounts,
        transactions: recentTransactions,
        totals: totalsFor(transactions),
      };
    },
    async export(scope) {
      return await provider.export(requireFinanceScope(scope));
    },
    async import(scopeOrSerialized, serialized) {
      await provider.import(
        requireFinanceScope(serialized === undefined ? undefined : scopeOrSerialized),
        serialized as string,
      );
    },
  };
}
