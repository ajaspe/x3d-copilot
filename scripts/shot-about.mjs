/** Screenshot of the About dialog from the built app (for a quick visual check). */
import { chromium } from "playwright";
import { startPreview } from "./serve.mjs";
const out = process.argv[2];
const server = await startPreview(4179);
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "msedge", headless: true, args: ["--ignore-gpu-blocklist", "--enable-webgl"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(server.url);
await page.waitForSelector("#btn-about");
await page.click("#btn-about");
await page.waitForSelector("#about[open]");
await page.waitForTimeout(500);
await page.screenshot({ path: out });
await browser.close();
server.stop();
console.log("shot", out);
