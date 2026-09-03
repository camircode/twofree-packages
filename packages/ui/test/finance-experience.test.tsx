import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FinanceExperience } from "@/components/finance-experience.js";
import {
  syntheticFinanceExperienceModel,
  syntheticReadyFinanceExperience,
} from "./fixtures/finance-experience";
import { assertNonColorState } from "./visual-capture.js";
import "@/styles/index.css";

afterEach(cleanup);

describe("reference-shaped FinanceExperience", () => {
  it("renders context, insight, stacked cards, and chart summaries", () => {
    render(<FinanceExperience state={syntheticReadyFinanceExperience} />);

    expect(screen.getByRole("heading", { name: "Tus finanzas, de un vistazo" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Periodo: Julio de 2026" })).not.toBeNull();
    expect(
      screen.getByRole("region", { name: "Tu progreso se mantiene en buen camino" }),
    ).not.toBeNull();
    expect(screen.getByRole("region", { name: "Cuentas" }).textContent).toContain(
      "Cuenta principal",
    );
    expect(screen.getByRole("region", { name: "Actividad reciente" }).textContent).toContain(
      "Aportación mensual",
    );
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("associates each responsive SVG with Spanish meaning and supplied values", () => {
    render(<FinanceExperience state={syntheticReadyFinanceExperience} />);

    for (const [title, meaning, value] of [
      ["Ahorro", "Variación del ahorro suministrada por periodo.", "18 unidades"],
      ["Rendimiento", "Retorno suministrado del periodo.", "12 unidades"],
      [
        "Presupuesto disponible",
        "Variación del presupuesto suministrada por periodo.",
        "11 unidades",
      ],
    ]) {
      const equivalent = screen.getByRole("region", { name: title });
      expect(equivalent.textContent).toContain(meaning);
      expect(equivalent.textContent).toContain(value);
      expect(
        equivalent.closest("article")?.querySelector('svg[viewBox="0 0 320 180"]'),
      ).not.toBeNull();
    }
  });

  it("keeps safe states and unavailable charts meaningful without color", () => {
    for (const [status, message] of [
      ["loading", "Cargando información financiera."],
      ["empty", "No hay datos financieros disponibles."],
      ["error", "No se pudo mostrar la información financiera."],
      ["unavailable", "La información financiera no está disponible."],
    ] as const) {
      const { unmount } = render(<FinanceExperience state={{ status, message }} />);
      const state = screen.getByRole(status === "error" ? "alert" : "status");
      expect(state.textContent).toContain(message);
      expect(state.getAttribute("data-finance-state")).toBe(status);
      expect(() => assertNonColorState(state)).not.toThrow();
      unmount();
    }

    render(
      <FinanceExperience
        state={{
          status: "ready",
          model: {
            ...syntheticFinanceExperienceModel,
            charts: [
              {
                id: "unavailable-savings",
                title: "Ahorro",
                seriesMeaning: "Variación del ahorro suministrada por periodo.",
                visual: "bars",
                status: "unavailable",
                message: "No hay datos disponibles.",
              },
            ],
          },
        }}
      />,
    );
    const chart = screen.getByRole("region", { name: "Ahorro" });
    expect(chart.textContent).toContain("No hay datos disponibles.");
    expect(chart.closest("article")?.querySelector("svg")).toBeNull();
    expect(chart.textContent).not.toContain("unidades");
  });

  it("keeps D3 presentation free of fetching, sensitive fields, and domain arithmetic", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/finance-experience.tsx"),
      "utf8",
    );

    expect(source).toMatch(/d3-array|d3-scale|d3-shape/);
    expect(source).not.toMatch(/\b(fetch|parseFloat|parseInt|BigInt|Intl|Math\.)\b/);
    expect(source).not.toMatch(/card[- ]?number|prisma|postgres|localStorage/i);
  });
});
