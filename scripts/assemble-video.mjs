/**
 * Assemble the final demo video: recording + title cards + narration -> MP4 (H.264/AAC).
 *
 *   node scripts/assemble-video.mjs
 * Inputs: docs/submission/video/raw/{demo.webm,timeline.json,card-*.png}, narration/{index.json,sN.mp3}
 * Output: docs/submission/video/x3d-copilot-demo.mp4
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const vdir = join(here, "..", "docs", "submission", "video");
const vi = process.argv.indexOf("--variant");
const variant = vi >= 0 ? process.argv[vi + 1] : "";
const suffix = variant ? `-${variant}` : "";
const raw = join(vdir, `raw${suffix}`);
const { timeline } = JSON.parse(readFileSync(join(raw, "timeline.json"), "utf8"));
const narration = JSON.parse(readFileSync(join(vdir, `narration${suffix}`, "index.json"), "utf8"));
const startOf = (id) => timeline.find((t) => t.id === id)?.start ?? 0;
const end = startOf("end");
const TITLE_SECONDS = 6;
const lastId = Math.max(...narration.map((n) => n.id));
const END_SECONDS = Math.max(8, (narration.find((n) => n.id === lastId)?.seconds ?? 20) - (variant ? -2 : 8));
const total = end + END_SECONDS;

// inputs: 0 video, 1 title card, 2 end card, 3.. narration
const args = ["-y", "-i", join(raw, "demo.webm"), "-loop", "1", "-i", join(raw, "card-title.png"), "-loop", "1", "-i", join(raw, "card-end.png")];
for (const n of narration) args.push("-i", join(vdir, `narration${suffix}`, n.file));
// extra full-screen cards for segments flagged with card:<name> (shown for the segment length)
const cards = timeline.filter((t) => t.card);
for (const c of cards) args.push("-loop", "1", "-i", join(raw, `card-${c.card}.png`));

const f = [];
// video: pad the recording so the end card can be shown after it, overlay cards with fades
f.push(`[0:v]tpad=stop_mode=clone:stop_duration=${END_SECONDS + 1},scale=1600:900,setsar=1[base]`);
f.push(`[1:v]format=rgba,fade=t=out:st=${TITLE_SECONDS - 0.8}:d=0.8:alpha=1[title]`);
f.push(`[base][title]overlay=enable='between(t,0,${TITLE_SECONDS})'[v1]`);
f.push(`[2:v]format=rgba,fade=t=in:st=${end}:d=0.8:alpha=1[endc]`);
let cur = "v1";
cards.forEach((c, i) => {
  const idx = 3 + narration.length + i;
  const next = timeline[timeline.indexOf(c) + 1]?.start ?? end;
  f.push(`[${idx}:v]format=rgba,fade=t=in:st=${c.start}:d=0.6:alpha=1,fade=t=out:st=${next - 0.6}:d=0.6:alpha=1[card${i}]`);
  f.push(`[${cur}][card${i}]overlay=enable='between(t,${c.start},${next})'[vc${i}]`);
  cur = `vc${i}`;
});
f.push(`[${cur}][endc]overlay=enable='gte(t,${end})'[vout]`);
// audio: each narration delayed to its segment start, mixed
const amix = [];
narration.forEach((n, i) => {
  const delay = Math.max(0, Math.round((startOf(n.id) + (n.id === 1 ? 0.5 : 0.3)) * 1000));
  f.push(`[${3 + i}:a]adelay=${delay}|${delay}[a${i}]`);
  amix.push(`[a${i}]`);
});
f.push(`${amix.join("")}amix=inputs=${narration.length}:normalize=0,apad[aout]`);

args.push("-filter_complex", f.join(";"), "-map", "[vout]", "-map", "[aout]", "-t", String(total), "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", join(vdir, `x3d-copilot${suffix}-demo.mp4`));
console.log("ffmpeg", args.join(" ").slice(0, 300), "...");
execFileSync("ffmpeg", args, { stdio: "inherit" });
console.log(`done: ${join(vdir, `x3d-copilot${suffix}-demo.mp4`)} (${total.toFixed(1)} s)`);
