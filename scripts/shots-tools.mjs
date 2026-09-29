/**
 * Annotated UI screenshot for the Tools-competition summary: the PBR material study with one
 * sphere selected and two deliberate mistakes typed into the source so the validators show.
 * Output: docs/submission/tools/fig-ui-tools.png
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startPreview } from "./serve.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "docs", "submission", "tools");
const server = await startPreview(4177);
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "msedge", headless: true, args: ["--ignore-gpu-blocklist", "--enable-webgl"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.addInitScript(() => { localStorage.removeItem("x3d-copilot.scene.v1"); localStorage.removeItem("x3d-copilot.settings.v2"); });
await page.goto(server.url);
await page.waitForFunction(() => window.__x3dcopilot && window.__x3dcopilot.validator.schemaReady, null, { timeout: 60000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function loadExample(file) {
  await page.selectOption("#examples", file);
  await page.waitForFunction(() => /nodes|failed/.test(document.querySelector("#view-status").textContent), null, { timeout: 30000 });
}

await loadExample("pbr-materials.x3d");
await sleep(1500);
// inject two mistakes: a misspelled field on one sphere and a wrong colour arity on a light
await page.evaluate(async () => {
  const e = window.__x3dcopilot.editor;
  let src = e.getValue();
  src = src.replace('metallic="0.5" roughness="0.65"', 'metallic="0.5" roughnes="0.65"');
  src = src.replace('<DirectionalLight direction="0.8 0.3 -0.5" intensity="0.5" color="0.7 0.8 1"/>', '<DirectionalLight direction="0.8 0.3 -0.5" intensity="0.5" color="0.7 0.8"/>');
  e.setValue(src, { silent: true });
  await window.__x3dcopilot.runPipeline(src);
});
await sleep(1500);
// select the gold sphere in the middle row (translation "1 0 0" of the metallic 0.5 row is the 3rd Transform in that row)
await page.evaluate(() => {
  const src = window.__x3dcopilot.editor.getValue();
  const all = [...src.matchAll(/<Transform\b[^>]*/g)];
  const idx = all.findIndex((m) => m[0].includes('translation="3 1.5 0"'));
  window.__x3dcopilot.tools.select(idx);
});
await page.waitForSelector("#inspector:not(.hidden)", { timeout: 5000 });
await sleep(800);
// gentle orbit so the spheres read as 3D
{ const box = await page.locator("#canvas").boundingBox(); const cx = box.x + box.width * 0.82, cy = box.y + box.height * 0.18; await page.mouse.move(cx, cy); await page.mouse.down(); for (let i = 1; i <= 30; i++) { await page.mouse.move(cx + (60 * i) / 30, cy + (40 * i) / 30); await sleep(20); } await page.mouse.up(); await sleep(800); }
await page.evaluate(() => { const v = window.__x3dcopilot.editor.view; const i = v.state.doc.toString().indexOf("roughnes="); v.dispatch({ selection: { anchor: i }, scrollIntoView: true }); });
await sleep(600);
await page.evaluate(() => {
  const marks = [
    ["#chat-pane", "1", "AI co-author"],
    ["#view-pane", "2", "Live view (X_ITE)"],
    ["#editor", "3", "X3D source"],
    ["#issues-pane", "4", "Validation"],
    ["#inspector", "5", "Gizmo + inspector"],
    [".toolbar", "6", "Toolbar"],
  ];
  for (const [sel, n, label] of marks) {
    const el = document.querySelector(sel); if (!el) continue;
    const r = el.getBoundingClientRect();
    const box = document.createElement("div"); box.className = "annot";
    box.style.cssText = `position:fixed;left:${r.left + 3}px;top:${r.top + 3}px;width:${r.width - 6}px;height:${r.height - 6}px;border:4px solid #f59e0b;border-radius:8px;pointer-events:none;z-index:9999;box-sizing:border-box`;
    const tag = document.createElement("div");
    tag.textContent = `${n}  ${label}`;
    tag.style.cssText = `position:absolute;left:8px;bottom:8px;background:#f59e0b;color:#111;font:700 30px 'Segoe UI',sans-serif;padding:5px 18px;border-radius:999px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.6)`;
    if (sel === ".toolbar") { tag.style.left = "50%"; tag.style.transform = "translateX(-50%)"; tag.style.bottom = "-56px"; }
    if (sel === "#inspector") { tag.style.bottom = "-56px"; tag.style.left = "8px"; }
    if (sel === "#chat-pane" || sel === "#view-pane") { tag.style.bottom = "auto"; tag.style.top = "8px"; }
    box.appendChild(tag); document.body.appendChild(box);
  }
});
await sleep(300);
await page.screenshot({ path: join(out, "fig-ui-tools.png") });
await browser.close();
server.stop();
console.log("done");
