"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  Activity,
  Bell,
  CloudUpload,
  Community,
  CreditCard,
  HalfMoon,
  HomeSimple,
  InfoCircle,
  MoreHoriz,
  Reports,
  Settings,
  SunLight,
  Wallet,
} from "iconoir-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { IconoirProvider, NamedIconButton } from "./icon-control";
import { getMotionCapabilities } from "../motion/capabilities";

gsap.registerPlugin(useGSAP);

type DocumentWithActiveViewTransition = Document &
  Readonly<{ activeViewTransition?: Readonly<{ finished: PromiseLike<unknown> }> }>;

export type NavigationItem = Readonly<{
  id: string;
  label: string;
  href?: string;
  disabled?: boolean;
  icon?: ReactNode;
}>;

export type AppShellProps = Readonly<{
  navigation: readonly NavigationItem[];
  secondaryNavigation?: readonly NavigationItem[];
  mobileNavigation?: readonly NavigationItem[];
  activeItemId?: string;
  onNavigate?: (itemId: string) => void;
  brand?: ReactNode;
  actions?: ReactNode;
  theme?: "dark" | "light";
  onThemeToggle?: () => void;
  children: ReactNode;
}>;

const defaultNavigationIcons: Readonly<Record<string, ReactNode>> = {
  activity: <Activity />,
  alertas: <Bell />,
  ajustes: <Settings />,
  compartido: <Community />,
  compartidos: <Community />,
  cuentas: <Wallet />,
  help: <InfoCircle />,
  inicio: <HomeSimple />,
  overview: <HomeSimple />,
  planning: <Reports />,
  mas: <MoreHoriz />,
  presupuesto: <Reports />,
  portabilidad: <CloudUpload />,
  settings: <Settings />,
  tarjetas: <CreditCard />,
  transacciones: <Activity />,
};

function navigationIcon(item: NavigationItem): ReactNode {
  return item.icon ?? defaultNavigationIcons[item.id] ?? null;
}

