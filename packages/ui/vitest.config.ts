import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { packageSrcAlias } from "./vite.config.js";

export default defineConfig({
  resolve: {
    alias: {
      // The public entry points resolve to dist once published, so the consumer
      // harness is pinned to source here to keep tests independent of a prior build.
      "@camircode/twofree-ui/styles.css": fileURLToPath(
        new URL("./src/styles/index.css", import.meta.url),
      ),
      "@camircode/twofree-ui": fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      ...packageSrcAlias,
    },
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    exclude: ["test/**/*.browser.test.ts", "test/**/*.browser.test.tsx"],
  },
});
