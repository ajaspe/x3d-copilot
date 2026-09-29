/**
 * Annotated UI screenshot for the Tools-competition summary: the broken-scene example with its
 * issue list, then the solar system with the gizmo. Output: docs/submission/tools/fig-ui-tools.png
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

// Solar system with the earth selected; then type a deliberate error so the issue list is populated
await loadExample("solar-system.x3d");
await sleep(1500);
await page.evaluate(() => { const src = window.__x3dcopilot.editor.getValue(); const idx = [...src.matchAll(/<Transform\b[^>]*/g)].findIndex((m) => m[0].includes('DEF="EarthSpin"')); window.__x3dcopilot.tools.select(idx); });
await page.waitForSelector("#inspector:not(.hidden)", { timeout: 5000 });
// inject two mistakes into the source to show diagnostics: a typo in a field and a bad ROUTE target
await page.evaluate(async () => {
  const e = window.__x3dcopilot.editor;
  let src = e.getValue();
  src = src.replace('<Sphere radius="0.4"/>', '<Sphere radus="0.4"/>').replace('toNode="EarthOrbit" toField="set_rotation"', 'toNode="EarthOrbit" toField="set_translation"');
  e.setValue(src, { silent: true });
  await window.__x3dcopilot.runPipeline(src);
});
await sleep(1500);
// scroll the editor to the earth transform
await page.evaluate(() => { const v = window.__x3dcopilot.editor.view; const i = v.state.doc.toString().indexOf('DEF="EarthOrbit"'); v.dispatch({ selection: { anchor: i }, scrollIntoView: true }); });
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
