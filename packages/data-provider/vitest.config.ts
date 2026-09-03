import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      name: "package-local-source-alias",
      resolveId(source, importer) {
        if (!source.startsWith("@/") || !importer) return null;
        const packageSource = importer.includes("/packages/core/") ? "../core/src" : "./src";
        return resolve(
          fileURLToPath(new URL(packageSource, import.meta.url)),
          source.slice(2).replace(/\.js$/, ".ts"),
        );
      },
    },
  ],
  resolve: {
    alias: {
      "@camircode/twofree-core": fileURLToPath(new URL("../core/src", import.meta.url)),
    },
  },
});
