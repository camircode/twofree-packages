import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  TransactionsOverview,
  type TransactionListItem,
} from "@/components/portfolio-workspaces.js";

function transaction(
  id: string,
  accountId: string,
  account: string,
  amount: string,
  date: string,
): TransactionListItem {
  return {
    id,
    account,
    accountId,
    amount: `$${amount} MXN`,
    amountValue: amount,
    category: "Hogar",
    date,
    dateIso: date,
    draft: {
      accountId,
      amount,
      category: "Hogar",
      date,
      description: id,
      type: "expense",
    },
    label: id,
    type: "expense",
  };
}

describe("transaction history filters", () => {
  afterEach(cleanup);

  it("keeps every transaction filter in one section", () => {
    render(
      <TransactionsOverview
        data={{
          balance: "Sin movimientos",
          expenses: "$0 MXN",
          income: "$0 MXN",
          transactions: [],
        }}
        registrationAction={null}
      />,
    );

    const filters = screen.getByRole("region", { name: "Filtrar historial" });
    expect(
      within(filters).getByPlaceholderText("Buscar por nombre, cuenta o categoría"),
    ).not.toBeNull();
    expect(within(filters).getByRole("group", { name: "Filtrar por tipo" })).not.toBeNull();
    expect(within(filters).getByLabelText("Cuenta")).not.toBeNull();
    expect(within(filters).getByLabelText("Monto mínimo")).not.toBeNull();
    expect(within(filters).getByLabelText("Periodo")).not.toBeNull();
  });

  it("combines account, amount, and historical period filters", () => {
    render(
      <TransactionsOverview
        data={{
          balance: "3 movimientos",
          expenses: "$1,750 MXN",
          income: "Sin movimientos",
          transactions: [
            transaction("weekly-match", "daily", "Cuenta diaria", "750", "2026-07-22"),
            transaction("other-account", "savings", "Ahorro", "700", "2026-07-23"),
            transaction("outside-range", "daily", "Cuenta diaria", "300", "2026-06-10"),
          ],
        }}
        registrationAction={null}
      />,
    );

    fireEvent.change(screen.getByLabelText("Cuenta"), { target: { value: "daily" } });
    fireEvent.change(screen.getByLabelText("Monto mínimo"), { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("Monto máximo"), { target: { value: "800" } });
    fireEvent.change(screen.getByLabelText("Periodo"), { target: { value: "week" } });
    fireEvent.change(screen.getByLabelText("Fecha de referencia"), {
      target: { value: "2026-07-24" },
    });

    expect(screen.getByText("weekly-match")).not.toBeNull();
    expect(screen.queryByText("other-account")).toBeNull();
    expect(screen.queryByText("outside-range")).toBeNull();
    expect(screen.getByText("1-1 de 1 resultados")).not.toBeNull();
  });

  it("supports custom date ranges and all-time reset", () => {
    render(
      <TransactionsOverview
        data={{
          balance: "2 movimientos",
          expenses: "$1,050 MXN",
          income: "Sin movimientos",
          transactions: [
            transaction("july", "daily", "Cuenta diaria", "750", "2026-07-22"),
            transaction("january", "daily", "Cuenta diaria", "300", "2026-01-10"),
          ],
        }}
        registrationAction={null}
      />,
    );

    fireEvent.change(screen.getByLabelText("Periodo"), { target: { value: "custom" } });
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-07-01" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-07-31" } });
    expect(screen.getByText("july")).not.toBeNull();
    expect(screen.queryByText("january")).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("Buscar por nombre, cuenta o categoría"), {
      target: { value: "july" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ingresos" }));
    expect(screen.queryByText("july")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(screen.getByText("january")).not.toBeNull();
    expect(
      (screen.getByPlaceholderText("Buscar por nombre, cuenta o categoría") as HTMLInputElement)
        .value,
    ).toBe("");
    expect(screen.getByRole("button", { name: "Todas" }).getAttribute("aria-pressed")).toBe("true");
  });
});
