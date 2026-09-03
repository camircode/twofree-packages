import { HomeSimple } from "iconoir-react";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import {
  ChartTextEquivalent,
  FinanceSafeState,
  NamedIconButton,
  UiIconoirProvider,
  chartDescriptionId,
  type FinanceExperienceState,
} from "@camircode/twofree-ui";

import {
  syntheticFinanceExperienceModel,
  syntheticReadyFinanceExperience,
} from "./fixtures/finance-experience";
import "@/styles/index.css";

afterEach(cleanup);

const lockedState = {
  status: "locked",
  message: "Autenticación requerida. Los datos financieros no están disponibles.",
} as const satisfies FinanceExperienceState;

// @ts-expect-error A locked route state must never carry a finance model.
const invalidLockedState: FinanceExperienceState = {
  status: "locked",
  message: "Estado bloqueado",
  model: syntheticFinanceExperienceModel,
};

void invalidLockedState;

describe("mobile-first finance foundation contracts", () => {
  it("keeps locked states model-free and renders fail-closed Spanish semantics", () => {
    render(<FinanceSafeState state={lockedState} />);

    const state = screen.getByRole("status", { name: /bloqueado/i });
    expect(state.getAttribute("data-finance-state")).toBe("locked");
    expect(state.getAttribute("data-state-label")).toBe("Bloqueado");
    expect(state.textContent).toContain(lockedState.message);
    expect(state.querySelector("[data-state-marker]")).not.toBeNull();
    expect(state.textContent).not.toContain("Tus finanzas, de un vistazo");
  });

  it("keeps ready rendering behind a typed package-owned boundary", () => {
    const ready = syntheticReadyFinanceExperience;

    expect(ready.status).toBe("ready");
    expect(ready.model.context.heading).toBe("Tus finanzas, de un vistazo");
    expect(ready.model.charts[0].status).toBe("ready");
  });

  it("names Iconoir controls and keeps an assistive label beside the icon", () => {
    render(
      <UiIconoirProvider>
        <NamedIconButton icon={<HomeSimple />} label="Abrir inicio" />
      </UiIconoirProvider>,
    );

    const button = screen.getByRole("button", { name: "Abrir inicio" });
    const descriptionId = button.getAttribute("aria-describedby");

    expect(button.getAttribute("aria-label")).toBe("Abrir inicio");
    expect(button.getAttribute("type")).toBe("button");
    expect(button.querySelector("svg")).not.toBeNull();
    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId ?? "")?.getAttribute("data-assistive-label")).toBe(
      "true",
    );
  });

  it("associates chart text equivalents with supplied values and unavailable states", () => {
    const chartId = "savings-chart";

    render(
      <>
        <div
          role="img"
          aria-label="Gráfica de ahorro"
          aria-describedby={chartDescriptionId(chartId)}
        />
        <ChartTextEquivalent
          chartId={chartId}
          title="Ahorro"
          seriesMeaning="Variación sintética por periodo."
          status="ready"
          points={syntheticFinanceExperienceModel.charts[0].points}
        />
      </>,
    );

    const equivalent = screen.getByRole("region", { name: "Ahorro" });
    expect(equivalent.getAttribute("id")).toBe(chartDescriptionId(chartId));
    expect(equivalent.getAttribute("data-chart-text-equivalent")).toBe("true");
    expect(equivalent.textContent).toContain("Variación sintética por periodo.");
    expect(equivalent.textContent).toContain("Enero");
    expect(equivalent.textContent).toContain("10 unidades");
    expect(screen.getByRole("img").getAttribute("aria-describedby")).toBe(
      chartDescriptionId(chartId),
    );
    cleanup();

    const { unmount } = render(
      <ChartTextEquivalent
        chartId="unavailable-chart"
        title="Rendimiento"
        seriesMeaning="Retorno del periodo."
        status="unavailable"
        message="No hay datos disponibles para mostrar."
      />,
    );

    expect(screen.getByText("No hay datos disponibles para mostrar.").textContent).toBe(
      "No hay datos disponibles para mostrar.",
    );
    expect(screen.queryByText("10 unidades")).toBeNull();
    unmount();
  });

  it("keeps icon and state markup stable for server rendering", () => {
    const markup = renderToStaticMarkup(
      <UiIconoirProvider>
        <FinanceSafeState state={lockedState} />
        <NamedIconButton icon={<HomeSimple />} label="Abrir inicio" />
      </UiIconoirProvider>,
    );

    expect(markup).toContain('data-finance-state="locked"');
    expect(markup).toContain('aria-label="Abrir inicio"');
    expect(markup).not.toMatch(/window|document|fetch|API_URL/);
  });
});
