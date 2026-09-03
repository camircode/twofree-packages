import { describe, expect, it } from "vitest";

import { applyStatementPayment, createAccount, type AccountDependencies } from "@/account.js";
import { ValidationError } from "@/validation.js";
import { createTransaction } from "@/transaction.js";

const dependencies: AccountDependencies = {
  ids: { next: () => "generated-id" },
  clock: { now: () => new Date("2026-01-01T00:00:00.000Z") },
};

describe("core contracts", () => {
  it("injects identifiers and clocks into safe accounts", () => {
    const account = createAccount(
      {
        type: "debit",
        label: "Daily spending",
        currency: "MXN",
        metadata: { institution: "Local credit union" },
      },
      dependencies,
    );

    expect(account).toMatchObject({ id: "generated-id", createdAt: "2026-01-01T00:00:00.000Z" });
  });

  it.each(["4111111111111111", "ending 1111"])(
    "rejects a PAN-shaped account currency %#",
    (currency) => {
      expect(() =>
        createAccount({ type: "debit", label: "Daily", currency }, dependencies),
      ).toThrow(ValidationError);
    },
  );

  it("preserves an ISO-style account currency", () => {
    expect(
      createAccount({ type: "debit", label: "Daily", currency: "USD" }, dependencies).currency,
    ).toBe("USD");
  });

  const unsafeMetadata: Array<Record<string, string>> = [
    { lastFour: "1234" },
    { note: "ending 1111" },
    { card: "4111-1111-1111-1111" },
    { note: "4111·1111·1111·1111" },
    { note: "4111/1111·1111_1111" },
    { note: "4111;1111;1111;1111" },
    { note: "4111+1111+1111+1111" },
    { note: "4111–1111–1111–1111" },
    { note: "4111;1111+1111 – 1111" },
    { "4111111111111111": "ordinary metadata" },
    { cvv: "123" },
    { note: "track data present" },
  ];

  it.each(unsafeMetadata)("rejects unsafe account metadata %#", (metadata) => {
    expect(() =>
      createAccount({ type: "debit", label: "Unsafe", currency: "MXN", metadata }, dependencies),
    ).toThrow(ValidationError);
  });

  it.each(["4111111111111111", "ending 1111"])(
    "rejects an account label containing a card number %#",
    (label) => {
      expect(() => createAccount({ type: "debit", label, currency: "MXN" }, dependencies)).toThrow(
        ValidationError,
      );
    },
  );

  it.each(["CVV 123", "PIN 1234"])("rejects credential text in an account label %#", (label) => {
    expect(() => createAccount({ type: "debit", label, currency: "MXN" }, dependencies)).toThrow(
      ValidationError,
    );
  });

  it("rejects unsafe transaction metadata before persistence", () => {
    expect(() =>
      createTransaction(
        {
          accountId: "account-1",
          amount: { currency: "MXN", coefficient: 100n, scale: 2 },
          metadata: { pin: "0000" },
        },
        dependencies,
      ),
    ).toThrow(ValidationError);
  });

  it("insulates transaction money from caller mutation", () => {
    const amount = { currency: "MXN", coefficient: 100n, scale: 2 };
    const transaction = createTransaction({ accountId: "account-1", amount }, dependencies);

    amount.currency = "USD";
    amount.coefficient = 200n;
    amount.scale = 0;

    expect(transaction.amount).toEqual({ currency: "MXN", coefficient: 100n, scale: 2 });
  });

  it("allows ordinary non-sensitive financial metadata", () => {
    expect(() =>
      createAccount(
        {
          type: "debit",
          label: "Budget 2026 • 2500",
          currency: "MXN",
          metadata: {
            statementYear: "2026",
            monthlyBudget: "2500",
            invoiceReference: "FY2026 Q3",
          },
        },
        dependencies,
      ),
    ).not.toThrow();
  });

  it("keeps a revolving-credit remainder payable", () => {
    const account = createAccount(
      {
        type: "revolving-credit",
        label: "Revolving",
        currency: "MXN",
        statementBalance: { currency: "MXN", coefficient: 10000n, scale: 2 },
      },
      dependencies,
    );

    expect(
      applyStatementPayment(account, { currency: "MXN", coefficient: 2500n, scale: 2 }),
    ).toMatchObject({
      remainingBalance: { currency: "MXN", coefficient: 7500n, scale: 2 },
    });
  });

  it("defensively copies a credit statement balance", () => {
    const balance = { currency: "MXN", coefficient: 10000n, scale: 2 };
    const account = createAccount(
      { type: "revolving-credit", label: "Revolving", currency: "MXN", statementBalance: balance },
      dependencies,
    );

    balance.coefficient = 25000n;

    if (account.type !== "revolving-credit") throw new Error("Expected a credit account");
    expect(account.statementBalance).toEqual({ currency: "MXN", coefficient: 10000n, scale: 2 });
    expect(Object.isFrozen(account.statementBalance)).toBe(true);
  });

  it("rejects a partial charge-card payment", () => {
    const account = createAccount(
      {
        type: "charge-card",
        label: "Charge",
        currency: "MXN",
        statementBalance: { currency: "MXN", coefficient: 10000n, scale: 2 },
      },
      dependencies,
    );

    expect(() =>
      applyStatementPayment(account, { currency: "MXN", coefficient: 2500n, scale: 2 }),
    ).toThrow("full statement");
  });

  it("rejects a payment whose precision exceeds the statement scale", () => {
    const account = createAccount(
      {
        type: "revolving-credit",
        label: "Precise",
        currency: "MXN",
        statementBalance: { currency: "MXN", coefficient: 10000n, scale: 2 },
      },
      dependencies,
    );

    expect(() =>
      applyStatementPayment(account, { currency: "MXN", coefficient: 25001n, scale: 3 }),
    ).toThrow("quantized explicitly");
  });
});
