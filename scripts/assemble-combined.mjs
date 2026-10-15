/**
 * Assemble the combined X3D Copilot video from the two competition recordings:
 * award title card, Tools S1 (AI still life), AI S2-S5 (snowman story), Tools S2-S3
 * (solar system, gizmo), Tools S5-S7 (validation and repair, PBR, import/export), award end card.
 * Same time-lapse rules as assemble-video.mjs.
 *
 *   node scripts/assemble-combined.mjs [--timelapse 8]
 * Inputs: raw/, raw-ai/, narration/, narration-ai/, raw-combined/ and narration-combined/ (combined-prep.mjs)
 * Output: docs/submission/video/x3d-copilot-combined.mp4
 */
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const vdir = join(here, "..", "docs", "submission", "video");
const arg = (name, def) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; };
const K = Number(arg("--timelapse", "8"));
// --fast: faster narration (combined-narrate-short.mjs), screen action at SPEED, idle stretches cut instead of lapsed
const SHORT = process.argv.includes("--fast");
const SPEED = SHORT ? Number(arg("--speed", "1.2")) : 1;

const src = {
  tools: { video: join(vdir, "raw", "demo.webm"), timeline: JSON.parse(readFileSync(join(vdir, "raw", "timeline.json"), "utf8")).timeline, narration: JSON.parse(readFileSync(join(vdir, "narration", "index.json"), "utf8")), dir: join(vdir, "narration") },
  ai: { video: join(vdir, "raw-ai", "demo.webm"), timeline: JSON.parse(readFileSync(join(vdir, "raw-ai", "timeline.json"), "utf8")).timeline, narration: JSON.parse(readFileSync(join(vdir, "narration-ai", "index.json"), "utf8")), dir: join(vdir, "narration-ai") },
};
const comb = { narration: JSON.parse(readFileSync(join(vdir, "narration-combined", "index.json"), "utf8")), dir: join(vdir, "narration-combined") };
const short = SHORT ? { narration: JSON.parse(readFileSync(join(vdir, "narration-combined", "fast", "index.json"), "utf8")), dir: join(vdir, "narration-combined", "fast") } : null;
// narration lookup per segment: short variant keys are t1/a2/..., s0 and s99 for the cards
const narFor = (name, id) => {
  if (SHORT) { const key = `${name[0]}${id}`; return { secs: short.narration.find((n) => n.id === key)?.seconds ?? 0, file: join(short.dir, `${key}.mp3`) }; }
  return { secs: src[name].narration.find((n) => n.id === id)?.seconds ?? 0, file: join(src[name].dir, `s${id}.mp3`) };
};
const cardNar = (id) => SHORT ? { secs: short.narration.find((n) => n.id === `s${id}`)?.seconds ?? 0, file: join(short.dir, `s${id}.mp3`) } : { secs: comb.narration.find((n) => n.id === id)?.seconds ?? 0, file: join(comb.dir, `s${id}.mp3`) };
const cardTitle = join(vdir, "raw-combined", "card-title.png");
const cardEnd = join(vdir, "raw-combined", "card-end.png");
const badge = join(vdir, "badge-fast.png");
const useBadge = existsSync(badge) && K > 1;

// [source, segment id, hold]: hold = seconds to linger on the segment's last frame (static result shots)
const ORDER = [
  ["tools", 1, 4], ["ai", 2], ["ai", 3], ["ai", 4], ["ai", 5],
  ["tools", 2], ["tools", 3], ["tools", 5], ["tools", 6], ["tools", 7],
];
const TITLE = cardNar(0).secs + (SHORT ? 1.5 : 2.0);
const END = cardNar(99).secs + 2.5;
const GAP = SHORT ? 1.2 : 2.2; // silence kept after each narration before the next segment

// ---- parts ----------------------------------------------------------------------
const parts = []; // { input, from, to, speed } or { card, seconds }
const audio = []; // { file, at }
let cursor = 0;
const push = (input, from, to, speed) => { if (to - from < 0.05) return; parts.push({ input, from, to, speed }); cursor += (to - from) / speed; };

