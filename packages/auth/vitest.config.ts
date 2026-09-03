import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      name: "package-local-source-alias",
      resolveId(source, importer) {
        if (!source.startsWith("@/") || !importer) return null;
        return resolve(
          fileURLToPath(new URL("./src", import.meta.url)),
          source.slice(2).replace(/\.js$/, ".ts"),
        );
      },
    },
  ],
});
