import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AlertsWorkspace,
  BudgetSavingsWorkspace,
  OnboardingModes,
} from "@/components/product-workspaces.js";

describe("progressive product flows", () => {
  afterEach(cleanup);

  it("makes each onboarding mode card the selection control", () => {
    const onSelect = vi.fn();
    render(<OnboardingModes onSelect={onSelect} selected="local" />);

    expect(screen.getByRole("radio", { name: /Local/ }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: /Nube 2 Free/ }));

    expect(onSelect).toHaveBeenCalledWith("cloud");
  });

  it("reveals only the current group of fields", async () => {
    render(
      <BudgetSavingsWorkspace
        budgets={{ status: "ready", records: [] }}
        goals={{ status: "ready", records: [] }}
        onCreateBudget={vi.fn()}
        onCreateGoal={vi.fn()}
      />,
    );

    expect(screen.queryByRole("textbox", { name: "Categoría" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Crear presupuesto" }));
    expect(screen.getByRole("dialog", { name: "Crear un presupuesto" })).not.toBeNull();
    expect(await screen.findByRole("textbox", { name: "Categoría" })).not.toBeNull();
    expect(screen.queryByRole("textbox", { name: "Límite exacto" })).toBeNull();
    expect(screen.getByText("Paso 1 de 3")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.queryByRole("textbox", { name: "Categoría" })).toBeNull();
    expect(await screen.findByRole("textbox", { name: "Límite exacto" })).not.toBeNull();
    expect(screen.getByText("Paso 2 de 3")).not.toBeNull();
  });

  it("asks for a financial intention instead of database rule fields", async () => {
    render(
      <AlertsWorkspace
        notificationPermission="default"
        onCreateRule={vi.fn()}
        onDeleteRule={vi.fn()}
        onEvaluate={vi.fn(async () => "Sin alertas")}
        onRequestPermission={vi.fn()}
        rules={{ status: "ready", records: [] }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Crear aviso" }));
    expect(await screen.findByRole("combobox", { name: "Situación" })).not.toBeNull();
    expect(screen.queryByRole("textbox", { name: "Fuente" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Campo observado" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Comparador" })).toBeNull();
  });
});