function Navigation({
  items,
  activeItemId,
  onNavigate,
  variant,
}: Pick<AppShellProps, "activeItemId" | "onNavigate"> & {
  items: readonly NavigationItem[];
  variant: "desktop" | "mobile" | "secondary";
}) {
  const isMobile = variant === "mobile";

  return (
    <nav
      aria-label={
        isMobile
          ? "Navegación móvil"
          : variant === "desktop"
            ? "Secciones del producto"
            : "Navegación principal"
      }
      data-navigation-variant={variant}
      data-responsive="true"
      className={`ui-shell__navigation ui-shell__navigation--${variant}`}
    >
      <ul className="ui-shell__navigation-list">
        {items.map((item) => {
          const isActive = item.id === activeItemId;
          const icon = navigationIcon(item);

          const content = (
            <>
              {icon ? (
                <span aria-hidden="true" className="ui-shell__navigation-icon">
                  {icon}
                </span>
              ) : null}
              <span className="ui-shell__navigation-label">{item.label}</span>
            </>
          );

          return (
            <li key={item.id}>
              {item.href && !item.disabled ? (
                <a
                  className="ui-shell__navigation-item"
                  aria-current={isActive ? "page" : undefined}
                  href={item.href}
                  onClick={() => onNavigate?.(item.id)}
                >
                  {content}
                </a>
              ) : (
                <button
                  type="button"
                  className="ui-shell__navigation-item"
                  aria-current={isActive ? "page" : undefined}
                  disabled={item.disabled}
                  onClick={() => onNavigate?.(item.id)}
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function MoreNavigation({
  activeItemId,
  items,
  onNavigate,
  variant,
}: Pick<AppShellProps, "activeItemId" | "onNavigate"> & {
  items: readonly NavigationItem[];
  variant: "desktop" | "mobile";
}) {
  if (items.length === 0) return null;
  const hasActiveItem = items.some((item) => item.id === activeItemId);
  return (
    <details className={`ui-shell__more ui-shell__more--${variant}`}>
      <summary aria-current={hasActiveItem ? "page" : undefined} aria-label="Abrir más secciones">
        <span aria-hidden="true" className="ui-shell__navigation-icon">
          <MoreHoriz />
        </span>
        <span className="ui-shell__navigation-label">Más</span>
      </summary>
      <Navigation
        activeItemId={activeItemId}
        items={items}
        onNavigate={onNavigate}
        variant="desktop"
      />
    </details>
  );
}

export function AppShell({
  actions,
  activeItemId,
  brand = "2 Free",
  children,
  mobileNavigation,
  navigation,
  onNavigate,
  onThemeToggle,
  secondaryNavigation = [],
  theme = "light",
}: AppShellProps) {
  const mobileItems = mobileNavigation ?? navigation;
  const mobilePrimaryItems = mobileItems.filter((item) => item.id !== "mas");
  const shellRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const mainId = useId();
  const previousActiveItemId = useRef(activeItemId);
  const [motionReady, setMotionReady] = useState(false);

  useEffect(() => setMotionReady(true), []);

  useEffect(() => {
    if (previousActiveItemId.current !== activeItemId && document.activeElement === document.body) {
      mainRef.current?.focus();
    }
    previousActiveItemId.current = activeItemId;
  }, [activeItemId]);

  useGSAP(
    (_context, contextSafe) => {
      if (!motionReady || getMotionCapabilities().reducedMotion) return;
      const route = mainRef.current?.firstElementChild;
      if (!route) return;
      let motionRoot = route;
      for (let depth = 0; depth < 3 && motionRoot.children.length === 1; depth += 1) {
        motionRoot = motionRoot.firstElementChild ?? motionRoot;
      }
      const targets = motionRoot.children.length ? Array.from(motionRoot.children) : [motionRoot];
      const stagger = targets.length > 1 ? Math.min(0.07, 0.18 / (targets.length - 1)) : 0;
      const animateRoute = () => {
        if (targets.some((target) => !target.isConnected)) return;
        gsap.fromTo(
          targets,
          { autoAlpha: 0.42, y: 12, filter: "blur(5px)" },
          {
            autoAlpha: 1,
            y: 0,
            filter: "blur(0px)",
            duration: 0.42,
            stagger,
            ease: "power3.out",
            clearProps: "transform,filter,opacity,visibility",
          },
        );
      };
      const animate = contextSafe ? contextSafe(animateRoute) : animateRoute;
      const activeTransition = (document as DocumentWithActiveViewTransition).activeViewTransition;
      if (!activeTransition) {
        animate();
        return;
      }

      let cancelled = false;
      const continueEntrance = () => {
        if (!cancelled) animate();
      };
      void activeTransition.finished.then(continueEntrance, continueEntrance);
      return () => {
        cancelled = true;
      };
    },
    { scope: shellRef, dependencies: [activeItemId, motionReady], revertOnUpdate: true },
  );

  return (
    <IconoirProvider>
      <div className="ui-shell" ref={shellRef}>
        <a className="ui-shell__skip-link" href={`#${mainId}`}>
          Saltar al contenido
        </a>
        <header className="ui-shell__header">
          <div className="ui-shell__brand">{brand}</div>
          <div className="ui-shell__header-navigation">
            <Navigation
              items={navigation}
              activeItemId={activeItemId}
              onNavigate={onNavigate}
              variant="secondary"
            />
            <MoreNavigation
              activeItemId={activeItemId}
              items={secondaryNavigation}
              onNavigate={onNavigate}
              variant="desktop"
            />
          </div>
          {actions || onThemeToggle ? (
            <div className="ui-shell__actions">
              {actions}
              {onThemeToggle ? (
                <NamedIconButton
                  data-theme-toggle="true"
                  icon={theme === "dark" ? <SunLight /> : <HalfMoon />}
                  label={theme === "dark" ? "Usar modo claro" : "Usar modo oscuro"}
                  onClick={onThemeToggle}
                />
              ) : null}
            </div>
          ) : null}
        </header>
        <div className="ui-shell__layout">
          <main className="ui-shell__main" id={mainId} ref={mainRef} tabIndex={-1}>
            {children}
          </main>
        </div>
        <div className="ui-shell__mobile-navigation">
          <Navigation
            items={mobilePrimaryItems}
            activeItemId={activeItemId}
            onNavigate={onNavigate}
            variant="mobile"
          />
          <MoreNavigation
            activeItemId={activeItemId}
            items={secondaryNavigation}
            onNavigate={onNavigate}
            variant="mobile"
          />
        </div>
      </div>
    </IconoirProvider>
  );
}
