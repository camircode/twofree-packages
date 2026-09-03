import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

export const packageSrcAlias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
};

export default defineConfig({
  resolve: {
    alias: packageSrcAlias,
  },
});
