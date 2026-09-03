import { cleanup, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getMotionCapabilities,
  runViewTransition,
  useScopedMotion,
  type ScopedMotionContext,
} from "@camircode/twofree-ui";

type MotionBoxProps = Readonly<{
  value: number;
  onAnimate: (context: ScopedMotionContext) => void;
  onCleanup?: () => void;
}>;

function MotionBox({ onAnimate, onCleanup, value }: MotionBoxProps) {
  const ref = useScopedMotion<HTMLDivElement>({
    dependencies: [value],
    animate: (context) => {
      onAnimate(context);
      context.gsap.set(".motion-target", { opacity: value });
      return onCleanup;
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
  vi.unstubAllGlobals();
});

describe("scoped motion enhancement", () => {
  it("isolates instances and reverts each scope on updates and unmount", () => {
    const animations: ScopedMotionContext[] = [];
    const { container, rerender, unmount } = render(
      <>
        <MotionBox value={1} onAnimate={(context) => animations.push(context)} />
        <MotionBox value={2} onAnimate={(context) => animations.push(context)} />
      </>,
    );

    expect(animations).toHaveLength(2);
    expect(animations[0]?.scope).not.toBe(animations[1]?.scope);
    expect(animations[0]?.contextSafe).toBeTypeOf("function");

    const roots = [...container.querySelectorAll<HTMLElement>("[data-motion-root]")];
    expect(roots).toHaveLength(2);

    rerender(
      <>
        <MotionBox value={3} onAnimate={(context) => animations.push(context)} />
        <MotionBox value={2} onAnimate={(context) => animations.push(context)} />
      </>,
    );

    expect(animations).toHaveLength(3);
    expect(animations[2]?.scope).toBe(roots[0]);
    expect(roots[0]?.querySelector<HTMLElement>(".motion-target")?.style.opacity).toBe("3");

    rerender(<MotionBox value={2} onAnimate={(context) => animations.push(context)} />);
    expect(roots[1]?.isConnected).toBe(false);
    expect(roots[0]?.isConnected).toBe(true);
    const target = roots[0]?.querySelector<HTMLElement>(".motion-target");
    expect(target?.style.opacity).toBe("2");

    unmount();
    expect(target?.style.opacity).toBe("");
  });

  it("runs only the affected cleanup and leaves no callback behind", () => {
    const firstCleanup = vi.fn();
    const secondCleanup = vi.fn();
    const { rerender, unmount } = render(
      <>
        <MotionBox value={1} onAnimate={vi.fn()} onCleanup={firstCleanup} />
        <MotionBox value={2} onAnimate={vi.fn()} onCleanup={secondCleanup} />
      </>,
    );

    expect(firstCleanup).not.toHaveBeenCalled();
    expect(secondCleanup).not.toHaveBeenCalled();

    rerender(
      <>
        <MotionBox value={3} onAnimate={vi.fn()} onCleanup={firstCleanup} />
        <MotionBox value={2} onAnimate={vi.fn()} onCleanup={secondCleanup} />
      </>,
    );

    expect(firstCleanup).toHaveBeenCalledOnce();
    expect(secondCleanup).not.toHaveBeenCalled();

    unmount();

    expect(firstCleanup).toHaveBeenCalledTimes(2);
    expect(secondCleanup).toHaveBeenCalledOnce();
  });

  it("does not initialize GSAP when reduced motion is requested", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const animate = vi.fn();

    render(<MotionBox value={1} onAnimate={animate} />);

    expect(animate).not.toHaveBeenCalled();
  });

  it("renders stable markup without browser globals", () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);

    const markup = renderToStaticMarkup(<MotionBox value={1} onAnimate={vi.fn()} />);

    expect(markup).toContain('data-motion-root="true"');
    expect(markup).toContain('class="motion-target"');
  });

  it("fails closed without browser capabilities during SSR", () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;

    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);

    expect(getMotionCapabilities()).toEqual({ reducedMotion: true });

    vi.stubGlobal("window", originalWindow);
    vi.stubGlobal("document", originalDocument);
  });

  it("exposes View Transitions only after browser feature detection", () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const startViewTransition = vi.fn();

    vi.stubGlobal("window", {
      matchMedia: vi.fn(() => ({ matches: false })),
    });
    vi.stubGlobal("document", { startViewTransition });

    expect(getMotionCapabilities().startViewTransition).toBeTypeOf("function");

    vi.stubGlobal("document", {});
    expect(getMotionCapabilities().startViewTransition).toBeUndefined();

    vi.stubGlobal("window", originalWindow);
    vi.stubGlobal("document", originalDocument);
  });

  it("uses the detected View Transition only for a supported browser capability", () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const commit = vi.fn();
    const startViewTransition = vi.fn((update: () => void) => {
      update();
      return undefined;
    });

    vi.stubGlobal("window", {
      matchMedia: vi.fn(() => ({ matches: false })),
    });
    vi.stubGlobal("document", { startViewTransition });

    runViewTransition({ commit });

    expect(startViewTransition).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledOnce();

    vi.stubGlobal("window", originalWindow);
    vi.stubGlobal("document", originalDocument);
  });
});

describe("synchronous View Transition fallback", () => {
  it("commits synchronously and skips unsupported transitions", () => {
    const commit = vi.fn();
    const startViewTransition = vi.fn();

    runViewTransition({ commit, startViewTransition: undefined });

    expect(commit).toHaveBeenCalledOnce();
    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it("commits exactly once when the enhancement callback and finished promise reject", async () => {
    const commit = vi.fn();
    const startViewTransition = vi.fn((update: () => void) => {
      update();
      return { finished: Promise.reject(new Error("transition failed")) };
    });

    runViewTransition({ commit, startViewTransition });
    await Promise.resolve();

    expect(commit).toHaveBeenCalledOnce();
  });

  it("recovers from a thrown or rejected enhancement when it never calls back", async () => {
    const thrownCommit = vi.fn();
    const rejectedCommit = vi.fn();

    runViewTransition({
      commit: thrownCommit,
      startViewTransition: () => {
        throw new Error("transition unavailable");
      },
    });
    runViewTransition({
      commit: rejectedCommit,
      startViewTransition: () => Promise.reject(new Error("transition rejected")),
    });
    await Promise.resolve();

    expect(thrownCommit).toHaveBeenCalledOnce();
    expect(rejectedCommit).toHaveBeenCalledOnce();
  });

  it("commits synchronously when a non-native enhancement returns a rejected promise", () => {
    const commit = vi.fn();

    runViewTransition({
      commit,
      startViewTransition: () => Promise.reject(new Error("transition rejected")),
    });

    expect(commit).toHaveBeenCalledOnce();
  });

  it("commits synchronously when an enhancement returns no completion contract", () => {
    const commit = vi.fn();

    runViewTransition({
      commit,
      startViewTransition: () => undefined,
    });

    expect(commit).toHaveBeenCalledOnce();
  });

  it("uses the same synchronous fallback for reduced motion", () => {
    const commit = vi.fn();
    const startViewTransition = vi.fn();

    runViewTransition({ commit, reducedMotion: true, startViewTransition });

    expect(commit).toHaveBeenCalledOnce();
    expect(startViewTransition).not.toHaveBeenCalled();
  });
});
