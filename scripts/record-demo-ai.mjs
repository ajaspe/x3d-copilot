/**
 * Record the AI-competition demo (requires GEMINI_API_KEY). Same mechanics as record-demo.mjs.
 * Outputs docs/submission/video/raw-ai/{demo.webm,timeline.json,card-*.png}
 */
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startPreview } from "./serve.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const vdir = join(here, "..", "docs", "submission", "video");
const raw = join(vdir, "raw-ai");
mkdirSync(raw, { recursive: true });
const W = 1600, H = 900;
const narration = JSON.parse(readFileSync(join(vdir, "narration-ai", "index.json"), "utf8"));
const secs = (id) => narration.find((n) => n.id === id)?.seconds ?? 20;
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) {
  console.error("GEMINI_API_KEY is required for the AI demo.");
  process.exit(1);
}
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";

const server = process.env.APP_URL ? null : await startPreview(4173);
const URL = process.env.APP_URL ?? server.url;
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "msedge", headless: !process.env.HEADED, args: ["--ignore-gpu-blocklist", "--enable-webgl"] });
const context = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: raw, size: { width: W, height: H } } });
const page = await context.newPage();
const t0 = Date.now();
const now = () => (Date.now() - t0) / 1000;
const timeline = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await page.addInitScript(({ key, model }) => {
  localStorage.removeItem("x3d-copilot.scene.v1");
  localStorage.setItem("x3d-copilot.settings.v2", JSON.stringify({ provider: "gemini", keys: { anthropic: "", gemini: key }, models: { anthropic: "claude-opus-5", gemini: model }, effort: "", baseURL: { anthropic: "", gemini: "" }, autoScreenshot: true }));
}, { key: KEY, model: MODEL });

async function card(name, title, subtitle, lines = []) {
  const p = await context.newPage();
  await p.setContent(`<html><body style="margin:0;width:${W}px;height:${H}px;background:#0f1216;color:#e6edf3;font-family:'Segoe UI',system-ui,sans-serif;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center">
    <div style="display:flex;align-items:center;gap:18px;margin-bottom:18px"><svg viewBox='0 0 32 32' width='64' height='64'><path fill='#34d399' d='M16 2 3 9v14l13 7 13-7V9z'/><path fill='#065f46' d='M16 16 3 9v14l13 7z'/><path fill='#10b981' d='M16 16v14l13-7V9z'/></svg><div style="font-size:64px;font-weight:700">${title}</div></div>
    <div style="font-size:30px;color:#8b98a5;max-width:1200px">${subtitle}</div>
    <div style="margin-top:36px;font-size:24px;color:#34d399;line-height:1.7">${lines.join("<br/>")}</div>
  </body></html>`);
  await p.screenshot({ path: join(raw, `card-${name}.png`) });
  await p.close();
}
await card("title", "X3D Copilot", "Spec-grounded, self-verifying AI authoring of X3D 4.0 scenes", ["Web3D 2026 · AI & Web3D Innovation Competition", "Alberto Jaspe-Villanueva · KAUST"]);
await card("end", "X3D Copilot", "AI-generated 3D content, conformant by construction", ["albertojaspe.net/x3d-copilot", "github.com/ajaspe/x3d-copilot · MIT", "Gemini · Claude · X3D 4.0 · X_ITE"]);
copyFileSync(join(vdir, "..", "ai", "architecture.png"), join(raw, "card-arch.png"));

async function segment(id, fn, opts = {}) {
  const start = now();
  timeline.push({ id, start, ...opts });
  console.log(`S${id} at ${start.toFixed(1)}s`);
  await fn();
  const rest = secs(id) + 1.0 - (now() - start);
  if (rest > 0) await sleep(rest * 1000);
}
async function loadExample(file) {
  await page.selectOption("#examples", file);
  await page.waitForFunction(() => /nodes|failed/.test(document.querySelector("#view-status").textContent), null, { timeout: 30000 });
  await page.evaluate(() => window.__x3dcopilot.viewer.viewAll());
}
async function orbit(dx, dy, steps = 40) {
  const box = await page.locator("#canvas").boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(cx + (dx * i) / steps, cy + (dy * i) / steps);
    await sleep(30);
  }
  await page.mouse.up();
}
async function ask(text) {
  await page.click("#chat-input");
  await page.type("#chat-input", text, { delay: 18 });
  await sleep(500);
  await page.click("#btn-send");
  await page.waitForFunction(() => document.querySelector("#btn-send").hasAttribute("disabled"), null, { timeout: 10000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector("#btn-send").hasAttribute("disabled"), null, { timeout: 360000 }).catch(() => {});
  await page.evaluate(() => { const l = document.querySelector("#chat-log"); l.scrollTop = l.scrollHeight; });
}

await page.goto(URL);
await page.waitForFunction(() => window.__x3dcopilot && window.__x3dcopilot.viewer.browser.currentScene.rootNodes.length > 0, null, { timeout: 60000 });
await page.waitForFunction(() => window.__x3dcopilot.validator.schemaReady, null, { timeout: 60000 });

await segment(1, async () => {
  await loadExample("hello-spinning-box.x3d");
  await sleep(6000);
  await orbit(120, 30, 50);
});

await segment(2, async () => {
  await page.evaluate(() => { window.__x3dcopilot.editor.setValue('<?xml version="1.0" encoding="UTF-8"?>\n<X3D profile="Immersive" version="4.0">\n  <head>\n    <meta name="title" content="new-scene.x3d"/>\n  </head>\n  <Scene>\n  </Scene>\n</X3D>\n', { silent: true }); });
  await page.evaluate(() => window.__x3dcopilot.runPipeline(window.__x3dcopilot.editor.getValue()));
  await sleep(1500);
  await ask("Create a small solar system: an emissive sun as the only light, an earth orbiting it and a moon orbiting the earth with nested Transforms and independent TimeSensors, warm lighting, a dark starry Background and a Viewpoint above the ecliptic.");
  await sleep(1500);
  await page.evaluate(() => window.__x3dcopilot.viewer.viewAll());
  await orbit(160, 60, 60);
  await sleep(1500);
});

await segment(3, async () => {
  await loadExample("broken-scene.x3d");
  await sleep(3500);
  await ask("Fix everything that is wrong with this scene, keep the author's intent, and verify the result visually.");
  await sleep(1500);
  await page.evaluate(() => window.__x3dcopilot.viewer.viewAll());
  await sleep(2000);
});

await segment(4, async () => {
  await loadExample("solar-system.x3d");
  await sleep(2000);
  await page.evaluate(() => window.__x3dcopilot.tools.select(2)); // EarthSpin
  await sleep(2500);
  await ask("Make this twice as big and give it a physically based material: bluish base colour, roughness 0.35, metallic 0.");
  await sleep(2500);
});

await segment(5, async () => {
  await sleep(1000);
}, { card: "arch" });

await segment(6, async () => {
  await sleep(500);
});
timeline.push({ id: "end", start: now() });

const video = page.video();
await context.close();
await browser.close();
server?.stop();
const path = await video.path();
const target = join(raw, "demo.webm");
if (existsSync(target)) renameSync(target, join(raw, `demo-${Date.now()}.webm`));
renameSync(path, target);
writeFileSync(join(raw, "timeline.json"), JSON.stringify({ width: W, height: H, timeline }, null, 2));
console.log("recorded", target, timeline);
