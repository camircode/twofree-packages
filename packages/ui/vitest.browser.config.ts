import { playwright } from "@vitest/browser-playwright";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

import { packageSrcAlias } from "./vite.config.js";

const workspaceRoot = resolve(import.meta.dirname, "../..");
const harnessBaselineDirectory = resolve(
  workspaceRoot,
  "test/visual-baselines/mobile-first-finance-experience/harness",
);
const harnessArtifactDirectory = resolve(
  workspaceRoot,
  "artifacts/visual/mobile-first-finance-experience/harness",
);
const visualUpdate = process.env.VISUAL_UPDATE === "1";
if (process.argv.includes("--update") && !visualUpdate)
  throw new Error("VISUAL_UPDATE=1 is required");

export default defineConfig({
  resolve: {
    alias: packageSrcAlias,
  },
  test: {
    update: visualUpdate ? "all" : "none",
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium", viewport: { width: 1280, height: 900 } }],
      expect: {
        toMatchScreenshot: {
          resolveScreenshotPath: ({ arg, ext }) =>
            resolve(harnessBaselineDirectory, `${arg}${ext}`),
          resolveDiffPath: ({ arg, ext }) => resolve(harnessArtifactDirectory, `diff-${arg}${ext}`),
          comparatorName: "pixelmatch",
          comparatorOptions: { allowedMismatchedPixelRatio: 0.001, threshold: 0.1 },
        },
      },
    },
    include: ["test/**/*.browser.test.ts", "test/**/*.browser.test.tsx"],
  },
});
