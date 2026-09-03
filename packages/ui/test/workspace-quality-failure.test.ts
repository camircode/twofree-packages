import { readFileSync, rmSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

describe("workspace quality failure boundary", () => {
  it("keeps deterministic package and browser quality commands discoverable", () => {
    const rootPackage = JSON.parse(
      readFileSync(resolve(process.cwd(), "../../package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    const uiPackage = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(rootPackage.scripts.check).toContain("format:check");
    expect(rootPackage.scripts.check).toContain("lint");
    expect(rootPackage.scripts.check).toContain("typecheck");
    expect(rootPackage.scripts["test:browser"]).toContain("@camircode/twofree-ui test:browser");
    expect(uiPackage.scripts["test:browser"]).toContain("vitest run");
    expect(uiPackage.scripts["test:browser"]).toContain("vitest.browser.config.ts");
  });

  it("returns non-zero for a deterministic violation without rewriting the workspace", () => {
    const directory = mkdtempSync(resolve(tmpdir(), "2free-quality-"));
    const fixture = resolve(directory, "violation.ts");
    const original = "const value={broken:true};\n";
    writeFileSync(fixture, original);

    const result = spawnSync("pnpm", ["exec", "prettier", "--check", fixture], {
      cwd: resolve(process.cwd(), "../.."),
      encoding: "utf8",
    });

    expect(result.status).not.toBe(0);
    expect(readFileSync(fixture, "utf8")).toBe(original);
    rmSync(directory, { recursive: true, force: true });
  });
});
