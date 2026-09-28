/**
 * Assemble the final demo video: recording + title/end cards + narration -> MP4 (H.264/AAC).
 * Portions of a segment that run past its narration (the model working) are time-lapsed
 * with a small on-screen badge, so the video stays tight without cutting anything.
 *
 *   node scripts/assemble-video.mjs [--variant ai] [--timelapse 4]
 * Inputs: docs/submission/video/raw[-variant]/{demo.webm,timeline.json,card-*.png},
 *         narration[-variant]/{index.json,sN.mp3}, badge-fast.png (scripts/badge.mjs)
 * Output: docs/submission/video/x3d-copilot[-variant]-demo.mp4
 */
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const vdir = join(here, "..", "docs", "submission", "video");
const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
};
const variant = arg("--variant", "");
const K = Number(arg("--timelapse", "4"));
const suffix = variant ? `-${variant}` : "";
const raw = join(vdir, `raw${suffix}`);
const { timeline } = JSON.parse(readFileSync(join(raw, "timeline.json"), "utf8"));
const narration = JSON.parse(readFileSync(join(vdir, `narration${suffix}`, "index.json"), "utf8"));
const secs = (id) => narration.find((n) => n.id === id)?.seconds ?? 0;
const badge = join(vdir, "badge-fast.png");
const useBadge = existsSync(badge) && K > 1;

// ---- build the list of video parts (1x or time-lapsed) and the new timeline -----------
const segs = timeline.filter((t) => t.id !== "end");
const endSrc = timeline.find((t) => t.id === "end").start;
const parts = []; // { from, to, speed }
const newStart = {}; // id -> new start time
let cursor = 0; // new-time cursor
const push = (from, to, speed) => {
  if (to - from < 0.05) return;
  parts.push({ from, to, speed });
  cursor += (to - from) / speed;
};
push(0, segs[0].start, 1);
segs.forEach((s, i) => {
  const next = i + 1 < segs.length ? segs[i + 1].start : endSrc;
  newStart[s.id] = cursor;
  const len = next - s.start;
  const keep = s.card ? len : Math.min(len, secs(s.id) + 1.5);
  push(s.start, s.start + keep, 1);
  // time-lapse only while the model was working (busyUntil, stamped by the recorder); the result plays at 1x
  const lapseEnd = s.busyUntil !== undefined ? Math.min(next, Math.max(s.start + keep, s.busyUntil)) : next;
  if (lapseEnd - (s.start + keep) > 0.3) push(s.start + keep, lapseEnd, K);
  if (next - lapseEnd > 0.05) push(lapseEnd, next, 1);
});
const TITLE_SECONDS = 6;
const lastId = Math.max(...narration.map((n) => n.id));
// The last segment is the closing card: overlay it from that segment's start and end shortly after its narration.
const end = newStart[lastId];
const END_SECONDS = Math.max(secs(lastId) + 1.5, cursor - end);
const total = end + END_SECONDS;

// ---- ffmpeg inputs: 0 video, 1 title, 2 end, 3.. narration, then cards, then badge ------
const args = ["-y", "-i", join(raw, "demo.webm"), "-loop", "1", "-i", join(raw, "card-title.png"), "-loop", "1", "-i", join(raw, "card-end.png")];
for (const n of narration) args.push("-i", join(vdir, `narration${suffix}`, n.file));
const cards = segs.filter((t) => t.card);
for (const c of cards) args.push("-loop", "1", "-i", join(raw, `card-${c.card}.png`));
const badgeIdx = 3 + narration.length + cards.length;
if (useBadge) args.push("-loop", "1", "-i", badge);

const f = [];
// video parts
const labels = [];
parts.forEach((p, i) => {
  f.push(`[0:v]trim=start=${p.from.toFixed(3)}:end=${p.to.toFixed(3)},setpts=(PTS-STARTPTS)/${p.speed}[p${i}]`);
  if (p.speed > 1 && useBadge) {
    f.push(`[p${i}][${badgeIdx}:v]overlay=x=W-w-24:y=24:shortest=1[pb${i}]`);
    labels.push(`[pb${i}]`);
  } else labels.push(`[p${i}]`);
});
f.push(`${labels.join("")}concat=n=${parts.length}:v=1:a=0[cat]`);
f.push(`[cat]tpad=stop_mode=clone:stop_duration=${END_SECONDS + 1},scale=1600:900,setsar=1,fps=30[base]`);
f.push(`[1:v]format=rgba,fade=t=out:st=${TITLE_SECONDS - 0.8}:d=0.8:alpha=1[title]`);
f.push(`[base][title]overlay=enable='between(t,0,${TITLE_SECONDS})'[v1]`);
let cur = "v1";
cards.forEach((c, i) => {
  const idx = 3 + narration.length + i;
  const j = segs.indexOf(c);
  const st = newStart[c.id];
  const nx = j + 1 < segs.length ? newStart[segs[j + 1].id] : end;
  f.push(`[${idx}:v]format=rgba,fade=t=in:st=${st.toFixed(2)}:d=0.6:alpha=1,fade=t=out:st=${(nx - 0.6).toFixed(2)}:d=0.6:alpha=1[card${i}]`);
  f.push(`[${cur}][card${i}]overlay=enable='between(t,${st.toFixed(2)},${nx.toFixed(2)})'[vc${i}]`);
  cur = `vc${i}`;
});
f.push(`[2:v]format=rgba,fade=t=in:st=${end.toFixed(2)}:d=0.8:alpha=1[endc]`);
f.push(`[${cur}][endc]overlay=enable='gte(t,${end.toFixed(2)})'[vout]`);
// audio
const amix = [];
narration.forEach((n, i) => {
  const delay = Math.max(0, Math.round(((newStart[n.id] ?? 0) + (n.id === 1 ? 0.5 : 0.3)) * 1000));
  f.push(`[${3 + i}:a]adelay=${delay}|${delay}[a${i}]`);
  amix.push(`[a${i}]`);
});
f.push(`${amix.join("")}amix=inputs=${narration.length}:normalize=0,apad[aout]`);

const out = join(vdir, `x3d-copilot${suffix}-demo.mp4`);
args.push("-filter_complex", f.join(";"), "-map", "[vout]", "-map", "[aout]", "-t", String(total.toFixed(2)), "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out);
console.log("segments (new start s):", Object.entries(newStart).map(([k, v]) => `S${k}@${v.toFixed(1)}`).join(" "), `end@${end.toFixed(1)}`);
execFileSync("ffmpeg", ["-v", "error", ...args], { stdio: "inherit" });
console.log(`done: ${out} (${total.toFixed(1)} s)`);
