import { getMotionCapabilities, type StartViewTransition } from "./capabilities.js";

type Commit = () => void;

export type ViewTransitionOptions = Readonly<{
  commit: Commit;
  reducedMotion?: boolean;
  startViewTransition?: StartViewTransition;
}>;

function commitOnce(commit: Commit): Commit {
  let committed = false;
  return () => {
    if (committed) return;
    committed = true;
    commit();
  };
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}

function recoverFromFinished(result: unknown, commit: Commit): boolean {
  if (isPromiseLike(result)) {
    void result.then(undefined, commit);
    return true;
  }

  if (typeof result === "object" && result !== null && "finished" in result) {
    const finished = result.finished;
    if (isPromiseLike(finished)) {
      void finished.then(undefined, commit);
      return true;
    }
  }

  return false;
}

export function runViewTransition({
  commit: stateCommit,
  reducedMotion,
  startViewTransition,
}: ViewTransitionOptions): void {
  const commit = commitOnce(stateCommit);
  const capabilities = getMotionCapabilities();
  const shouldReduceMotion = reducedMotion ?? capabilities.reducedMotion;
  const transition = startViewTransition ?? capabilities.startViewTransition;

  if (shouldReduceMotion || !transition) {
    commit();
    return;
  }

  try {
    const result = transition(commit);

    // The browser API returns a ViewTransition object. A bare promise is an
    // enhancement adapter, not a detected capability, so fail closed before
    // its rejection can delay the state update.
    if (isPromiseLike(result)) commit();

    if (!recoverFromFinished(result, commit)) commit();
  } catch {
    commit();
  }
}
