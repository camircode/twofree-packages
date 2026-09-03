import { describe, expect, it, vi } from "vitest";

import {
  assertNonColorState,
  captureFinalStateSignature,
  requiredVisualVariants,
  settleVisualCapture,
  visualCaptureFileName,
  type VisualCapturePage,
} from "./visual-capture.js";

describe("deterministic visual evidence foundation", () => {
  it("defines exactly eight separate route and harness variants", () => {
    expect(requiredVisualVariants).toHaveLength(8);
    expect(requiredVisualVariants.map(({ name }) => name)).toEqual([
      "mobile-light-motion",
      "mobile-light-reduced",
      "mobile-dark-motion",
      "mobile-dark-reduced",
      "desktop-light-motion",
      "desktop-light-reduced",
      "desktop-dark-motion",
      "desktop-dark-reduced",
    ]);
    expect(visualCaptureFileName("route", requiredVisualVariants[0])).toBe(
      "route-mobile-light-motion.png",
    );
    expect(visualCaptureFileName("harness", requiredVisualVariants[7])).toBe(
      "harness-desktop-dark-reduced.png",
    );
  });

  it("emulates motion boundaries and freezes settled fonts, images, and animation frames", async () => {
    const page: VisualCapturePage = {
      emulateMedia: vi.fn(async () => undefined),
      evaluate: vi.fn(async () => undefined),
      waitForFunction: vi.fn(async () => undefined),
    };

    await settleVisualCapture(page, "reduced");
    await settleVisualCapture(page, "motion");

    expect(page.emulateMedia).toHaveBeenNthCalledWith(1, { reducedMotion: "reduce" });
    expect(page.emulateMedia).toHaveBeenNthCalledWith(2, { reducedMotion: "no-preference" });
    expect(page.evaluate).toHaveBeenCalledTimes(4);
    expect(String(vi.mocked(page.evaluate).mock.calls[0]?.[0])).toMatch(/animation|transition/);
    expect(page.waitForFunction).toHaveBeenCalledTimes(2);
  });

  it("captures headings, state markers, and chart equivalents as a final-state signature", () => {
    const root = document.createElement("main");
    root.innerHTML = `
      <h1>Resumen financiero</h1>
      <section data-finance-state="locked" data-state-label="Bloqueado" role="status">
        <span data-state-marker>!</span>
        <p>Autenticación requerida.</p>
      </section>
      <section data-chart-text-equivalent="true">
        <h2>Ahorro</h2>
        <p>Variación sintética por periodo.</p>
      </section>
    `;

    const signature = captureFinalStateSignature(root);

    expect(signature).toContain("Resumen financiero");
    expect(signature).toContain("data-finance-state");
    expect(signature).toContain("Ahorro");
  });

  it("requires non-color semantics for a visual state", () => {
    const safeState = document.createElement("section");
    safeState.setAttribute("role", "status");
    safeState.setAttribute("data-finance-state", "locked");
    safeState.textContent = "Bloqueado: autenticación requerida.";

    expect(() => assertNonColorState(safeState)).not.toThrow();

    const colorOnly = document.createElement("span");
    colorOnly.style.color = "red";
    colorOnly.textContent = " ";
    expect(() => assertNonColorState(colorOnly)).toThrow(/non-color/i);

    const glyphOnly = document.createElement("section");
    glyphOnly.setAttribute("role", "status");
    glyphOnly.setAttribute("data-state-label", "Bloqueado");
    glyphOnly.textContent = "!";
    expect(() => assertNonColorState(glyphOnly)).toThrow(/explanatory/i);
  });
});
