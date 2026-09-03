import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { packageLocalAliasMarker } from "@/alias-probe.js";

const packageRoot = resolve(process.cwd());
const readPackageFile = (name: string): string => readFileSync(resolve(packageRoot, name), "utf8");

describe("@camircode/twofree-ui package foundation", () => {
  it("resolves the package-local @ alias to packages/ui/src", () => {
    expect(packageLocalAliasMarker).toBe("@camircode/twofree-ui/src");
    expect(packageRoot.endsWith("/packages/ui")).toBe(true);
  });

  it("declares runtime, peer, and browser-test ownership explicitly", () => {
    const manifest = JSON.parse(readPackageFile("package.json")) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      peerDependencies: Record<string, string>;
    };

    expect(manifest.peerDependencies).toMatchObject({
      react: expect.any(String),
      "react-dom": expect.any(String),
    });
    expect(manifest.dependencies).toMatchObject({
      "@camircode/twofree-core": "workspace:*",
      "@gsap/react": expect.any(String),
      gsap: expect.any(String),
    });
    expect(manifest.devDependencies).toMatchObject({
      "@testing-library/dom": expect.any(String),
      "@testing-library/react": expect.any(String),
      "@types/react": expect.any(String),
      "@types/react-dom": expect.any(String),
      jsdom: expect.any(String),
      react: expect.any(String),
      "react-dom": expect.any(String),
      vitest: expect.any(String),
    });
  });

  it("keeps TypeScript and Vite aliases package-local", () => {
    const tsconfig = readPackageFile("tsconfig.json");
    const viteConfig = readPackageFile("vite.config.ts");
    const vitestConfig = readPackageFile("vitest.config.ts");

    expect(tsconfig).toContain('"@/*"');
    expect(tsconfig).toContain('"src/*"');
    expect(viteConfig).toContain('"@"');
    expect(viteConfig).toContain("./src");
    expect(vitestConfig).toContain("packageSrcAlias");
    expect(vitestConfig).toContain('environment: "jsdom"');
  });

  it("keeps the root aggregate typecheck from compiling package sources", () => {
    const rootTsconfig = readFileSync(resolve(packageRoot, "../../tsconfig.base.json"), "utf8");

    expect(rootTsconfig).toContain('"./workspace.d.ts"');
    expect(rootTsconfig).toContain('"./packages/**"');
  });
});
