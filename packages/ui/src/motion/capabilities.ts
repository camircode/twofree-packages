export type ViewTransitionResult =
  | Readonly<{ finished?: PromiseLike<unknown> }>
  | PromiseLike<unknown>
  | void;

export type StartViewTransition = (updateCallback: () => void) => ViewTransitionResult;

export type MotionCapabilities = Readonly<{
  reducedMotion: boolean;
  startViewTransition?: StartViewTransition;
}>;

type ViewTransitionDocument = Document &
  Readonly<{
    startViewTransition?: StartViewTransition;
  }>;

export function getMotionCapabilities(): MotionCapabilities {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { reducedMotion: true };
  }

  let reducedMotion = false;
  try {
    reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    reducedMotion = false;
  }

  const viewTransitionDocument = document as ViewTransitionDocument;
  return {
    reducedMotion,
    startViewTransition:
      typeof viewTransitionDocument.startViewTransition === "function"
        ? viewTransitionDocument.startViewTransition.bind(document)
        : undefined,
  };
}
