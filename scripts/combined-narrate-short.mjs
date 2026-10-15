/**
 * Faster narration for the compact combined video: same scenes, slightly tighter wording,
 * spoken about 20% faster (edge-tts rate).
 *   node scripts/combined-narrate-short.mjs [--rate +20%]
 * Writes docs/submission/video/narration-combined/fast/{<id>.mp3,index.json}
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "docs", "submission", "video", "narration-combined", "fast");
mkdirSync(out, { recursive: true });
const voice = process.env.TTS_VOICE ?? "en-US-AndrewMultilingualNeural";
const ri = process.argv.indexOf("--rate");
const rate = ri >= 0 ? process.argv[ri + 1] : "+20%";

const lines = [
  ["s0", "X3D Copilot. Winner of the Tool of the Year and the AI and Web3D Innovation awards at Web3D 2026."],
  // tools S1 is split into a UI tour (with pane highlights) while the first prompt runs, and the result line
  ["t1i", "X3D Copilot is an X3D 4.0 editor with a built-in AI co-author, and it runs entirely in the browser. The interface has three parts."],
  ["t1s", "On the right, the X3D source: the file itself, with autocompletion and validation as you type."],
  ["t1c", "On the left, the AI copilot. It works with different models, Gemini or Claude, using your own key."],
  ["t1v", "And in the middle, the live 3D scene, rendered by X_ITE."],
  ["t1p", "Let's start with one sentence: a studio still life with a ceramic vase, a bronze sphere and a glass cube. The copilot looks up the nodes it needs in the specification database, writes the file, validates it against the X3D schema, a semantic linter and the X_ITE runtime, and checks a screenshot before answering."],
  ["t1r", "And here is the result: standard X3D 4.0, with physically based materials and shadows, that you can now edit by hand."],
  ["a2", "Now from an empty file and one sentence: a snowman on snowy ground at night, under a starry sky. Watch the tool steps: the model looks up nodes in the specification whenever it needs a field name or a default, writes the scene, validates it, and any error goes straight back to the model. Then it takes a screenshot to check the render before answering."],
  ["a3", "We build on it: a carrot nose, coal eyes and buttons, stick arms, a scarf and a top hat. The model reads the current scene and adds only what is needed, with exact patches, each validated again."],
  ["a4", "Some atmosphere: we ask for the moonlight to cast shadows. The model turns the moon's light into a shadow caster, with standard X3D 4.0 lighting fields that the validators accept."],
  ["a5", "Interaction comes last. Clicking the snowman should make his hat jump. The model adds a TouchSensor, a TimeSensor and a PositionInterpolator, and the linter checks every ROUTE. And now we click him: the hat hops and lands back, exactly as any X3D browser would run it."],
  ["t2", "It is also a complete editor. Three panes: the copilot, a live X_ITE view and the source. Scenes render as you type: this solar system runs nested Transforms with independent TimeSensors and interpolators. And autocompletion is generated from the X3D Unified Object Model, so it knows every node, its allowed children and every field."],
  ["t3", "Objects can be manipulated directly. Clicking geometry selects its Transform. The gizmo is itself X3D: PlaneSensors and CylinderSensors injected at runtime, never written to your file. Drag the handles, or scrub the numbers, and the source updates. The selection is also passed to the copilot, so \"make this twice as big\" just works."],
  ["t5", "Validation is the heart of the tool, in three layers: the official X3D 4.0 schema running in WebAssembly, a semantic linter with about thirty rules the schema cannot express, and the X_ITE runtime. This broken scene shows eleven errors, each with a line number, an explanation and a suggested fix. And the copilot can only act through these same checks: it patches the scene, reads the report back, and repairs its own mistakes until the scene is valid."],
  ["t6", "X3D 4.0 rendering features are all there: PhysicalMaterial with metallic and roughness, shadows, texture projection, and shading modes from Phong to wireframe."],
  ["t7", "Other formats become editable X3D: glTF, OBJ, STL, PLY and VRML are converted through X_ITE's loaders and normalised to X3D 4.0. Export as X3D XML, Classic VRML, JSON, or a PNG."],
  ["s99", "X3D Copilot is open source under the MIT license, and live at albertojaspe.net slash x3d-copilot. Standard X3D 4.0 content, by construction. Thank you."],
];
const index = [];
for (const [id, text] of lines) {
  const file = join(out, `${id}.mp3`);
  execFileSync("python", ["-m", "edge_tts", "--voice", voice, `--rate=${rate}`, "--text", text, "--write-media", file], { stdio: "inherit" });
  const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]).toString().trim());
  index.push({ id, file: `${id}.mp3`, seconds: Math.round(dur * 100) / 100, text });
  console.log(`${id}: ${dur.toFixed(1)} s`);
}
writeFileSync(join(out, "index.json"), JSON.stringify(index, null, 2));
console.log("total narration:", index.reduce((a, b) => a + b.seconds, 0).toFixed(1), "s");
