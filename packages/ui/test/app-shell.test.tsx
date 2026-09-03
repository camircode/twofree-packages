import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import gsap from "gsap";
import { hydrateRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell, type NavigationItem } from "@/components/app-shell.js";
import "@/styles/index.css";

const navigation: readonly NavigationItem[] = [
  { id: "overview", label: "Resumen" },
  { id: "activity", label: "Actividad" },
  { id: "settings", label: "Configuración" },
  { id: "help", label: "Ayuda", disabled: true },
];

function renderShell(onNavigate = vi.fn()) {
  render(
    <AppShell
      actions={<button type="button">Perfil</button>}
      activeItemId="overview"
      brand={<span>2 Free</span>}
      navigation={navigation}
      onNavigate={onNavigate}
    >
      <h1>Resumen</h1>
      <p>Resumen de finanzas personales</p>
    </AppShell>,
  );
  return onNavigate;
}

describe("consumer-composed AppShell", () => {
  afterEach(cleanup);

  it("exposes named landmarks, active semantics, and consumer actions", () => {
    const onNavigate = renderShell();
    const desktopNavigation = screen.getByRole("navigation", { name: "Navegación principal" });
    const mobileNavigation = screen.getByRole("navigation", { name: "Navegación móvil" });

    expect(screen.getByRole("banner")).not.toBeNull();
    expect(screen.queryByRole("complementary", { name: "Navegación lateral" })).toBeNull();
    expect(screen.getByRole("banner").contains(desktopNavigation)).toBe(true);
    expect(screen.getByRole("main").textContent).toContain("Resumen de finanzas personales");
    expect(
      within(desktopNavigation)
        .getByRole("button", { name: "Resumen" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      within(mobileNavigation)
        .getByRole("button", { name: "Resumen" })
        .getAttribute("aria-current"),
    ).toBe("page");

    within(desktopNavigation).getByRole("button", { name: "Actividad" }).click();
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(onNavigate).toHaveBeenCalledWith("activity");
  });

  it("renders the theme action as a named Iconoir control", () => {
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

    const toggle = screen.getByRole("button", { name: "Usar modo oscuro" });
    const descriptionId = toggle.getAttribute("aria-describedby");

    expect(toggle.getAttribute("aria-label")).toBe("Usar modo oscuro");
    expect(toggle.querySelector("svg")).not.toBeNull();
    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId ?? "")?.textContent).toBe("Usar modo oscuro");

    fireEvent.click(toggle);
    expect(onThemeToggle).toHaveBeenCalledOnce();
  });

  it("keeps shell-owned safe-area and balanced-column contracts explicit", () => {
    const source = readFileSync(resolve(process.cwd(), "src/styles/app-shell.css"), "utf8");

    expect(source).toContain("env(safe-area-inset-bottom");
    expect(source).toContain("grid-template-columns: repeat(12, minmax(0, 1fr))");
    expect(source).toContain("view-transition-name: app-header");
    expect(source).toContain("view-transition-name: app-mobile-navigation");
    expect(source).not.toContain("minmax(14rem, 17rem)");
    expect(source).toContain("overflow-wrap: anywhere");
  });

  it("does not start a second View Transition for native links", () => {
    const startViewTransition = vi.fn();
    const previous = Object.getOwnPropertyDescriptor(document, "startViewTransition");
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    });
    const onNavigate = vi.fn();

    try {
      render(
        <AppShell
          navigation={[{ id: "activity", label: "Actividad", href: "/transacciones" }]}
          onNavigate={onNavigate}
        >
          <h1>Resumen</h1>
        </AppShell>,
      );
      const link = within(
        screen.getByRole("navigation", { name: "Navegación principal" }),
      ).getByRole("link", { name: "Actividad" });
      link.addEventListener("click", (event) => event.preventDefault(), { once: true });

      fireEvent.click(link);

      expect(onNavigate).toHaveBeenCalledWith("activity");
      expect(startViewTransition).not.toHaveBeenCalled();
    } finally {
      if (previous) Object.defineProperty(document, "startViewTransition", previous);
      else Reflect.deleteProperty(document, "startViewTransition");
    }
  });

  it("staggers the direct sections inside the active route", async () => {
    const fromTo = vi.spyOn(gsap, "fromTo");
    try {
      render(
        <AppShell navigation={navigation}>
          <section>
            <div>
              <div>
                <div>Encabezado</div>
                <div>Resumen</div>
                <div>Actividad</div>
              </div>
            </div>
          </section>
        </AppShell>,
      );

      await waitFor(() => {
        expect(
          fromTo.mock.calls.some(
            ([targets, , options]) =>
              Array.isArray(targets) &&
              targets.length === 3 &&
              typeof (options as { stagger?: unknown }).stagger === "number" &&
              ((options as { stagger: number }).stagger ?? 0) > 0,
          ),
        ).toBe(true);
      });
    } finally {
      fromTo.mockRestore();
    }
  });

  it("keeps a deterministic keyboard order and a narrow operable navigation layout", () => {
    const onNavigate = renderShell();

    const controls = [
      within(screen.getByRole("navigation", { name: "Navegación principal" })).getByRole("button", {
        name: "Resumen",
      }),
      within(screen.getByRole("navigation", { name: "Navegación principal" })).getByRole("button", {
        name: "Actividad",
      }),
      within(screen.getByRole("navigation", { name: "Navegación principal" })).getByRole("button", {
        name: "Configuración",
      }),
      screen.getByRole("button", { name: "Perfil" }),
    ];

    for (const control of controls) {
      control.focus();
      expect(document.activeElement).toBe(control);
    }

    const activity = controls[1];
    activity.focus();
    fireEvent.click(activity);
    expect(onNavigate).toHaveBeenCalledWith("activity");
    expect(document.activeElement).toBe(activity);
    const disabled = within(
      screen.getByRole("navigation", { name: "Navegación principal" }),
    ).getByRole("button", { name: "Ayuda" });
    expect((disabled as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(disabled);
    expect(onNavigate).not.toHaveBeenCalledWith("help");
    expect(readFileSync(resolve(process.cwd(), "src/styles/foundation.css"), "utf8")).toContain(
      "focus-visible",
    );

    expect(
      screen
        .getByRole("navigation", { name: "Navegación principal" })
        .getAttribute("data-responsive"),
    ).toBe("true");
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 320 });
    expect(readFileSync(resolve(process.cwd(), "src/styles/app-shell.css"), "utf8")).toContain(
      "@media (max-width: 64rem)",
    );
  });

  it("hydrates without React mismatches while motion enhances the markup", async () => {
    const element = (
      <AppShell activeItemId="overview" navigation={navigation} onNavigate={() => undefined}>
        <h1>Resumen</h1>
      </AppShell>
    );
    const markup = renderToStaticMarkup(element);
    const host = document.createElement("div");
    host.innerHTML = markup;
    document.body.append(host);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const actEnvironment = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    };
    const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    let root: ReturnType<typeof hydrateRoot> | undefined;

    await act(async () => {
      root = hydrateRoot(host, element);
    });

    expect(host.querySelector("h1")?.textContent).toBe("Resumen");
    expect(consoleError).not.toHaveBeenCalled();
    root?.unmount();
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    consoleError.mockRestore();
    host.remove();
  });

  it("renders deterministic landmarks without browser globals during SSR", () => {
    const element = (
      <AppShell activeItemId="overview" navigation={navigation} onNavigate={() => undefined}>
        <h1>Resumen</h1>
      </AppShell>
    );
    const expectedMarkup = renderToStaticMarkup(element);
    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
    const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");

    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "document");
    let markup: string;
    try {
      markup = renderToStaticMarkup(element);
    } finally {
      if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
      if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor);
    }

    expect(markup).toContain('<nav aria-label="Navegación principal"');
    expect(markup).toContain('<nav aria-label="Navegación móvil"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain("<main");
    expect(markup).toBe(expectedMarkup);
  });
});
