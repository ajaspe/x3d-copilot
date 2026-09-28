/**
 * Build the app and copy it into the personal Jekyll site repository so it is served at
 * https://albertojaspe.net/x3d-copilot/ (the site repo is pushed separately).
 *
 *   node scripts/deploy-site.mjs [path-to-site-repo]
 * Default site repo: ../../ajaspe.github.io (sibling of the competition folder).
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = resolve(process.argv[2] ?? join(root, "..", "..", "ajaspe.github.io"));
const target = join(site, "x3d-copilot");
if (!existsSync(join(site, "_config.yml"))) {
  console.error(`Site repo not found at ${site} (no _config.yml)`);
  process.exit(1);
}

console.log("building…");
execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["vite", "build"], { cwd: root, stdio: "inherit", shell: process.platform === "win32" });

console.log(`copying dist -> ${target}`);
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(join(root, "dist"), target, { recursive: true });
// Source maps are large and not needed on the site
const assets = join(target, "assets");
if (existsSync(assets)) for (const f of readdirSync(assets)) if (f.endsWith(".map")) rmSync(join(assets, f));
// Tell Jekyll to leave this folder alone (no Liquid processing, no exclusions)
writeFileSync(join(target, ".nojekyll"), "");
console.log("done. In the site repo: git add x3d-copilot && git commit -m 'Add X3D Copilot' && git push");
