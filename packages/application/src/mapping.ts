import type { Account } from "@camircode/twofree-core/account.js";
import { moneyToDto, type MoneyDto } from "@camircode/twofree-core/money.js";
import type { Transaction } from "@camircode/twofree-core/transaction.js";

export type MoneyView = MoneyDto;
export type AccountView = Readonly<{
  id: string;
  type: Account["type"];
  label: string;
  currency: string;
  metadata: Readonly<Record<string, string>>;
  createdAt: string;
  statementBalance?: MoneyView;
}>;
export type TransactionView = Readonly<{
  id: string;
  accountId: string;
  amount: MoneyView;
  metadata: Readonly<Record<string, string>>;
  createdAt: string;
}>;

export function mapAccount(account: Account): AccountView {
  const base = {
    id: account.id,
    type: account.type,
    label: account.label,
    currency: account.currency,
    metadata: { ...account.metadata },
    createdAt: account.createdAt,
  };
  return account.type === "revolving-credit" || account.type === "charge-card"
    ? { ...base, statementBalance: moneyToDto(account.statementBalance) }
    : base;
}

export function mapTransaction(transaction: Transaction): TransactionView {
  return {
    id: transaction.id,
    accountId: transaction.accountId,
    amount: moneyToDto(transaction.amount),
    metadata: { ...transaction.metadata },
    createdAt: transaction.createdAt,
  };
}
