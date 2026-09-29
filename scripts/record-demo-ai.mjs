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
async function ask(text) {
  await page.click("#chat-input");
  await page.type("#chat-input", text, { delay: 16 });
  await sleep(500);
  await page.click("#btn-send");
  await page.waitForFunction(() => document.querySelector("#btn-send").hasAttribute("disabled"), null, { timeout: 10000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector("#btn-send").hasAttribute("disabled"), null, { timeout: 420000 }).catch(() => {});
  await page.evaluate(() => { const l = document.querySelector("#chat-log"); l.scrollTop = l.scrollHeight; });
  const cur = timeline[timeline.length - 1];
  if (cur) cur.busyUntil = now(); // assembler time-lapses only up to here
  // keep the scene after each turn for post-mortems
  try { writeFileSync(join(raw, "scene-S" + (cur ? cur.id : "x") + ".x3d"), await page.evaluate(() => window.__x3dcopilot.editor.getValue())); } catch {}
  const apiError = await page.evaluate(() => [...document.querySelectorAll("#chat-log .msg.system")].map((m) => m.textContent).filter((t) => /API error|billing|Authentication failed|Rate limited/.test(t)).pop() ?? null);
  if (apiError) {
    console.error("MODEL ERROR: " + apiError.slice(0, 200));
    process.exitCode = 2;
    throw new Error("model API error; aborting recording");
  }
}
async function clickCanvasCenter(dx = 0, dy = 0) {
  const box = await page.locator("#canvas").boundingBox();
  await page.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy);
}
async function bindOrViewAll(def) {
  await page.evaluate((d) => {
    try { window.__x3dcopilot.viewer.browser.currentScene.getNamedNode(d).set_bind = true; } catch { window.__x3dcopilot.viewer.viewAll(); }
  }, def);
}

await page.goto(URL);
await page.waitForFunction(() => window.__x3dcopilot && window.__x3dcopilot.viewer.browser.currentScene.rootNodes.length > 0, null, { timeout: 60000 });
await page.waitForFunction(() => window.__x3dcopilot.validator.schemaReady, null, { timeout: 60000 });

await segment(1, async () => {
  await loadExample("hello-spinning-box.x3d");
  await sleep(6000);
  await orbit(120, 30, 50);
});

// S2: snowman from an empty file
await segment(2, async () => {
  await page.evaluate(() => { window.__x3dcopilot.editor.setValue('<?xml version="1.0" encoding="UTF-8"?>\n<X3D profile="Immersive" version="4.0">\n  <head>\n    <meta name="title" content="snowman.x3d"/>\n  </head>\n  <Scene>\n  </Scene>\n</X3D>\n', { silent: true }); });
  await page.evaluate(() => window.__x3dcopilot.runPipeline(window.__x3dcopilot.editor.getValue()));
  await sleep(1500);
  await ask("Make a snowman standing on snowy ground at night, with a starry sky and soft moonlight. Add a viewpoint DEF='Main' that frames him from the front.");
  await sleep(800);
  await bindOrViewAll("Main");
  await orbit(90, 20, 45);
  await sleep(700);
});

// S3: details
await segment(3, async () => {
  await ask("Give him a carrot nose, coal eyes and buttons, stick arms, a red scarf and a black top hat (make the hat its own Transform named Hat).");
  await sleep(800);
  await bindOrViewAll("Main");
  await orbit(-120, 10, 50);
  await sleep(600);
});

// S4: moon shadows
await segment(4, async () => {
  await ask("Make the moonlight cast shadows: the snowman and the trees should cast soft shadows on the snow.");
  await sleep(800);
  await bindOrViewAll("Main");
  await orbit(70, 10, 35);
  await sleep(900);
});

// S5: click the snowman -> he tips his hat
await segment(5, async () => {
  await ask("When I click the snowman, his hat should do a small jump and land back. Also add a viewpoint DEF='CloseUp' in front of him so the snowman fills the view.");
  await sleep(800);
  // selection off for this segment: clicks must only reach the scene's own sensors
  await page.evaluate(() => window.__x3dcopilot.tools.setEnabled(false));
  await bindOrViewAll("CloseUp");
  await sleep(2000);
  // Generic hit detection: snapshot every named Transform's rotation/translation; a click "hit" if something
  // moves after the click that was not already moving on its own.
  const snapshot = () => page.evaluate(() => {
    const s = window.__x3dcopilot.viewer.browser.currentScene;
    const src = window.__x3dcopilot.editor.getValue();
    const out = {};
    for (const m of src.matchAll(/<Transform[^>]*DEF="([^"]+)"/g)) {
      try { const n = s.getNamedNode(m[1]); out[m[1]] = [n.translation.x, n.translation.y, n.translation.z, n.rotation.angle].map((v) => Math.round(v * 1000) / 1000).join(","); } catch {}
    }
    return out;
  });
  const changed = (a, b) => Object.keys(b).filter((k) => a[k] !== b[k]);
  const s0 = await snapshot(); await sleep(1400); const s1 = await snapshot();
  const ambient = new Set(changed(s0, s1));
  let hit = null;
  for (const dy of [0, 80, -80, 160, -160, 240]) {
    const before = await snapshot();
    await clickCanvasCenter(0, dy);
    await sleep(1400);
    const after = await snapshot();
    const moved = changed(before, after).filter((k) => !ambient.has(k));
    console.log("probe dy=" + dy + ": moved " + (moved.join(",") || "nothing"));
    if (moved.length) { hit = [0, dy]; break; }
  }
  timeline[timeline.length - 1].hit = hit;
  timeline[timeline.length - 1].busyUntil = now(); // probing is hidden in the time-lapse
  await sleep(1500);
  const [hx, hy] = hit ?? [0, 0];
  for (let i = 0; i < 4; i++) {
    await clickCanvasCenter(hx, hy);
    await sleep(2600);
  }
  await page.evaluate(() => window.__x3dcopilot.tools.setEnabled(true));
  await bindOrViewAll("Main");
  await sleep(1000);
  await orbit(50, 10, 25);
  await sleep(700);
});
await segment(6, async () => {
  await loadExample("broken-scene.x3d");
  await sleep(3000);
  await ask("Fix everything that is wrong with this scene, keep the author's intent, and verify the result visually.");
  await sleep(1500);
  await page.evaluate(() => window.__x3dcopilot.viewer.viewAll());
  await sleep(2000);
});

await segment(7, async () => {
  await loadExample("solar-system.x3d");
  await sleep(2000);
  await page.evaluate(() => window.__x3dcopilot.tools.select(2)); // EarthSpin
  await sleep(2500);
  await ask("Make this twice as big and give it a physically based material: bluish base colour, roughness 0.35, metallic 0.");
  await sleep(2500);
});

await segment(8, async () => {
  await sleep(1000);
}, { card: "arch" });

await segment(9, async () => {
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
