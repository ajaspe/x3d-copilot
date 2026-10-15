/**
 * Assets for the combined "X3D Copilot" video (both competition entries merged, with the
 * two Web3D 2026 award seals): title/end cards and the two new narration lines.
 *
 *   node scripts/combined-prep.mjs
 * Writes docs/submission/video/raw-combined/card-{title,end}.png
 *        docs/submission/video/narration-combined/{s0.mp3,s99.mp3,index.json}
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const vdir = join(here, "..", "docs", "submission", "video");
const raw = join(vdir, "raw-combined");
const nar = join(vdir, "narration-combined");
mkdirSync(raw, { recursive: true });
mkdirSync(nar, { recursive: true });
const W = 1600, H = 900;

// ---- award seal (SVG) -------------------------------------------------------------
function seal(line1, line2, line3) {
  const R = 150;
  const rr = R - 24; // ring-text radius
  const circ = (2 * Math.PI * rr).toFixed(1);
  const ring = "WEB3D CONSORTIUM  ·  WEB3D 2026  ·  DOHA, QATAR  ·  INTERNATIONAL CONFERENCE  ·  ";
  const id = "ring" + Math.random().toString(36).slice(2, 7);
  return `<svg viewBox="${-R - 6} ${-R - 6} ${2 * R + 12} ${2 * R + 12}" width="${2 * R + 12}" height="${2 * R + 12}" xmlns="http://www.w3.org/2000/svg">
    <defs><path id="${id}" d="M 0 ${-rr} A ${rr} ${rr} 0 1 1 -0.01 ${-rr}"/></defs>
    <circle r="${R}" fill="#121a14" stroke="#d9b24a" stroke-width="4"/>
    <circle r="${R - 10}" fill="none" stroke="#d9b24a" stroke-width="1.5"/>
    <circle r="${R - 40}" fill="none" stroke="#d9b24a" stroke-width="1.5" opacity="0.6"/>
    <text font-family="'Segoe UI',system-ui,sans-serif" font-size="14" font-weight="600" fill="#e9d48a"><textPath href="#${id}" startOffset="0" textLength="${circ}" lengthAdjust="spacing">${ring}</textPath></text>
    <text y="-56" text-anchor="middle" font-size="20" fill="#d9b24a">★</text>
    <text y="-30" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="15" font-weight="700" fill="#e9d48a" letter-spacing="4">WINNER</text>
    <text y="2" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="21" font-weight="700" fill="#ffffff">${line1}</text>
    <text y="30" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="21" font-weight="700" fill="#ffffff">${line2}</text>
    <line x1="-40" y1="44" x2="40" y2="44" stroke="#d9b24a" stroke-width="1"/>
    <text y="66" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="15" font-weight="600" fill="#e9d48a">${line3}</text>
  </svg>`;
}
const seals = `<div style="display:flex;gap:70px;align-items:center;justify-content:center">
  ${seal("Web3D / Metaverse", "Tool of the Year", "TOOLS COMPETITION")}
  ${seal("AI &amp; Web3D Innovation", "Competition", "1ST PRIZE")}
</div>`;

async function card(context, name, title, subtitle, lines, footer) {
  const p = await context.newPage();
  await p.setContent(`<html><body style="margin:0;width:${W}px;height:${H}px;background:#0f1216;color:#e6edf3;font-family:'Segoe UI',system-ui,sans-serif;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center">
    <div style="display:flex;align-items:center;gap:18px;margin-bottom:10px"><svg viewBox='0 0 32 32' width='64' height='64'><path fill='#34d399' d='M16 2 3 9v14l13 7 13-7V9z'/><path fill='#065f46' d='M16 16 3 9v14l13 7z'/><path fill='#10b981' d='M16 16v14l13-7V9z'/></svg><div style="font-size:64px;font-weight:700">${title}</div></div>
    <div style="font-size:28px;color:#8b98a5;max-width:1200px">${subtitle}</div>
    <div style="margin:34px 0 22px">${seals}</div>
    <div style="font-size:21px;color:#e9d48a;letter-spacing:1px">${footer}</div>
    <div style="margin-top:22px;font-size:22px;color:#34d399;line-height:1.6">${lines.join("<br/>")}</div>
  </body></html>`);
  await p.screenshot({ path: join(raw, `card-${name}.png`) });
  await p.close();
}

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: W, height: H } });
await card(context, "title", "X3D Copilot", "An X3D 4.0 editor with an AI co-author, entirely in the browser",
  ["Alberto Jaspe-Villanueva · KAUST"], "Two awards at Web3D 2026, by the Web3D Consortium");
await card(context, "end", "X3D Copilot", "Open source · MIT · no installation · bring your own Gemini or Claude key",
  ["albertojaspe.net/x3d-copilot", "github.com/ajaspe/x3d-copilot"], "Web3D 2026 · Doha, Qatar · awarded by the Web3D Consortium");
await browser.close();
console.log("cards written");

// ---- narration for the new intro and outro ---------------------------------------------
const lines = [
  { id: 0, text: "X3D Copilot, winner of the Web3D and Metaverse Tool of the Year award, and first prize of the AI and Web3D Innovation Competition at Web3D 2026, both awarded by the Web3D Consortium." },
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
