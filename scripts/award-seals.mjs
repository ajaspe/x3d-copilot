/**
 * Render the two Web3D 2026 award seals as transparent PNGs for the README and the About dialog.
 *   node scripts/award-seals.mjs   ->  public/awards/seal-tools.png, public/awards/seal-ai.png (2x, 624 px)
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { seal, SEAL_TOOLS, SEAL_AI } from "./seal.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "public", "awards");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 400, height: 400 }, deviceScaleFactor: 2 });
for (const [name, lines] of [["tools", SEAL_TOOLS], ["ai", SEAL_AI]]) {
  const p = await context.newPage();
  await p.setContent(`<html><body style="margin:0;background:transparent;display:flex;align-items:center;justify-content:center;width:400px;height:400px">${seal(...lines)}</body></html>`);
  await p.locator("svg").screenshot({ path: join(out, `seal-${name}.png`), omitBackground: true });
  await p.close();
}
await browser.close();
console.log("seals written to", out);
