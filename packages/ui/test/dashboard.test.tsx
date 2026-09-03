import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FinanceDashboard } from "@/components/finance-dashboard.js";
import { spanishDashboardModel, spanishDashboardStates } from "./fixtures/spanish-dashboard";
import "@/styles/index.css";

describe("fixture-backed Spanish FinanceDashboard", () => {
  afterEach(cleanup);

  it("renders Spanish summary cards, supplied exact money, progress, and activity", () => {
    render(<FinanceDashboard state={spanishDashboardStates.ready} />);

    expect(screen.getByRole("heading", { name: "Resumen financiero" })).not.toBeNull();
    expect(screen.getByRole("region", { name: "Saldo disponible" }).textContent).toContain(
      "$1,234.56",
    );
    expect(screen.getByRole("region", { name: "Saldo disponible" }).textContent).toContain("USD");
    expect(screen.getByRole("region", { name: "Distribución de gastos" }).textContent).toContain(
      "La vivienda concentra la mayor parte del presupuesto disponible este mes.",
    );
    expect(screen.getByRole("region", { name: "Actividad reciente" }).textContent).toContain(
      "Supermercado del barrio",
    );
    expect(screen.getByRole("region", { name: "Actividad reciente" }).textContent).toContain(
      "$95.00",
    );

    const progress = screen.getByRole("progressbar", {
      name: "Vivienda y servicios esenciales",
    });
    expect(progress.getAttribute("max")).toBe("100");
    expect(progress.getAttribute("value")).toBe("68");
    expect(screen.getAllByText("68 % del total")).toHaveLength(2);
  });

  it("exposes allocation and activity through structured semantic data", () => {
    render(<FinanceDashboard state={spanishDashboardStates.ready} />);

    const table = screen.getByRole("table", { name: "Valores por categoría" });
    expect(screen.getByRole("columnheader", { name: "Concepto" })).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: "Importe" })).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: "Progreso" })).not.toBeNull();
    expect(table.textContent).toContain("Alimentación y compras del hogar");
    expect(table.textContent).toContain("$250.00");

    const activity = screen.getByRole("list", { name: "Movimientos recientes" });
    expect(activity.querySelectorAll(":scope > li")).toHaveLength(2);
    expect(activity.textContent).toContain("Suscripción de transporte");
    expect(activity.textContent).toContain("2026-07-18");
  });

  it("preserves all four state semantics with neutral Spanish explanations", () => {
    const states = [
      [
        spanishDashboardStates.loading,
        "Información Cargando su resumen financiero.",
        "Cargando su resumen financiero.",
      ],
      [
        spanishDashboardStates.empty,
        "Información Todavía no hay cuentas ni movimientos en este espacio.",
        "Todavía no hay cuentas ni movimientos en este espacio.",
      ],
      [
        spanishDashboardStates.error,
        "Error No se pudo cargar la información del panel.",
        "No se pudo cargar la información del panel.",
      ],
    ] as const;

    for (const [state, statusName, text] of states) {
      const { unmount } = render(<FinanceDashboard state={state} />);
      expect(
        screen.getByRole(state.status === "error" ? "alert" : "status", { name: statusName })
          .textContent,
      ).toContain(text);
      unmount();
    }
  });

  it("explains the locked state while access is required", () => {
    render(<FinanceDashboard state={{ status: "locked" }} />);

    expect(
      screen.getByRole("status", {
        name: "Información Inicie sesión para consultar sus datos financieros.",
      }),
    ).not.toBeNull();
  });

  it("keeps exact MoneyDisplay formatting and renders no card-number surface", () => {
    render(<FinanceDashboard state={spanishDashboardStates.ready} />);

    const balance = screen.getByRole("region", { name: "Saldo disponible" });
    expect(balance.querySelector(".ui-money")?.getAttribute("data-currency")).toBe("USD");
    expect(balance.querySelector(".ui-money__currency")?.textContent).toBe("USD");
    expect(balance.querySelector(".ui-money__text")?.textContent).toBe("$1,234.56");
    expect(balance.textContent).not.toContain("123456789012345678901234567890");
    expect(document.body.textContent).not.toMatch(/(?:número|numero) de tarjeta|card[- ]number/i);
  });

  it("renders unavailable balance truthfully without inventing a zero amount", () => {
    const state = {
      status: "ready",
      model: {
        ...spanishDashboardModel,
        balance: { status: "unavailable", reason: "not-calculated" },
      },
    } as const;

    render(<FinanceDashboard state={state} />);

    const balance = screen.getByRole("region", { name: "Saldo disponible" });
    expect(balance.textContent).toContain("No disponible");
    expect(balance.textContent).toContain("No calculado");
    expect(balance.querySelector(".ui-money")).toBeNull();
    expect(balance.textContent).not.toMatch(/\$0(?:\.00)?/);
  });

  it("keeps the presentation boundary free of arithmetic, fetching, providers, and sensitive fields", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/finance-dashboard.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/\b(fetch|BigInt|parseFloat|parseInt|Intl|Math\.)\b/);
    expect(source).not.toMatch(/cardNumber|card-number|card[- ]number|número de tarjeta/i);
    expect(source).not.toContain("window");
    expect(source).not.toContain("document");
  });

  it("rerenders updated exact-money models without provider work", () => {
    const updated = {
      ...spanishDashboardModel,
      balance: {
        exact: { currency: "USD", coefficient: "999", scale: 2 },
        formatted: { currency: "USD", text: "$9.99" },
      },
    } as const;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { rerender } = render(<FinanceDashboard state={spanishDashboardStates.ready} />);

    rerender(<FinanceDashboard state={{ status: "ready", model: updated }} />);

    expect(screen.getByRole("region", { name: "Saldo disponible" }).textContent).toContain("$9.99");
    expect(screen.getByRole("region", { name: "Saldo disponible" }).textContent).not.toContain(
      "$1,234.56",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("keeps a compact structured fallback and explicit no-overflow CSS contract", () => {
    render(<FinanceDashboard state={spanishDashboardStates.ready} />);

    expect(screen.getByTestId("dashboard-compact-data").textContent).toContain(
      "Vivienda y servicios esenciales",
    );
    const styles = readFileSync(resolve(process.cwd(), "src/styles/dashboard.css"), "utf8");
    expect(styles).toContain("@media (max-width: 42rem)");
    expect(styles).toContain("overflow-wrap: anywhere");
    expect(styles).toContain("min-inline-size: 0");
  });

  it("keeps the full product boundary outside the UI source", () => {
    const source = ["src/components/finance-dashboard.tsx", "src/models/dashboard.ts"]
      .map((path) => readFileSync(resolve(process.cwd(), path), "utf8"))
      .join("\n");
    expect(source).not.toMatch(
      /\b(route|storage|authentication|auth|fetch|backend|persistence|sync|notification|integration|native|transaction|budget|investment)\b/i,
    );
    const workspace = resolve(process.cwd(), "../..");
    expect(existsSync(resolve(workspace, "packages/application/package.json"))).toBe(true);
    for (const directory of ["apps", "backend", "server", "services"]) {
      expect(existsSync(resolve(workspace, directory))).toBe(false);
    }
  });
});
