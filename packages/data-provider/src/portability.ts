import type { Account, AccountType } from "@camircode/twofree-core/account.js";
import { moneyFromDto, moneyToDto, type MoneyDto } from "@camircode/twofree-core/money.js";
import {
  assertPrivacySafeText,
  sanitizeMetadata,
  type Metadata,
} from "@camircode/twofree-core/privacy.js";
import type { Transaction } from "@camircode/twofree-core/transaction.js";
import { requireNonEmptyString, ValidationError } from "@camircode/twofree-core/validation.js";

type AccountDto = {
  id: string;
  type: AccountType;
  label: string;
  currency: string;
  metadata: Record<string, string>;
  createdAt: string;
  statementBalance?: MoneyDto;
};
type TransactionDto = {
  id: string;
  accountId: string;
  amount: MoneyDto;
  metadata: Record<string, string>;
  createdAt: string;
};
type Envelope = { version: 1; accounts: AccountDto[]; transactions: TransactionDto[] };
export type ImportedState = Readonly<{
  accounts: readonly Account[];
  transactions: readonly Transaction[];
}>;

function record(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], field: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new ValidationError(`${field} has an invalid schema`);
  }
}

function identifier(value: unknown, field: string): string {
  const result = requireNonEmptyString(value, field);
  if (/\s/.test(result)) throw new ValidationError(`${field} must not contain whitespace`);
  assertPrivacySafeText(result, field);
  return result;
}

function isoDate(value: unknown, field: string): string {
  const result = requireNonEmptyString(value, field);
  const date = new Date(result);
  if (Number.isNaN(date.valueOf()) || date.toISOString() !== result) {
    throw new ValidationError(`${field} must be a canonical ISO date`);
  }
  return result;
}

function metadata(value: unknown): Metadata {
  return sanitizeMetadata(value);
}

function money(value: unknown, field: string) {
  const dto = record(value, field);
  exactKeys(dto, ["currency", "coefficient", "scale"], field);
  return moneyFromDto({
    currency: dto.currency as string,
    coefficient: dto.coefficient as string,
    scale: dto.scale as number,
  });
}

function account(value: unknown): Account {
  const dto = record(value, "account");
  const type = dto.type;
  if (
    type !== "debit" &&
    type !== "yield" &&
    type !== "revolving-credit" &&
    type !== "charge-card"
  ) {
    throw new ValidationError("account type is invalid");
  }
  const isCredit = type === "revolving-credit" || type === "charge-card";
  exactKeys(
    dto,
    isCredit
      ? ["id", "type", "label", "currency", "metadata", "createdAt", "statementBalance"]
      : ["id", "type", "label", "currency", "metadata", "createdAt"],
    "account",
  );
  const currency = requireNonEmptyString(dto.currency, "account currency");
  assertPrivacySafeText(currency, "account currency");
  const label = requireNonEmptyString(dto.label, "account label");
  assertPrivacySafeText(label, "account label");
  const base = {
    id: identifier(dto.id, "account identifier"),
    type,
    label,
    currency,
    metadata: metadata(dto.metadata),
    createdAt: isoDate(dto.createdAt, "account createdAt"),
  };
  if (!isCredit) return Object.freeze(base) as Account;

  const statementBalance = money(dto.statementBalance, "account statementBalance");
  if (statementBalance.currency !== currency) {
    throw new ValidationError("statement balance currency must match account currency");
  }
  return Object.freeze({ ...base, statementBalance }) as Account;
}

function transaction(value: unknown, accountCurrencies: ReadonlyMap<string, string>): Transaction {
  const dto = record(value, "transaction");
  exactKeys(dto, ["id", "accountId", "amount", "metadata", "createdAt"], "transaction");
  const accountId = identifier(dto.accountId, "transaction account identifier");
  const accountCurrency = accountCurrencies.get(accountId);
  if (accountCurrency === undefined)
    throw new ValidationError("transaction references an unknown account");
  const amount = money(dto.amount, "transaction amount");
  if (amount.currency !== accountCurrency) {
    throw new ValidationError("transaction amount currency must match account currency");
  }
  return Object.freeze({
    id: identifier(dto.id, "transaction identifier"),
    accountId,
    amount,
    metadata: metadata(dto.metadata),
    createdAt: isoDate(dto.createdAt, "transaction createdAt"),
  });
}

function accountDto(account: Account): AccountDto {
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

function transactionDto(transaction: Transaction): TransactionDto {
  return {
    id: transaction.id,
    accountId: transaction.accountId,
    amount: moneyToDto(transaction.amount),
    metadata: { ...transaction.metadata },
    createdAt: transaction.createdAt,
  };
}

export function exportV1(
  accounts: readonly Account[],
  transactions: readonly Transaction[],
): string {
  const envelope: Envelope = {
    version: 1,
    accounts: accounts.map(accountDto).sort((left, right) => left.id.localeCompare(right.id)),
    transactions: transactions
      .map(transactionDto)
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
  return JSON.stringify(envelope);
}

export function importV1(serialized: string): ImportedState {
  let decoded: unknown;
  try {
    decoded = JSON.parse(serialized);
  } catch {
    throw new ValidationError("import must be valid JSON");
  }
  const envelope = record(decoded, "import");
  exactKeys(envelope, ["version", "accounts", "transactions"], "import");
  if (envelope.version !== 1) throw new ValidationError("unsupported import version");
  if (!Array.isArray(envelope.accounts) || !Array.isArray(envelope.transactions)) {
    throw new ValidationError("import accounts and transactions must be arrays");
  }

  const accounts = envelope.accounts.map(account);
  const accountIds = new Set(accounts.map((item) => item.id));
  if (accountIds.size !== accounts.length)
    throw new ValidationError("import has duplicate account identifiers");
  const accountCurrencies = new Map(accounts.map((item) => [item.id, item.currency]));
  const transactions = envelope.transactions.map((item) => transaction(item, accountCurrencies));
  const transactionIds = new Set(transactions.map((item) => item.id));
  if (transactionIds.size !== transactions.length) {
    throw new ValidationError("import has duplicate transaction identifiers");
  }
  return Object.freeze({
    accounts: Object.freeze(accounts),
    transactions: Object.freeze(transactions),
  });
}
