import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusMessage } from "@/components/status.js";
import "@/styles/index.css";

const statusCases = [
  { tone: "success", label: "Éxito", symbol: "✓", role: "status" },
  { tone: "warning", label: "Advertencia", symbol: "!", role: "status" },
  { tone: "danger", label: "Error", symbol: "×", role: "alert" },
  { tone: "neutral", label: "Información", symbol: "i", role: "status" },
] as const;

describe("semantic themes and status foundations", () => {
  it("defines light and dark semantic tokens, focus, and reduced motion", () => {
    const styles = ["index.css", "themes.css", "foundation.css", "reduced-motion.css", "status.css"]
      .map((file) => readFileSync(resolve(process.cwd(), "src/styles", file), "utf8"))
      .join("\n");

    expect(styles).toContain(":root");
    expect(styles).toContain('[data-theme="light"]');
    expect(styles).toContain('[data-theme="dark"]');
    expect(styles).toContain("--surface-canvas");
    expect(styles).toContain("--surface-panel");
    expect(styles).toContain("--color-status-success");
    expect(styles).toContain("--color-status-warning");
    expect(styles).toContain("--color-status-danger");
    expect(styles).toContain("--color-status-neutral");
    expect(styles).toContain("--focus-ring");
    expect(styles).toContain("focus-visible");
    expect(styles).toContain("prefers-reduced-motion: reduce");
    expect(styles).toContain("[data-motion-settled]");
    expect(styles).toContain("animation: none !important");
  });

  it("communicates every status with visible text and a semantic marker", () => {
    render(
      <div>
        {statusCases.map(({ tone, label }) => (
          <StatusMessage key={tone} tone={tone}>
            {label} details
          </StatusMessage>
        ))}
      </div>,
    );

    for (const { label, symbol, role } of statusCases) {
      const status = screen.getByRole(role, { name: `${label} ${label} details` });
      expect(status.textContent).toContain(label);
      expect(status.textContent).toContain(symbol);
      expect(status.querySelector("[data-status-marker]")).not.toBeNull();
      expect(status.getAttribute("aria-live")).toBe(role === "alert" ? "assertive" : "polite");
    }
  });

  it("resolves selected themes, focus, and packaged-font fallbacks at runtime", () => {
    const { rerender } = render(
      <div data-theme="dark">
        <button type="button">Focus target</button>
        <span className="ui-status__label">Readable fallback text</span>
      </div>,
    );
    const themed = screen.getByText("Readable fallback text").parentElement as HTMLElement;
    const button = screen.getByRole("button", { name: "Focus target" });
    const styles = readFileSync(resolve(process.cwd(), "src/styles/themes.css"), "utf8");
    const foundation = readFileSync(resolve(process.cwd(), "src/styles/foundation.css"), "utf8");
    const typography = readFileSync(resolve(process.cwd(), "src/styles/typography.css"), "utf8");

    expect(themed.dataset.theme).toBe("dark");
    expect(styles).toContain('[data-theme="dark"]');
    expect(styles).toContain("--surface-canvas: #1d1917");
    expect(styles).toContain('[data-theme="light"]');
    expect(styles).toContain("--surface-canvas: #fffdf8");
    expect(foundation).toContain("focus-visible");
    expect(typography).toContain("--font-body");
    expect(typography).toContain('@import "@fontsource-variable/open-sans"');
    expect(typography).not.toMatch(/https?:\/\//);
    expect(screen.getByText("Readable fallback text").textContent).toContain("Readable");
    button.focus();
    expect(document.activeElement).toBe(button);

    rerender(
      <div data-theme="light">
        <button type="button">Focus target</button>
        <span className="ui-status__label">Readable fallback text</span>
      </div>,
    );
    expect(
      (screen.getByText("Readable fallback text").parentElement as HTMLElement).dataset.theme,
    ).toBe("light");
  });
});
