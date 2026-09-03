// tsc only emits JS and declarations, so stylesheets, SQL and assets that are read
// at runtime (or re-exported as package subpaths) must be mirrored into dist by hand.
import { cp, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import process from "node:process";

const [sourceDir, destinationDir, ...extensions] = process.argv.slice(2);
if (!sourceDir || !destinationDir || extensions.length === 0) {
  throw new Error("Usage: copy-static.mjs <sourceDir> <destinationDir> <.ext> [...]");
}

const source = resolve(process.cwd(), sourceDir);
const destination = resolve(process.cwd(), destinationDir);

async function copyTree(from, to) {
  for (const entry of await readdir(from)) {
    const fromPath = join(from, entry);
    const toPath = join(to, entry);
    if ((await stat(fromPath)).isDirectory()) {
      await copyTree(fromPath, toPath);
      continue;
    }
    if (!extensions.includes(extname(entry))) continue;
    await mkdir(dirname(toPath), { recursive: true });
    await cp(fromPath, toPath);
  }
}

await copyTree(source, destination);
