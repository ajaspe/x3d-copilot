/**
 * Transparent 1600x900 overlays that highlight the three main panes (for the combined video's UI tour).
 * Pane rectangles are measured on the built app at the recording's viewport.
 *   node scripts/ui-highlights.mjs  ->  docs/submission/video/raw-combined/hl-{chat,view,source}.png
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startPreview } from "./serve.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "docs", "submission", "video", "raw-combined");
mkdirSync(out, { recursive: true });
const W = 1600, H = 900;

const server = await startPreview(4181);
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "msedge", headless: true, args: ["--ignore-gpu-blocklist", "--enable-webgl"] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.addInitScript(() => { localStorage.removeItem("x3d-copilot.settings.v2"); });
await page.goto(server.url);
await page.waitForSelector("#editor .cm-editor");
const rects = await page.evaluate(() => {
  const r = (sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; };
  return { chat: r("#chat-pane"), view: r("#view-pane"), source: r("#code-pane") };
});
console.log(JSON.stringify(rects));

const labels = { chat: "AI copilot", view: "3D scene (X_ITE)", source: "X3D source" };
for (const [key, r] of Object.entries(rects)) {
  const p = await browser.newPage({ viewport: { width: W, height: H } });
  const labelPos = key === "view" ? "top:14px;left:50%;transform:translateX(-50%)" : "top:14px;left:14px";
  await p.setContent(`<html><body style="margin:0;width:${W}px;height:${H}px;background:transparent;font-family:'Segoe UI',system-ui,sans-serif">
    <div style="position:absolute;left:${r.x + 3}px;top:${r.y + 3}px;width:${r.w - 6}px;height:${r.h - 6}px;border:5px solid #f59e0b;border-radius:10px;box-sizing:border-box;box-shadow:0 0 0 4px rgba(245,158,11,0.25),0 0 40px rgba(245,158,11,0.35)">
      <div style="position:absolute;${labelPos};background:#f59e0b;color:#111;font:700 28px 'Segoe UI',sans-serif;padding:6px 20px;border-radius:999px;white-space:nowrap;box-shadow:0 2px 10px rgba(0,0,0,.6)">${labels[key]}</div>
    </div></body></html>`);
  await p.screenshot({ path: join(out, `hl-${key}.png`), omitBackground: true });
  await p.close();
}
await browser.close();
server.stop();
console.log("overlays written to", out);
