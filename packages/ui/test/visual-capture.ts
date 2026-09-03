const viewportMatrix = [
  ["mobile", 390, 844],
  ["desktop", 1280, 900],
] as const;
const themeMatrix = ["light", "dark"] as const;
const motionMatrix = ["motion", "reduced"] as const;

export type VisualVariant = Readonly<{
  height: number;
  motion: (typeof motionMatrix)[number];
  name: string;
  theme: (typeof themeMatrix)[number];
  viewport: (typeof viewportMatrix)[number][0];
  width: number;
}>;

export const requiredVisualVariants: readonly VisualVariant[] = viewportMatrix.flatMap(
  ([viewport, width, height]) =>
    themeMatrix.flatMap((theme) =>
      motionMatrix.map((motion) => ({
        name: `${viewport}-${theme}-${motion}`,
        viewport,
        width,
        height,
        theme,
        motion,
      })),
    ),
);
export type VisualSurface = "route" | "harness";

export type VisualCapturePage = Readonly<{
  emulateMedia: (options: { reducedMotion: "no-preference" | "reduce" }) => Promise<unknown>;
  evaluate: (pageFunction: () => unknown | Promise<unknown>) => Promise<unknown>;
  waitForFunction: (pageFunction: () => boolean | Promise<boolean>) => Promise<unknown>;
}>;

export function visualCaptureFileName(surface: VisualSurface, variant: VisualVariant): string {
  return `${surface}-${variant.viewport}-${variant.theme}-${variant.motion}.png`;
}

export function visualCaptureBaseName(surface: VisualSurface, variant: VisualVariant): string {
  return visualCaptureFileName(surface, variant).replace(/\.png$/u, "");
}

export async function settleBrowserVisualCapture(
  motion: VisualVariant["motion"] = "motion",
): Promise<void> {
  const browserPage: VisualCapturePage = {
    emulateMedia: async ({ reducedMotion }) => {
      document.documentElement.dataset.captureMedia = reducedMotion;
      document.documentElement.dataset.motion = reducedMotion === "reduce" ? "reduced" : "enabled";
    },
    evaluate: async (pageFunction) => pageFunction(),
    waitForFunction: async (pageFunction) => {
      if (!(await pageFunction())) throw new Error("Visual capture did not settle");
    },
  };

  await settleVisualCapture(browserPage, motion);
}

export async function settleVisualCapture(
  page: VisualCapturePage,
  motion: VisualVariant["motion"] = "motion",
): Promise<void> {
  await page.emulateMedia({ reducedMotion: motion === "reduced" ? "reduce" : "no-preference" });
  await page.evaluate(async () => {
    const freezeStyle = document.createElement("style");
    freezeStyle.dataset.visualCaptureFreeze = "true";
    freezeStyle.textContent =
      "*,*::before,*::after{animation:none!important;transition:none!important;}";
    document.head.append(freezeStyle);

    if (document.fonts?.ready) await document.fonts.ready;

    await Promise.all(
      [...document.images].map((image) =>
        image.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              image.addEventListener("load", () => resolve(), { once: true });
              image.addEventListener("error", () => resolve(), { once: true });
            }),
      ),
    );
  });

  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const nextFrame = (callback: () => void) =>
          typeof requestAnimationFrame === "function"
            ? requestAnimationFrame(() => callback())
            : setTimeout(callback, 0);
        nextFrame(() => nextFrame(resolve));
      }),
  );

  await page.waitForFunction(() => document.querySelector('[data-motion-settled="true"]') !== null);
}

export function captureFinalStateSignature(root: Element): string {
  const headings = [...root.querySelectorAll("h1, h2, h3")].map((heading) =>
    heading.textContent?.replace(/\s+/g, " ").trim(),
  );
  const dataAttributes = [...root.querySelectorAll("*")]
    .flatMap((element) =>
      [...element.attributes]
        .filter(
          ({ name }) => name.startsWith("data-") && /state|layout|motion|chart|variant/u.test(name),
        )
        .map(({ name, value }) => `${name}=${value}`),
    )
    .sort();

  return JSON.stringify({
    dataAttributes,
    headings,
    text: root.textContent?.replace(/\s+/g, " ").trim(),
  });
}

export function assertNonColorState(element: Element): void {
  const statusSelector =
    '[role="status"], [role="alert"], [aria-live="polite"], [aria-live="assertive"], [data-state-message]';
  const textRoot = element.cloneNode(true) as Element;
  textRoot.querySelectorAll('svg, [aria-hidden="true"]').forEach((icon) => icon.remove());
  const explanatoryText = [
    textRoot.textContent,
    element.getAttribute("aria-label"),
    element.getAttribute("aria-valuetext"),
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const hasProgrammaticStatus =
    element.matches(statusSelector) || element.querySelector(statusSelector) !== null;

  if (!hasProgrammaticStatus || !/[\p{L}]{2,}/u.test(explanatoryText)) {
    throw new Error("Visual state must expose meaningful non-color explanatory text and status");
  }
}
