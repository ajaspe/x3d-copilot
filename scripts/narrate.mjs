/**
 * Generate narration audio for the demo video from docs/submission/video/script.md
 * using Microsoft Edge neural TTS (msedge-tts). Writes narration/sN.mp3 and
 * narration/index.json with durations (via ffprobe).
 *
 *   node scripts/narrate.mjs [voice]
 */
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const vdir = join(here, "..", "docs", "submission", "video");
const vi = process.argv.indexOf("--variant");
const variant = vi >= 0 ? process.argv[vi + 1] : "";
const suffix = variant ? `-${variant}` : "";
const outDir = join(vdir, `narration${suffix}`);
mkdirSync(outDir, { recursive: true });
const voice = process.env.TTS_VOICE ?? "en-US-AndrewMultilingualNeural";

const md = readFileSync(join(vdir, `script${suffix}.md`), "utf8");
const segments = [...md.matchAll(/^\*\*S(\d+)\.\*\*\s+([\s\S]*?)(?=^\*\*S\d+\.\*\*|\n## |$(?![\r\n]))/gm)].map((m) => ({ id: Number(m[1]), text: m[2].replace(/\s+/g, " ").trim() }));
if (!segments.length) throw new Error("no narration segments found in script.md");

const tts = new MsEdgeTTS();
await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

const index = [];
for (const s of segments) {
  const file = join(outDir, `s${s.id}.mp3`);
  const { audioStream } = tts.toStream(s.text);
  const chunks = [];
  for await (const c of audioStream) chunks.push(c);
  writeFileSync(file, Buffer.concat(chunks));
  const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]).toString().trim());
  index.push({ id: s.id, file: `s${s.id}.mp3`, seconds: Math.round(dur * 100) / 100, text: s.text });
  console.log(`S${s.id}: ${dur.toFixed(1)} s`);
}
writeFileSync(join(outDir, "index.json"), JSON.stringify(index, null, 2));
console.log("total narration:", index.reduce((a, b) => a + b.seconds, 0).toFixed(1), "s");
