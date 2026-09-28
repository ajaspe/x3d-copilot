/**
 * Headless screenshots of the running app for the submission documents.
 *
 *   npx vite --port 5173 &        (or the Claude preview server)
 *   GEMINI_API_KEY=... node scripts/shots.mjs
 *
 * Output: docs/submission/tools/fig-*.png
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { startPreview } from "./serve.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "docs", "submission", "tools");
mkdirSync(out, { recursive: true });
// Serve the production build ourselves unless APP_URL points at a running server.
const server = process.env.APP_URL ? null : await startPreview(4173);
const URL = process.env.APP_URL ?? server.url;

// Use the system Edge/Chrome (set BROWSER_CHANNEL=chrome to switch); its GPU path gives proper WebGL.
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL ?? "msedge",
  headless: process.env.HEADED ? false : true,
  args: ["--ignore-gpu-blocklist", "--enable-webgl", "--use-gl=angle", "--use-angle=default"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });

if (process.env.GEMINI_API_KEY) {
  await page.addInitScript(({ key, model }) => {
    localStorage.setItem(
      "x3d-copilot.settings.v2",
      JSON.stringify({ provider: "gemini", keys: { anthropic: "", gemini: key }, models: { anthropic: "claude-opus-5", gemini: model }, effort: "", baseURL: { anthropic: "", gemini: "" }, autoScreenshot: true }),
    );
    localStorage.removeItem("x3d-copilot.scene.v1");
  }, { key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL ?? "gemini-3.8-flash" });
}

page.on("console", (m) => { if (m.type() === "error") console.log("[page]", m.text().slice(0, 200)); });
await page.goto(URL);
await page.waitForFunction(() => window.__x3dcopilot && window.__x3dcopilot.viewer.browser.currentScene.rootNodes.length > 0, null, { timeout: 60000 });
await page.waitForFunction(() => window.__x3dcopilot.validator.schemaReady, null, { timeout: 60000 });

async function loadExample(file) {
  await page.selectOption("#examples", file);
  await page.waitForFunction(() => document.querySelector("#view-status").textContent.includes("nodes") || document.querySelector("#view-status").textContent.includes("failed"), null, { timeout: 30000 });
  await page.evaluate(() => window.__x3dcopilot.viewer.viewAll());
  await page.waitForTimeout(2500);
}

// 1. overview: PBR study
await loadExample("pbr-materials.x3d");
await page.screenshot({ path: join(out, "fig-overview.png") });

// 2. gizmo on the solar system
await loadExample("solar-system.x3d");
await page.evaluate(() => window.__x3dcopilot.tools.select(1));
await page.waitForTimeout(1500);
await page.screenshot({ path: join(out, "fig-gizmo.png") });
await page.evaluate(() => window.__x3dcopilot.tools.select(null));

// 3. issues on the broken scene
await loadExample("broken-scene.x3d");
await page.waitForTimeout(500);
await page.screenshot({ path: join(out, "fig-issues.png") });

// 4. AI repairing it (needs a key)
if (process.env.GEMINI_API_KEY) {
  await page.fill("#chat-input", "Fix everything that is wrong with this scene, keep the author's intent, then verify visually.");
  await page.click("#btn-send");
  await page.waitForFunction(() => !document.querySelector("#btn-send").hasAttribute("disabled"), null, { timeout: 240000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, "fig-ai.png") });
} else {
  console.log("GEMINI_API_KEY not set: skipping fig-ai.png");
}

await browser.close();
server?.stop();
console.log("screenshots written to", out);
