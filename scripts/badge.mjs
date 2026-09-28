/** Render the small "time-lapse" badge overlay used by assemble-video.mjs. */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "docs", "submission", "video", "badge-fast.png");
const factor = process.argv[2] ?? "4";
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 400, height: 56 } });
await page.setContent(`<html><body style="margin:0;background:transparent"><div style="display:inline-flex;align-items:center;gap:10px;height:54px;padding:0 18px;border-radius:28px;background:rgba(15,18,22,0.85);border:1px solid #34d399;color:#e6edf3;font:600 22px 'Segoe UI',system-ui,sans-serif;white-space:nowrap">&#9193; time-lapse ${factor}&times; <span style="color:#8b98a5;font-weight:400;font-size:18px">model working</span></div></body></html>`);
await page.screenshot({ path: out, omitBackground: true });
await browser.close();
console.log("wrote", out);
