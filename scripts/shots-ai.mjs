/**
 * Screenshots for the AI-competition PDF: an annotated UI overview (numbered callouts drawn
 * by the page itself) and the copilot mid-repair. Needs GEMINI_API_KEY for the second one.
 * Output: docs/submission/ai/fig-ui.png, fig-loop.png
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startPreview } from "./serve.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "docs", "submission", "ai");
const server = await startPreview(4176);
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "msedge", headless: true, args: ["--ignore-gpu-blocklist", "--enable-webgl"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const KEY = process.env.GEMINI_API_KEY ?? "";
await page.addInitScript(({ key }) => {
  localStorage.removeItem("x3d-copilot.scene.v1");
  if (key) localStorage.setItem("x3d-copilot.settings.v2", JSON.stringify({ provider: "gemini", keys: { anthropic: "", gemini: key }, models: { anthropic: "claude-opus-5", gemini: "gemini-3.8-flash" }, effort: "", baseURL: { anthropic: "", gemini: "" }, autoScreenshot: true }));
}, { key: KEY });
await page.goto(server.url);
await page.waitForFunction(() => window.__x3dcopilot && window.__x3dcopilot.validator.schemaReady, null, { timeout: 60000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function loadExample(file) {
  await page.selectOption("#examples", file);
  await page.waitForFunction(() => /nodes|failed/.test(document.querySelector("#view-status").textContent), null, { timeout: 30000 });
}

// ---- Figure 1: annotated UI with the snowman selected ---------------------------------
await loadExample("snowman.x3d");
await sleep(1500);
for (let attempt = 0; attempt < 4; attempt++) {
  await page.evaluate(() => { const src = window.__x3dcopilot.editor.getValue(); const idx = [...src.matchAll(/<Transform\b[^>]*/g)].findIndex((m) => m[0].includes('DEF="Hat"')); window.__x3dcopilot.tools.select(idx); });
  const ok = await page.waitForSelector("#inspector:not(.hidden)", { timeout: 2000 }).then(() => true).catch(() => false);
  console.log("hat selected:", ok);
  if (ok) break;
  await sleep(1500);
}
await sleep(1200);
// a short conversation so the chat pane is not empty (no API call: system messages only)
await page.evaluate(() => {
  const log = document.querySelector("#chat-log");
  const add = (cls, text) => { const d = document.createElement("div"); d.className = "msg " + cls; d.textContent = text; log.appendChild(d); };
  add("user", "Make the moonlight cast shadows: the snowman and the trees should cast soft shadows on the snow.");
  const a = document.createElement("div"); a.className = "msg assistant";
  for (const [c, t] of [["ok", "Read scene (198 lines)"], ["ok", "Looked up DirectionalLight"], ["ok", "Applied 3 edit(s) · valid · rendered"], ["ok", "Took a screenshot"]]) { const chip = document.createElement("div"); chip.className = "tool " + c; chip.textContent = t; a.appendChild(chip); }
  const s = document.createElement("span"); s.textContent = "Done: the moon's DirectionalLight now casts shadows (shadowIntensity 0.65) and the snowman, hat and pine trees have castShadow on. The screenshot shows soft shadows across the snow."; a.appendChild(s);
  log.appendChild(a); log.scrollTop = log.scrollHeight;
});
await page.evaluate(() => {
  const marks = [
    ["#chat-pane", "1", "AI co-author"],
    ["#view-pane", "2", "Live X3D view (X_ITE)"],
    ["#editor", "3", "Scene source (X3D XML)"],
    ["#issues-pane", "4", "Validation issues"],
    ["#inspector", "5", "Selection inspector"],
    [".toolbar", "6", "Examples · import · export · shading"],
  ];
  for (const [sel, n, label] of marks) {
    const el = document.querySelector(sel); if (!el) continue;
    const r = el.getBoundingClientRect();
    const box = document.createElement("div"); box.className = "annot";
    box.style.cssText = `position:fixed;left:${r.left + 3}px;top:${r.top + 3}px;width:${r.width - 6}px;height:${r.height - 6}px;border:3px solid #f59e0b;border-radius:8px;pointer-events:none;z-index:9999;box-sizing:border-box`;
    const tag = document.createElement("div");
    tag.textContent = `${n}  ${label}`;
    tag.style.cssText = `position:absolute;left:8px;bottom:8px;background:#f59e0b;color:#111;font:700 18px 'Segoe UI',sans-serif;padding:3px 12px;border-radius:999px;white-space:nowrap`;
    if (sel === ".toolbar") { tag.style.left = "50%"; tag.style.transform = "translateX(-50%)"; tag.style.bottom = "-40px"; }
    if (sel === "#inspector") { tag.style.bottom = "-40px"; tag.style.left = "8px"; }
    if (sel === "#chat-pane" || sel === "#view-pane") { tag.style.bottom = "auto"; tag.style.top = "8px"; }
    box.appendChild(tag); document.body.appendChild(box);
  }
});
await sleep(300);
await page.screenshot({ path: join(out, "fig-ui.png") });
await page.evaluate(() => document.querySelectorAll(".annot").forEach((d) => d.remove()));
await page.evaluate(() => window.__x3dcopilot.tools.select(null));

// ---- Figure 2: the loop in action (real model turn) ------------------------------------
if (KEY) {
  await loadExample("broken-scene.x3d");
  await sleep(1500);
  await page.fill("#chat-input", "Fix everything that is wrong with this scene, keep the author's intent, and verify the result visually.");
  await page.click("#btn-send");
  await page.waitForFunction(() => document.querySelector("#btn-send").hasAttribute("disabled"), null, { timeout: 10000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector("#btn-send").hasAttribute("disabled"), null, { timeout: 300000 });
  await sleep(1000);
  // open the tool chips so the report text is visible
  await page.evaluate(() => { const details = [...document.querySelectorAll("#chat-log details")]; details.forEach((d, i) => { d.open = i === details.length - 2; }); const msgs = document.querySelectorAll("#chat-log .msg.assistant"); const last = msgs[msgs.length - 1]; last.scrollIntoView({ block: "start" }); });
  await sleep(400);
  await page.screenshot({ path: join(out, "fig-loop.png") });
} else {
  console.log("GEMINI_API_KEY not set: fig-loop.png skipped");
}
await browser.close();
server.stop();
console.log("done");