parts.push({ card: 2, seconds: TITLE }); audio.push({ file: cardNar(0).file, at: cursor + 0.5 }); cursor += TITLE;
for (const [name, id, hold = 0] of ORDER) {
  const s = src[name];
  const i = s.timeline.findIndex((t) => t.id === id);
  const seg = s.timeline[i];
  const next = s.timeline[i + 1].start;
  const input = name === "tools" ? 0 : 1;
  const nar = narFor(name, id);
  audio.push({ file: nar.file, at: cursor + 0.3 });
  const len = next - seg.start;
  // source seconds that play at SPEED while the narration runs (output length = narration + GAP)
  const keep = Math.min(len, (nar.secs + GAP) * SPEED);
  push(input, seg.start, seg.start + keep, SPEED);
  if (SHORT && seg.busyUntil === undefined) {
    // nothing is computed here, just the user driving the UI: cut the rest, keep a final hold if asked
    if (hold > 0) push(input, next - 0.2, next, 0.2 / hold);
    console.log(`${name} S${id} -> ${(cursor).toFixed(1)} s`);
    continue;
  }
  const lapseEnd = seg.busyUntil !== undefined ? Math.min(next, Math.max(seg.start + keep, seg.busyUntil)) : next;
  const tail = Math.max(0, next - lapseEnd);
  const lapseLen = lapseEnd - (seg.start + keep);
  let k = K;
  const need = nar.secs + GAP - 0.2 - keep / SPEED - tail / SPEED;
  if (lapseLen > 0.3 && need > 0) k = Math.max(1, Math.min(K, lapseLen / need));
  if (lapseLen > 0.3) push(input, seg.start + keep, lapseEnd, k);
  if (tail > 0.05) push(input, lapseEnd, next, SPEED);
  if (hold > 0) push(input, next - 0.2, next, 0.2 / hold); // slow-motion of a static shot = a hold
  console.log(`${name} S${id} -> ${(cursor).toFixed(1)} s`);
}
const endAt = cursor;
parts.push({ card: 3, seconds: END }); audio.push({ file: cardNar(99).file, at: cursor + 0.6 }); cursor += END;
const total = cursor;

// ---- ffmpeg -----------------------------------------------------------------------
const args = ["-y", "-i", src.tools.video, "-i", src.ai.video, "-loop", "1", "-t", String(TITLE + 1), "-i", cardTitle, "-loop", "1", "-t", String(END + 1), "-i", cardEnd];
let badgeIdx = -1;
if (useBadge) { badgeIdx = 4; args.push("-loop", "1", "-i", badge); }
const a0 = args.filter((a) => a === "-i").length;
for (const a of audio) args.push("-i", a.file);

const f = [], labels = [];
const norm = "scale=1600:900,setsar=1,fps=25,format=yuv420p";
parts.forEach((p, i) => {
  if (p.card !== undefined) {
    const fade = p.card === 2 ? `fade=t=out:st=${(p.seconds - 0.6).toFixed(2)}:d=0.6` : `fade=t=in:st=0:d=0.8`;
    f.push(`[${p.card}:v]trim=0:${p.seconds.toFixed(2)},setpts=PTS-STARTPTS,${norm},${fade}[p${i}]`);
    labels.push(`[p${i}]`);
    return;
  }
  f.push(`[${p.input}:v]trim=start=${p.from.toFixed(3)}:end=${p.to.toFixed(3)},setpts=(PTS-STARTPTS)/${p.speed},${norm}[p${i}]`);
  if (p.speed > 1.05 && useBadge) { f.push(`[p${i}][${badgeIdx}:v]overlay=x=W-w-24:y=24:shortest=1[pb${i}]`); labels.push(`[pb${i}]`); }
  else labels.push(`[p${i}]`);
});
f.push(`${labels.join("")}concat=n=${parts.length}:v=1:a=0,fps=30[vout]`);
const amix = [];
audio.forEach((a, i) => { const d = Math.round(a.at * 1000); f.push(`[${a0 + i}:a]adelay=${d}|${d}[a${i}]`); amix.push(`[a${i}]`); });
f.push(`${amix.join("")}amix=inputs=${audio.length}:normalize=0,apad[aout]`);

const out = join(vdir, SHORT ? "x3d-copilot-combined-fast.mp4" : "x3d-copilot-combined.mp4");
args.push("-filter_complex", f.join(";"), "-map", "[vout]", "-map", "[aout]", "-t", total.toFixed(2), "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out);
console.log(`end card at ${endAt.toFixed(1)} s, total ${total.toFixed(1)} s`);
execFileSync("ffmpeg", ["-v", "error", ...args], { stdio: "inherit" });
console.log("done:", out);
