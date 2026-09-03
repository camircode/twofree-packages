import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { FinanceDashboard } from "@camircode/twofree-ui";
import { spanishDashboardStates } from "./fixtures/spanish-dashboard";
import "@/styles/index.css";

function queryElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Expected element for selector: ${selector}`);
  return element;
}

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe("Chromium Spanish dashboard verification", () => {
  it("keeps long Spanish labels readable without mobile horizontal overflow", async () => {
    render(
      <div data-theme="light">
        <FinanceDashboard state={spanishDashboardStates.ready} />
      </div>,
    );

    await page.viewport(390, 844);

    const dashboard = queryElement<HTMLElement>(".ui-dashboard");
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    expect(dashboard.scrollWidth).toBeLessThanOrEqual(dashboard.clientWidth);
    expect(queryElement('[data-dashboard-layout="desktop"]').getClientRects()).toHaveLength(0);
    expect(
      queryElement('[data-dashboard-layout="compact"]').getClientRects().length,
    ).toBeGreaterThan(0);
    expect(queryElement(".ui-dashboard__balance").textContent).toContain("$1,234.56");
  });

  it("uses an intentional desktop dashboard composition and preserves dark surfaces", async () => {
    const { rerender } = render(
      <div data-theme="light">
        <FinanceDashboard state={spanishDashboardStates.ready} />
      </div>,
    );

    await page.viewport(1280, 900);

    const lightSurface = getComputedStyle(queryElement(".ui-dashboard__balance")).backgroundColor;
    expect(getComputedStyle(queryElement(".ui-dashboard__overview")).display).toBe("grid");
    expect(getComputedStyle(queryElement('[data-dashboard-layout="desktop"]')).display).toBe(
      "block",
    );
    expect(getComputedStyle(queryElement('[data-dashboard-layout="compact"]')).display).toBe(
      "none",
    );
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);

    rerender(
      <div data-theme="dark">
        <FinanceDashboard state={spanishDashboardStates.ready} />
      </div>,
    );

    const darkSurface = getComputedStyle(queryElement(".ui-dashboard__balance")).backgroundColor;
    expect(darkSurface).not.toBe(lightSurface);
    expect(queryElement(".ui-dashboard__data").textContent).toContain("Distribución de gastos");
  });
});
