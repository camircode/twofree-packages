import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "../..");
const packageRoot = resolve(process.cwd());

describe("offline branding and typography fallbacks", () => {
  it("packages one exact copy of the supplied logo", () => {
    const suppliedLogo = readFileSync(resolve(root, "2free con fondi.svg"), "utf8");
    const packageLogo = readFileSync(
      resolve(packageRoot, "src/assets/2free-con-fondi.svg"),
      "utf8",
    );

    expect(packageLogo).toBe(suppliedLogo);
  });

  it("self-hosts licensed fonts with explicit fallback stacks", () => {
    const typography = readFileSync(resolve(packageRoot, "src/styles/typography.css"), "utf8");
    const typographyNotes = readFileSync(resolve(packageRoot, "src/styles/README.md"), "utf8");

    expect(typography).toContain('@import "@fontsource-variable/urbanist"');
    expect(typography).toContain('@import "@fontsource-variable/open-sans"');
    expect(typography).toContain('"Urbanist Variable", "Urbanist"');
    expect(typography).toContain('"Open Sans Variable", "Open Sans"');
    expect(typography).not.toMatch(/https?:\/\//);
    expect(typographyNotes).toMatch(/without remote\s+font requests/);
  });

  it("keeps the visual harness on the supplied package asset boundary", () => {
    const harness = readFileSync(
      resolve(packageRoot, "test/visual-harness.browser.test.tsx"),
      "utf8",
    );

    expect(harness).toContain("2free-con-fondi.svg");
    expect(harness).toContain("exactly the required eight Cartesian variants");
    expect(harness).not.toMatch(/https?:\/\//);
  });
});
