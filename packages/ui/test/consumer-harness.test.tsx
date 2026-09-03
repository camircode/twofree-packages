import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AppShell,
  FinanceDashboard,
  packageLocalAliasMarker,
  runViewTransition,
  statusDefinitions,
  type DashboardModel,
  type NavigationItem,
} from "@camircode/twofree-ui";
import "@camircode/twofree-ui/styles.css";

const navigation: readonly NavigationItem[] = [
  { id: "overview", label: "Resumen" },
  { id: "activity", label: "Actividad" },
];

const money = {
  exact: { currency: "USD", coefficient: "1250", scale: 2 },
  formatted: { currency: "USD", text: "$12.50" },
} as const;

const model: DashboardModel = {
  balance: money,
  trendOrAllocation: {
    kind: "allocation",
    label: "Distribución de gastos",
    summary: "La vivienda concentra la mayor parte de los datos proporcionados.",
    values: [{ label: "Vivienda", value: money }],
  },
  activity: [{ id: "alquiler", label: "Alquiler", date: "2026-07-20", value: money }],
};

function ConsumerHarness({ surface = "web" }: { surface?: "web" | "desktop" }) {
  const onNavigate = vi.fn();

  return (
    <div data-theme="light" data-consumer-surface={surface}>
      <AppShell
        activeItemId="overview"
        brand={<img alt="2 Free logo" src="/assets/2free-con-fondi.svg" />}
        navigation={navigation}
        onNavigate={onNavigate}
      >
        <FinanceDashboard state={{ status: "ready", model }} />
      </AppShell>
    </div>
  );
}

afterEach(cleanup);

describe("public @camircode/twofree-ui consumer harness", () => {
  it("composes shell, dashboard, themes, assets, aliases, and accessibility contracts", () => {
    render(<ConsumerHarness />);

    expect(screen.getByRole("navigation", { name: "Navegación principal" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Resumen financiero" })).not.toBeNull();
    expect(screen.getByRole("img", { name: "2 Free logo" })).not.toBeNull();
    expect(screen.getByRole("region", { name: "Distribución de gastos" }).textContent).toContain(
      "La vivienda concentra la mayor parte de los datos proporcionados.",
    );
    expect(screen.getByRole("region", { name: "Saldo disponible" }).textContent).toContain(
      "$12.50",
    );
    expect(screen.getAllByRole("button", { name: "Resumen" })).toHaveLength(2);
    expect(
      screen
        .getAllByRole("button", { name: "Resumen" })
        .every((button) => button.getAttribute("aria-current") === "page"),
    ).toBe(true);
    expect(packageLocalAliasMarker).toBe("@camircode/twofree-ui/src");
    expect(statusDefinitions.success.label).toBe("Éxito");
  });

  it("uses the public motion contract without owning navigation or state", () => {
    const commit = vi.fn();

    runViewTransition({ commit, startViewTransition: undefined });

    expect(commit).toHaveBeenCalledOnce();
  });

  it("reuses the public package contract for equivalent web and desktop consumers", () => {
    render(
      <>
        <ConsumerHarness surface="web" />
        <ConsumerHarness surface="desktop" />
      </>,
    );

    expect(screen.getAllByRole("navigation", { name: "Navegación principal" })).toHaveLength(2);
    expect(screen.getAllByRole("heading", { name: "Resumen financiero" })).toHaveLength(2);
    expect(screen.getAllByTestId("dashboard-compact-data")).toHaveLength(2);
    const headingIds = [...document.querySelectorAll("h2")].map((heading) => heading.id);
    expect(new Set(headingIds).size).toBe(headingIds.length);
  });

  it("keeps the consumer composition presentation-only", () => {
    const source = ["src/components/app-shell.tsx", "src/components/finance-dashboard.tsx"]
      .map((file) => readFileSync(resolve(process.cwd(), file), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/\b(fetch|localStorage|sessionStorage|prisma|postgres)\b/i);
    expect(source).not.toMatch(/card[- ]?number/i);
  });
});
