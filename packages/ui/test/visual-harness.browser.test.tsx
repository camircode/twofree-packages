import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { AppShell, FinanceExperience, type NavigationItem } from "@camircode/twofree-ui";
import { syntheticReadyFinanceExperience } from "./fixtures/finance-experience";
import {
  assertNonColorState,
  captureFinalStateSignature,
  requiredVisualVariants,
  settleBrowserVisualCapture,
  visualCaptureBaseName,
  visualCaptureFileName,
  type VisualVariant,
} from "./visual-capture.js";
import "@/styles/index.css";

const logoUrl = new URL("../src/assets/2free-con-fondi.svg", import.meta.url).href;
const finalSignatures = new Map<string, string>();

const navigation: readonly NavigationItem[] = [
  { id: "overview", label: "Resumen" },
  { id: "activity", label: "Actividad" },
  { id: "planning", label: "Planificación" },
  { id: "settings", label: "Configuración" },
];

function queryElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Expected element for selector: ${selector}`);
  return element;
}

function VisualComposition({ variant }: { variant: VisualVariant }) {
  return (
    <div
      style={{
        blockSize: `${variant.height}px`,
        inlineSize: `${variant.width - (variant.viewport === "mobile" ? 0.5 : 0)}px`,
      }}
      data-theme={variant.theme}
      data-motion={variant.motion === "reduced" ? "reduced" : "enabled"}
      data-motion-settled="true"
      data-visual-surface="harness"
      data-visual-variant={variant.name}
      data-testid={`visual-root-${variant.name}`}
    >
      <AppShell
        activeItemId="overview"
        brand={<img src={logoUrl} alt="Logotipo de 2 Free" />}
        navigation={navigation}
        onNavigate={() => undefined}
      >
        <FinanceExperience state={syntheticReadyFinanceExperience} />
      </AppShell>
    </div>
  );
}

async function assertVisualVariant(variant: VisualVariant) {
  await page.viewport(variant.width, variant.height);
  render(<VisualComposition variant={variant} />);
  await settleBrowserVisualCapture(variant.motion);

  const root = queryElement<HTMLElement>(`[data-visual-variant="${variant.name}"]`);
  const body = queryElement<HTMLElement>(".ui-finance-experience__body");
  const chart = queryElement<HTMLElement>('[data-finance-slot="charts"]');
  const account = queryElement<HTMLElement>('[data-finance-slot="accounts"]');
  const activity = queryElement<HTMLElement>('[data-finance-slot="activity"]');
  const signature = captureFinalStateSignature(root).replace(
    /data-motion=(?:enabled|reduced)/gu,
    "data-motion=settled",
  );
  const parityKey = `${variant.viewport}-${variant.theme}`;

  expect([window.innerWidth, window.innerHeight]).toEqual([variant.width, variant.height]);
  expect(root.dataset.visualSurface).toBe("harness");
  expect(root.dataset.motionSettled).toBe("true");
  expect(getComputedStyle(root).animationName).toBe("none");
  expect(getComputedStyle(root).overflow).toBe("visible");
  expect(queryElement('.ui-shell__brand img[alt="Logotipo de 2 Free"]')).not.toBeNull();
  expect(queryElement("main")).not.toBeNull();
  expect(queryElement('[aria-label="Navegación principal"]')).not.toBeNull();
  expect(queryElement('[aria-label="Navegación móvil"]')).not.toBeNull();
  expect(queryElement("h1").textContent).toBe("Tus finanzas, de un vistazo");
  expect(queryElement('[data-finance-slot="insight"]').textContent).toContain(
    "Perspectiva del mes",
  );
  expect(account.textContent).toContain("Cuenta principal");
  expect(chart.textContent).toContain("Variación del ahorro suministrada por periodo.");
  expect(chart.querySelectorAll('svg[viewBox="0 0 320 180"]')).toHaveLength(3);
  expect(activity.textContent).toContain("Aportación mensual");
  expect(document.body.textContent).not.toMatch(/card[- ]?number|prisma|postgres/i);
  expect(document.querySelector("table")).toBeNull();
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  expect(document.documentElement.scrollHeight).toBeGreaterThan(window.innerHeight);
  assertNonColorState(queryElement('[data-account-status="ready"]'));
  expect(getComputedStyle(body).display).toBe("grid");
  if (variant.width === 390) {
    expect(getComputedStyle(account).gridColumn).toBe("auto");
    expect(getComputedStyle(chart).gridColumn).toBe("auto");
  } else {
    expect(getComputedStyle(account).gridColumn).toBe("span 4");
    expect(getComputedStyle(chart).gridColumn).toBe("span 8");
  }

  if (variant.motion === "motion") finalSignatures.set(parityKey, signature);
  else expect(signature).toBe(finalSignatures.get(parityKey));

  await expect
    .element(page.elementLocator(root))
    .toMatchScreenshot(visualCaptureBaseName("harness", variant), {
      comparatorName: "pixelmatch",
      comparatorOptions: { allowedMismatchedPixelRatio: 0.001, threshold: 0.1 },
      screenshotOptions: { scale: "css" } as never,
    });
  await page.screenshot({
    element: root,
    ...({ scale: "css" } as object),
    path: `../../../artifacts/visual/mobile-first-finance-experience/harness/${visualCaptureFileName("harness", variant)}`,
  });
}

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe("deterministic Spanish FinanceExperience harness", () => {
  it("defines exactly the required eight Cartesian variants for the harness", () => {
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
  });

  it.each(requiredVisualVariants)("captures the settled harness $name", async (variant) => {
    await assertVisualVariant(variant);
  });
});
