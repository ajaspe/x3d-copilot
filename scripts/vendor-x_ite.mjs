/**
 * Copy the X_ITE distribution (runtime + lazily loaded component assets) from
 * node_modules into public/vendor/x_ite so it is served as-is.
 *
 * X_ITE resolves its component scripts, fonts and images relative to its own
 * script URL, so it must not be bundled; we load it at runtime from this folder.
 * Runs automatically on `npm install` (postinstall).
 */
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const src = join(root, "node_modules", "x_ite", "dist");
const dst = join(root, "public", "vendor", "x_ite");

if (!existsSync(src)) {
  console.error("x_ite is not installed; run npm install first");
  process.exit(1);
}
rmSync(dst, { recursive: true, force: true });
mkdirSync(dst, { recursive: true });
for (const f of ["x_ite.min.mjs", "x_ite.css", "LICENSE.md"]) cpSync(join(src, f), join(dst, f));
cpSync(join(src, "assets"), join(dst, "assets"), { recursive: true });
const version = JSON.parse(readFileSync(join(root, "node_modules", "x_ite", "package.json"), "utf8")).version;
writeFileSync(join(dst, "VERSION"), version + "\n");
console.log(`vendored X_ITE ${version} -> public/vendor/x_ite`);
