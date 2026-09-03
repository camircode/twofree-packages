import { cleanup, render } from "@testing-library/react";
import { type ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import {
  AppShell,
  FinanceDashboard,
  type DashboardModel,
  type NavigationItem,
  useScopedMotion,
  type ScopedMotionContext,
} from "@camircode/twofree-ui";
import "@/styles/index.css";

const navigation: readonly NavigationItem[] = [
  { id: "overview", label: "Resumen" },
  { id: "activity", label: "Actividad" },
  { id: "settings", label: "Configuración" },
];

const longNavigation: readonly NavigationItem[] = [
  { id: "overview", label: "Inicio" },
  { id: "activity", label: "Movimientos y transacciones" },
  { id: "settings", label: "Configuración de seguridad" },
  { id: "planning", label: "Planificación financiera" },
];

const money = {
  exact: { currency: "USD", coefficient: "123456789012345678901234567890", scale: 2 },
  formatted: { currency: "USD", text: "$1,234.56" },
} as const;

const dashboardModel: DashboardModel = {
  balance: money,
  trendOrAllocation: {
    kind: "allocation",
    label: "Distribución de gastos",
    summary: "La vivienda concentra la mayor parte de los datos proporcionados.",
    values: [
      { label: "Vivienda y servicios", value: money },
      {
        label: "Ahorro para objetivos a largo plazo",
        value: {
          exact: { currency: "USD", coefficient: "200", scale: 2 },
          formatted: { currency: "USD", text: "$2.00" },
        },
      },
    ],
  },
  activity: [
    { id: "supermercado", label: "Supermercado del barrio", date: "2026-07-20", value: money },
  ],
};

function queryElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Expected element for selector: ${selector}`);
  return element;
}

function ShellWithDashboard({ children }: { children?: ReactNode }) {
  return (
    <AppShell activeItemId="overview" navigation={navigation} onNavigate={() => undefined}>
      {children ?? <FinanceDashboard state={{ status: "ready", model: dashboardModel }} />}
    </AppShell>
  );
}

type MotionBoxProps = Readonly<{
  value: number;
  onAnimate: (context: ScopedMotionContext) => void;
}>;

function MotionBox({ onAnimate, value }: MotionBoxProps) {
  const ref = useScopedMotion<HTMLDivElement>({
    dependencies: [value],
    animate: (context) => {
      onAnimate(context);
      context.gsap.set(".motion-target", { opacity: value });
    },
  });

  return (
    <div ref={ref} data-motion-root>
      <span className="motion-target">{value}</span>
    </div>
  );
}

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe("Chromium app-shell verification", () => {
  it("activates navigation with native Enter and Space keyboard input", async () => {
    const onNavigate = vi.fn();
    await page.viewport(1280, 800);
    render(
      <AppShell activeItemId="overview" navigation={navigation} onNavigate={onNavigate}>
        <h1>Overview</h1>
      </AppShell>,
    );
    const desktopNavigation = document.querySelector('[data-navigation-variant="secondary"]');
    if (!desktopNavigation) throw new Error("Expected desktop navigation");
    const buttons = [
      ...desktopNavigation.querySelectorAll<HTMLButtonElement>(".ui-shell__navigation-item"),
    ];
    const activity = buttons.find((button) => button.textContent?.trim() === "Actividad");
    const settings = buttons.find((button) => button.textContent?.trim() === "Configuración");
    if (!activity || !settings) throw new Error("Expected navigation buttons");

    activity.focus();
    expect(document.activeElement).toBe(activity);
    await userEvent.keyboard("{Enter}");
    settings.focus();
    expect(document.activeElement).toBe(settings);
    await userEvent.keyboard("{Space}");

    expect(onNavigate).toHaveBeenNthCalledWith(1, "activity");
    expect(onNavigate).toHaveBeenNthCalledWith(2, "settings");
  });

  it("reports computed wide and narrow shell and dashboard layouts", async () => {
    render(<ShellWithDashboard />);

    await page.viewport(1280, 900);
    expect(getComputedStyle(queryElement(".ui-shell__layout")).display).toBe("grid");
    expect(getComputedStyle(queryElement(".ui-shell__layout")).maxWidth).not.toBe("none");
    expect(getComputedStyle(queryElement(".ui-shell__header-navigation")).display).toBe("flex");
    expect(document.querySelector(".ui-shell__sidebar")).toBeNull();
    expect(getComputedStyle(queryElement(".ui-shell__mobile-navigation")).display).toBe("none");
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    expect(document.documentElement.scrollWidth).toBe(document.documentElement.clientWidth);
    expect(getComputedStyle(queryElement(".ui-shell__main")).display).toBe("grid");
    expect(
      getComputedStyle(queryElement(".ui-shell__main")).gridTemplateColumns.split(" "),
    ).toHaveLength(12);
    expect(getComputedStyle(queryElement('[data-dashboard-layout="desktop"]')).display).toBe(
      "block",
    );
    expect(getComputedStyle(queryElement('[data-dashboard-layout="compact"]')).display).toBe(
      "none",
    );

    await page.viewport(480, 800);
    expect(getComputedStyle(queryElement(".ui-shell__layout")).display).toBe("block");
    expect(getComputedStyle(queryElement(".ui-shell__header-navigation")).display).toBe("none");
    expect(document.querySelector(".ui-shell__sidebar")).toBeNull();
    expect(getComputedStyle(queryElement(".ui-shell__mobile-navigation")).display).toBe("grid");
    expect(document.documentElement.scrollWidth).toBe(document.documentElement.clientWidth);
    expect(getComputedStyle(queryElement(".ui-shell__main")).display).toBe("block");
    expect(getComputedStyle(queryElement('[data-dashboard-layout="desktop"]')).display).toBe(
      "none",
    );
    expect(getComputedStyle(queryElement('[data-dashboard-layout="compact"]')).display).toBe(
      "block",
    );
  });

  it("keeps the fixed mobile navigation reachable without obscuring main content", async () => {
    render(
      <AppShell activeItemId="overview" navigation={navigation} onNavigate={() => undefined}>
        <p>Contenido principal</p>
      </AppShell>,
    );

    await page.viewport(390, 844);

    const mobileNavigation = queryElement(".ui-shell__mobile-navigation");
    const mobileItems = mobileNavigation.querySelectorAll(".ui-shell__navigation-item");
    const main = queryElement(".ui-shell__main");

    expect(getComputedStyle(mobileNavigation).position).toBe("fixed");
    expect(getComputedStyle(mobileNavigation).insetBlockEnd).toBe("0px");
    expect(mobileItems).toHaveLength(navigation.length);
    expect(parseFloat(getComputedStyle(main).paddingBottom)).toBeGreaterThan(0);
    expect(getComputedStyle(mobileItems[0] as HTMLElement).minBlockSize).toBe("48px");
    expect(document.documentElement.scrollWidth).toBe(document.documentElement.clientWidth);
  });

  it("keeps long Spanish labels inside thumb navigation without horizontal overflow", async () => {
    render(
      <AppShell activeItemId="overview" navigation={longNavigation} onNavigate={() => undefined}>
        <h1>Resumen</h1>
      </AppShell>,
    );

    await page.viewport(390, 844);

    const mobileNavigation = queryElement(".ui-shell__mobile-navigation");
    const mobileItems = [...mobileNavigation.querySelectorAll<HTMLButtonElement>("button")];

    expect(mobileItems).toHaveLength(longNavigation.length);
    expect(document.documentElement.scrollWidth).toBe(document.documentElement.clientWidth);
    expect(document.body.scrollWidth).toBe(document.body.clientWidth);
    expect(mobileItems.every((item) => item.getBoundingClientRect().right <= 390)).toBe(true);
    expect(mobileItems.map((item) => item.textContent)).toEqual(
      longNavigation.map((item) => item.label),
    );
  });

  it("keeps the theme Iconoir control keyboard operable and named", async () => {
    const onThemeToggle = vi.fn();
    render(
      <AppShell
        activeItemId="overview"
        navigation={navigation}
        onNavigate={() => undefined}
        onThemeToggle={onThemeToggle}
        theme="light"
      >
        <h1>Resumen</h1>
      </AppShell>,
    );

    await page.viewport(390, 844);

    const toggle = document.querySelector<HTMLButtonElement>('[data-theme-toggle="true"]');
    if (!toggle) throw new Error("Expected named theme control");

    toggle.focus();
    expect(document.activeElement).toBe(toggle);
    expect(toggle.getAttribute("aria-label")).toBe("Usar modo oscuro");
    expect(toggle.getAttribute("aria-describedby")).toBeTruthy();
    expect(toggle.querySelector("svg")).not.toBeNull();
    await userEvent.keyboard("{Enter}");
    expect(onThemeToggle).toHaveBeenCalledOnce();
  });

  it("opens the secondary navigation without clipping it inside the header", async () => {
    render(
      <AppShell
        activeItemId="overview"
        navigation={navigation}
        secondaryNavigation={[
          { id: "alertas", label: "Alertas" },
          { id: "portabilidad", label: "Portabilidad" },
        ]}
      >
        <h1>Resumen</h1>
      </AppShell>,
    );

    await page.viewport(1280, 800);
    const summary = queryElement<HTMLElement>(".ui-shell__more--desktop > summary");
    await userEvent.click(summary);

    const menu = queryElement<HTMLElement>(
      '.ui-shell__more--desktop > [data-navigation-variant="desktop"]',
    );
    const bounds = menu.getBoundingClientRect();

    expect(getComputedStyle(queryElement(".ui-shell__header-navigation")).overflow).toBe("visible");
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
    expect(bounds.right).toBeLessThanOrEqual(window.innerWidth);
    expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight);
  });

  it("resolves shell surfaces and active semantics in light and dark themes", async () => {
    const onNavigate = vi.fn();
    const { rerender } = render(
      <div data-theme="light">
        <AppShell activeItemId="overview" navigation={navigation} onNavigate={onNavigate}>
          <p>Contenido principal</p>
        </AppShell>
      </div>,
    );

    await page.viewport(1280, 800);
    const lightSurface = getComputedStyle(queryElement(".ui-shell")).backgroundColor;
    expect(
      queryElement('[data-navigation-variant="secondary"] .ui-shell__navigation-item').getAttribute(
        "aria-current",
      ),
    ).toBe("page");

    rerender(
      <div data-theme="dark">
        <AppShell activeItemId="overview" navigation={navigation} onNavigate={onNavigate}>
          <p>Contenido principal</p>
        </AppShell>
      </div>,
    );

    const darkSurface = getComputedStyle(queryElement(".ui-shell")).backgroundColor;
    expect(darkSurface).not.toBe(lightSurface);
    expect(
      queryElement('[data-navigation-variant="secondary"] .ui-shell__navigation-item').getAttribute(
        "aria-current",
      ),
    ).toBe("page");
  });

  it("hydrates a motion component on the client without hydration errors", async () => {
    const onAnimate = vi.fn();
    const element = <MotionBox value={1} onAnimate={onAnimate} />;
    const markup = renderToString(<MotionBox value={1} onAnimate={() => undefined} />);
    const host = document.createElement("div");
    host.innerHTML = markup;
    document.body.append(host);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      root = hydrateRoot(host, element);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(host.querySelector("[data-motion-root]")).not.toBeNull();
      expect(host.querySelector(".motion-target")?.textContent).toBe("1");
      expect(onAnimate).toHaveBeenCalledOnce();
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      root?.unmount();
      consoleError.mockRestore();
    }
  });
});
