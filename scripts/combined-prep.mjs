/**
 * Assets for the combined "X3D Copilot" video (both competition entries merged, with the
 * two Web3D 2026 award seals): title/end cards and the two new narration lines.
 *
 *   node scripts/combined-prep.mjs
 * Writes docs/submission/video/raw-combined/card-{title,end}.png
 *        docs/submission/video/narration-combined/{s0.mp3,s99.mp3,index.json}
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { seal, SEAL_TOOLS, SEAL_AI } from "./seal.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const vdir = join(here, "..", "docs", "submission", "video");
const raw = join(vdir, "raw-combined");
const nar = join(vdir, "narration-combined");
mkdirSync(raw, { recursive: true });
mkdirSync(nar, { recursive: true });
const W = 1600, H = 900;

// Awards strip for the bottom-right corner: conference logo + the two seals, small.
const logo = readFileSync(join(vdir, "assets", "web3d-2026-logo.png")).toString("base64");
const corner = `<div style="position:absolute;right:44px;bottom:36px;display:flex;align-items:center;gap:22px">
  <img src="data:image/png;base64,${logo}" style="height:118px">
  ${seal(...SEAL_TOOLS, 150)}
  ${seal(...SEAL_AI, 150)}
</div>
<div style="position:absolute;right:44px;bottom:8px;font-size:15px;color:#8b98a5;letter-spacing:0.5px">Two awards at Web3D 2026 · Web3D Consortium</div>`;

async function card(context, name, title, subtitle, lines) {
  const p = await context.newPage();
  await p.setContent(`<html><body style="margin:0;width:${W}px;height:${H}px;background:#0f1216;color:#e6edf3;font-family:'Segoe UI',system-ui,sans-serif;position:relative">
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding-bottom:40px">
      <div style="display:flex;align-items:center;gap:18px;margin-bottom:18px"><svg viewBox='0 0 32 32' width='64' height='64'><path fill='#34d399' d='M16 2 3 9v14l13 7 13-7V9z'/><path fill='#065f46' d='M16 16 3 9v14l13 7z'/><path fill='#10b981' d='M16 16v14l13-7V9z'/></svg><div style="font-size:64px;font-weight:700">${title}</div></div>
      <div style="font-size:30px;color:#8b98a5;max-width:1200px">${subtitle}</div>
      <div style="margin-top:36px;font-size:24px;color:#34d399;line-height:1.6">${lines.join("<br/>")}</div>
    </div>
    ${corner}
  </body></html>`);
  await p.screenshot({ path: join(raw, `card-${name}.png`) });
  await p.close();
}

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: W, height: H } });
await card(context, "title", "X3D Copilot", "An X3D 4.0 editor with an AI co-author, entirely in the browser", ["Alberto Jaspe-Villanueva", "<span style=\"font-size:20px;color:#8b98a5\">https://albertojaspe.net</span>"]);
await card(context, "end", "X3D Copilot", "Open source · MIT · no installation · bring your own Gemini or Claude key", ["albertojaspe.net/x3d-copilot", "github.com/ajaspe/x3d-copilot"]);
await browser.close();
console.log("cards written");

// ---- narration for the new intro and outro ---------------------------------------------
const lines = [
  { id: 0, text: "X3D Copilot. Winner of the Tool of the Year and the AI and Web3D Innovation awards at Web3D 2026." },
  { id: 99, text: "X3D Copilot is open source under the MIT license, and live at albertojaspe.net slash x3d-copilot. Standard X3D 4.0 content, by construction. Thank you." },
];
// msedge-tts (node) gets 403 from the Edge endpoint since Oct 2026; the python edge-tts package still works.
const voice = process.env.TTS_VOICE ?? "en-US-AndrewMultilingualNeural";
const index = [];
for (const s of lines) {
  const file = join(nar, `s${s.id}.mp3`);
  execFileSync("python", ["-m", "edge_tts", "--voice", voice, "--text", s.text, "--write-media", file], { stdio: "inherit" });
  const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]).toString().trim());
  index.push({ id: s.id, file: `s${s.id}.mp3`, seconds: Math.round(dur * 100) / 100, text: s.text });
  console.log(`S${s.id}: ${dur.toFixed(1)} s`);
}
writeFileSync(join(nar, "index.json"), JSON.stringify(index, null, 2));
