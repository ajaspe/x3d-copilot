/**
 * Record the Tools-competition demo video: Playwright drives the built app in the system Edge/Chrome
 * and records the screen. Segment timings follow docs/submission/video/narration/index.json
 * (run scripts/narrate.mjs first). Writes:
 *   docs/submission/video/raw/demo.webm      the recording
 *   docs/submission/video/raw/timeline.json  segment start offsets (seconds)
 *   docs/submission/video/raw/card-*.png     title cards to overlay
 *
 *   GEMINI_API_KEY=... node scripts/record-demo.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startPreview } from "./serve.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const vdir = join(here, "..", "docs", "submission", "video");
const raw = join(vdir, "raw");
mkdirSync(raw, { recursive: true });
const W = 1600, H = 900;
const narration = JSON.parse(readFileSync(join(vdir, "narration", "index.json"), "utf8"));
const secs = (id) => narration.find((n) => n.id === id)?.seconds ?? 20;
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) console.warn("GEMINI_API_KEY not set: the AI segments will show the 'no key' path.");
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
  if (key) {
    localStorage.setItem("x3d-copilot.settings.v2", JSON.stringify({ provider: "gemini", keys: { anthropic: "", gemini: key }, models: { anthropic: "claude-opus-5", gemini: model }, effort: "", baseURL: { anthropic: "", gemini: "" }, autoScreenshot: true }));
  }
}, { key: KEY ?? "", model: MODEL });

// ---- title cards ------------------------------------------------------------------
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
await card("title", "X3D Copilot", "A spec-grounded, AI-assisted X3D 4.0 editor that runs entirely in the browser", ["Web3D 2026 · Web3D/Metaverse Tools Competition", "Alberto Jaspe-Villanueva · KAUST"]);
await card("end", "X3D Copilot", "Open source · MIT · 56 automated tests · zero installation", ["github.com/ajaspe/x3d-copilot", "albertojaspe.net/x3d-copilot", "Tool of the Year · Tool/Pipeline Innovation of the Year"]);

// ---- helpers ----------------------------------------------------------------------
async function segment(id, fn) {
  const start = now();
  timeline.push({ id, start });
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
  // start the drag away from the centre so it never ends over an object (which would read as a click)
  const cx = box.x + box.width * 0.82, cy = box.y + box.height * 0.18;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(cx + (dx * i) / steps, cy + (dy * i) / steps);
    await sleep(30);
  }
  await page.mouse.up();
}
async function scrub(selector, dx, steps = 30) {
  const box = await page.locator(selector).boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x + (dx * i) / steps, y);
    await sleep(40);
  }
  await page.mouse.up();
}
async function ask(text) {
  await page.click("#chat-input");
  await page.type("#chat-input", text, { delay: 16 });
  await sleep(400);
  await page.click("#btn-send");
  await page.waitForFunction(() => document.querySelector("#btn-send").hasAttribute("disabled"), null, { timeout: 10000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector("#btn-send").hasAttribute("disabled"), null, { timeout: 300000 }).catch(() => {});
  timeline[timeline.length - 1].busyUntil = now();
}
async function bind(def) {
  await page.evaluate((d) => { try { window.__x3dcopilot.viewer.browser.currentScene.getNamedNode(d).set_bind = true; } catch { window.__x3dcopilot.viewer.viewAll(); } }, def);
}
const EMPTY = (title) => `<?xml version="1.0" encoding="UTF-8"?>\n<X3D profile="Immersive" version="4.0">\n  <head>\n    <meta name="title" content="${title}"/>\n  </head>\n  <Scene>\n  </Scene>\n</X3D>\n`;

// ---- boot ----------------------------------------------------------------------------
await page.goto(URL);
await page.waitForFunction(() => window.__x3dcopilot && window.__x3dcopilot.viewer.browser.currentScene.rootNodes.length > 0, null, { timeout: 60000 });
await page.waitForFunction(() => window.__x3dcopilot.validator.schemaReady, null, { timeout: 60000 });

// S1: hook - the copilot builds a still life from one sentence
await segment(1, async () => {
  await page.evaluate((src) => { window.__x3dcopilot.editor.setValue(src, { silent: true }); return window.__x3dcopilot.runPipeline(src); }, EMPTY("still-life.x3d"));
  await sleep(1500);
  await ask("Create a realistic studio still life: on a round marble pedestal (Cylinder, PhysicalMaterial off-white with roughness 0.3), a tall glossy ceramic vase built with an Extrusion (circular cross-section, varying scale along a vertical spine; deep blue PhysicalMaterial roughness 0.15), a bronze sphere (metallic 1, roughness 0.3) and a small frosted glass cube (transparency 0.5, roughness 0.1). Studio lighting: a key DirectionalLight with shadows='true' and shadowIntensity 0.6, a soft fill PointLight, a neutral grey gradient Background, and a Viewpoint DEF='Main' framing the pedestal at a slight three-quarter angle. Enable castShadow on the shapes. Keep it under 110 lines.");
  await sleep(800);
  await bind("Main");
  await orbit(120, 30, 45);
  await sleep(1500);
});

// S2: edit & view - solar system, shading, autocompletion
await segment(2, async () => {
  await loadExample("solar-system.x3d");
  await sleep(2500);
  await orbit(160, 80, 50);
  await sleep(1200);
  await page.selectOption("#shading", "WIREFRAME");
  await sleep(2200);
  await page.selectOption("#shading", "PHONG");
  await sleep(600);
  await page.click("#btn-viewall");
  await sleep(1500);
  // autocompletion: type a new element inside the Scene and let the popup show
  const pos = await page.evaluate(() => { const v = window.__x3dcopilot.editor.view; const s = v.state.doc.toString(); return s.indexOf("</Scene>"); });
  await page.evaluate((i) => { const v = window.__x3dcopilot.editor.view; v.dispatch({ selection: { anchor: i }, scrollIntoView: true }); v.focus(); }, pos);
  await sleep(400);
  const original = await page.evaluate(() => window.__x3dcopilot.editor.getValue());
  await page.keyboard.type("    <Poi", { delay: 140 });
  const popup = async () => {
    const ok = await page.waitForSelector(".cm-tooltip-autocomplete", { timeout: 1500 }).then(() => true).catch(() => false);
    if (!ok) await page.keyboard.press("Control+Space");
    await page.waitForSelector(".cm-tooltip-autocomplete", { timeout: 1500 }).catch(() => {});
    console.log("autocomplete popup:", await page.locator(".cm-tooltip-autocomplete").count());
  };
  await popup(); // element names: PointLight, PointSet, ...
  await sleep(1800);
  await page.keyboard.press("Enter"); // accept PointLight
  await sleep(500);
  await page.keyboard.type(" loc", { delay: 140 });
  await popup(); // attribute names with types and defaults: location ...
  await sleep(1800);
  await page.keyboard.press("Escape");
  // restore the untouched example (undo would also revert the example load itself)
  await page.evaluate((src) => { window.__x3dcopilot.editor.setValue(src, { silent: true }); return window.__x3dcopilot.runPipeline(src); }, original);
  await sleep(800);
});

// S3: gizmo + selection context
await segment(3, async () => {
  await loadExample("solar-system.x3d");
  await sleep(1200);
  await page.evaluate(() => window.__x3dcopilot.tools.select(2)); // EarthSpin
  await sleep(1500);
  await scrub('#inspector input[data-k="ty"]', 120, 40);
  await sleep(1000);
  await scrub('#inspector input[data-k="rz"]', 90, 40);
  await sleep(1000);
  await scrub('#inspector input[data-k="sx"]', 60, 30);
  await sleep(1200);
  await ask("Make this twice as big and give it a physically based bluish material.");
  await sleep(1500);
  await page.keyboard.press("Escape");
  await sleep(600);
});

// S4: events - the copilot-built snowman example
await segment(4, async () => {
  await loadExample("snowman.x3d");
  await sleep(1500);
  await page.evaluate(() => window.__x3dcopilot.tools.setEnabled(false));
  await bind("CloseUp");
  await sleep(1800);
  const box = await page.locator("#canvas").boundingBox();
  for (let i = 0; i < 3; i++) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(2500);
  }
  await page.evaluate(() => window.__x3dcopilot.tools.setEnabled(true));
});

// S5: validation - linter, then repair
await segment(5, async () => {
  await loadExample("broken-scene.x3d");
  await sleep(2500);
  const items = page.locator("#issue-list li.error");
  const n = await items.count();
  for (const i of [0, 2, Math.min(5, n - 1), Math.min(8, n - 1)]) {
    await items.nth(i).hover();
    await sleep(600);
    await items.nth(i).click();
    await sleep(1400);
  }
  await ask("Fix everything that is wrong with this scene, keep the author's intent, and verify the result visually.");
  await sleep(1200);
  await page.evaluate(() => window.__x3dcopilot.viewer.viewAll());
  await sleep(2000);
});

// S6: rendering features - PBR study
await segment(6, async () => {
  await loadExample("pbr-materials.x3d");
  await sleep(1500);
  await orbit(140, 40, 60);
  await sleep(800);
  await page.selectOption("#shading", "WIREFRAME");
  await sleep(1400);
  await page.selectOption("#shading", "PHONG");
  await sleep(600);
  await orbit(-140, -40, 60);
});

// S7: import / export
await segment(7, async () => {
  await page.setInputFiles("#file-input", join(vdir, "assets", "Duck.glb"));
  await page.waitForFunction(() => /Duck|IndexedTriangleSet|ImageTexture/.test(document.querySelector("#editor .cm-content").textContent), null, { timeout: 60000 }).catch(() => {});
  await sleep(1500);
  await page.evaluate(() => window.__x3dcopilot.viewer.viewAll());
  await sleep(1000);
  await orbit(200, 40, 50);
  await sleep(600);
  await page.click("#btn-export");
  await sleep(2600);
  await page.keyboard.press("Escape");
  await page.mouse.click(10, 500);
});

// S8: closing card
await segment(8, async () => {
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
