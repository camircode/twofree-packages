import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useEffect, useRef, useState, type DependencyList, type RefObject } from "react";

import { getMotionCapabilities } from "./capabilities.js";

gsap.registerPlugin(useGSAP);

export type ScopedMotionContext<T extends HTMLElement = HTMLElement> = Readonly<{
  scope: T;
  gsap: typeof gsap;
  contextSafe: ReturnType<typeof useGSAP>["contextSafe"];
}>;

export type ScopedMotionOptions<T extends HTMLElement = HTMLElement> = Readonly<{
  animate: (context: ScopedMotionContext<T>) => void | (() => void);
  dependencies?: DependencyList;
  enabled?: boolean;
}>;

function canUseMotion(enabled: boolean): boolean {
  if (!enabled) return false;

  try {
    return !getMotionCapabilities().reducedMotion;
  } catch {
    return false;
  }
}

export function useScopedMotion<T extends HTMLElement = HTMLElement>({
  animate,
  dependencies = [],
  enabled = true,
}: ScopedMotionOptions<T>): RefObject<T | null> {
  const scope = useRef<T>(null);
  const [motionEnabled, setMotionEnabled] = useState(false);

  useEffect(() => {
    setMotionEnabled(canUseMotion(enabled));
  }, [enabled]);

  useGSAP(
    (_context, contextSafe) => {
      if (!motionEnabled || !scope.current || !contextSafe) return;

      try {
        return animate({ scope: scope.current, gsap, contextSafe });
      } catch {
        return undefined;
      }
    },
    {
      scope,
      dependencies: [motionEnabled, ...dependencies],
      revertOnUpdate: true,
    },
  );

  return scope;
}
