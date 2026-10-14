/**
 * One-slide fast-forward presentation (16:9) with the embedded highlight clip.
 * Run from the scratchpad where pptxgenjs is installed:
 *   node <repo>/scripts/fastforward-slide.cjs <repo>/docs/submission/fastforward
 */
const path = require("path");
const fs = require("fs");
const pptxgen = require("pptxgenjs");

const outDir = process.argv[2];
const video = path.join(outDir, "highlight.mp4");
const cover = path.join(outDir, "cover.png");
const qr = path.join(outDir, "qr.png");

const THEME = {
  name: "X3D Copilot",
  headFontFace: "Calibri",
  bodyFontFace: "Calibri",
  colors: { dk1: "0F1216", lt1: "FFFFFF", dk2: "161B22", lt2: "E6EDF3", accent1: "34D399", accent2: "F59E0B", accent3: "8B98A5", accent4: "60A5FA", accent5: "10B981", accent6: "2A323C", hlink: "34D399", folHlink: "34D399" },
};

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.author = "Alberto Jaspe-Villanueva";
pres.title = "Closing the Loop: AI authoring of X3D 4.0 that conforms by construction";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };

const slide = pres.addSlide();
slide.background = { color: THEME.colors.dk1 };

// ---- left column ---------------------------------------------------------------
const L = 0.6;
slide.addText("Closing the Loop", { x: L, y: 0.45, w: 5.6, h: 0.8, fontSize: 40, bold: true, color: "FFFFFF", margin: 0, isTextBox: true, objectName: "Title" });
slide.addText("AI that writes X3D 4.0 scenes, and cannot ship an invalid one", { x: L, y: 1.2, w: 5.6, h: 0.75, fontSize: 19, color: THEME.colors.accent1, margin: 0, isTextBox: true, objectName: "Tagline" });

// three callouts
const rows = [
  ["260", "nodes of the X3D 4.0 object model, read by the AI through a tool instead of guessed from memory"],
  ["3", "independent validators on every edit: official XML Schema, spec-derived linter, X_ITE runtime"],
  ["1", "screenshot: the AI looks at its own render before it answers"],
];
let y = 2.25;
for (const [num, text] of rows) {
  slide.addShape(pres.ShapeType.roundRect, { x: L, y, w: 5.6, h: 0.95, fill: { color: THEME.colors.dk2 }, line: { color: THEME.colors.accent6, width: 0.75 }, rectRadius: 0.12, objectName: "Card " + num });
  slide.addText(num, { x: L + 0.15, y: y + 0.08, w: 1.0, h: 0.8, fontSize: 40, bold: true, color: THEME.colors.accent1, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: "Stat " + num });
  slide.addText(text, { x: L + 1.25, y: y + 0.08, w: 4.2, h: 0.8, fontSize: 14, color: THEME.colors.lt2, valign: "middle", margin: 0, isTextBox: true, objectName: "Stat text " + num });
  y += 1.1;
}

// result line
slide.addText([
  { text: "Result: ", options: { bold: true, color: THEME.colors.accent2 } },
  { text: "standards-conformant 3D content by construction. Runs entirely in the browser, open source (MIT), works with Gemini or Claude using your own key.", options: { color: THEME.colors.lt2 } },
], { x: L, y: 5.6, w: 5.6, h: 0.8, fontSize: 14, margin: 0, isTextBox: true, valign: "top", objectName: "Result" });

// ---- right column: video --------------------------------------------------------
const VX = 6.6, VY = 0.55, VW = 6.15, VH = VW * 9 / 16; // 6.15 x 3.46
slide.addShape(pres.ShapeType.roundRect, { x: VX - 0.08, y: VY - 0.08, w: VW + 0.16, h: VH + 0.16, fill: { color: THEME.colors.dk2 }, line: { color: THEME.colors.accent6, width: 0.75 }, rectRadius: 0.1, objectName: "Video frame" });
slide.addMedia({ type: "video", path: video, cover: "image/png;base64," + fs.readFileSync(cover).toString("base64"), x: VX, y: VY, w: VW, h: VH, objectName: "Highlight video" });
slide.addText("Snowman from one sentence, then details, moon shadows and a click behaviour. Every step validated; eleven planted errors repaired in one request.", { x: VX, y: VY + VH + 0.12, w: VW, h: 0.55, fontSize: 11.5, italic: true, color: THEME.colors.accent3, margin: 0, isTextBox: true, objectName: "Video caption" });

// how it works strip under the video
const steps = ["Prompt", "Look up spec", "Edit scene", "Validate", "Screenshot", "Answer"];
const sx = VX, sy = 4.85, sw = VW, gap = 0.08;
const bw = (sw - gap * (steps.length - 1)) / steps.length;
steps.forEach((s, i) => {
  const x = sx + i * (bw + gap);
  const isCheck = i === 3;
  slide.addShape(pres.ShapeType.roundRect, { x, y: sy, w: bw, h: 0.55, fill: { color: isCheck ? THEME.colors.accent1 : THEME.colors.dk2 }, line: { color: isCheck ? THEME.colors.accent1 : THEME.colors.accent6, width: 0.75 }, rectRadius: 0.08, objectName: "Step " + s });
  slide.addText(s, { x, y: sy, w: bw, h: 0.55, fontSize: 11, bold: true, color: isCheck ? THEME.colors.dk1 : THEME.colors.lt2, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: "Step label " + s });
});
slide.addText("The model can only act through tools; validation reports feed back until the scene is valid", { x: sx, y: sy + 0.62, w: sw, h: 0.4, fontSize: 11.5, color: THEME.colors.accent3, align: "center", margin: 0, isTextBox: true, objectName: "Loop note" });

// ---- footer: QR + links + author --------------------------------------------------
slide.addImage({ path: qr, x: 11.75, y: 6.05, w: 1.0, h: 1.0, objectName: "QR" });
slide.addText([
  { text: "albertojaspe.net/x3d-copilot", options: { bold: true, color: THEME.colors.accent1, breakLine: true } },
  { text: "github.com/ajaspe/x3d-copilot", options: { color: THEME.colors.lt2, breakLine: true } },
  { text: "Video: youtu.be/ll1CE0XaRjo", options: { color: THEME.colors.accent3 } },
], { x: 6.6, y: 6.1, w: 5.0, h: 0.95, fontSize: 13, margin: 0, isTextBox: true, valign: "middle", objectName: "Links" });
slide.addText([
  { text: "Alberto Jaspe-Villanueva", options: { bold: true, color: "FFFFFF", breakLine: true } },
  { text: "KAUST  ·  Web3D 2026, AI & Web3D Innovation Competition", options: { color: THEME.colors.accent3 } },
], { x: L, y: 6.55, w: 5.8, h: 0.6, fontSize: 12, margin: 0, isTextBox: true, valign: "bottom", objectName: "Author" });

slide.addNotes("2-minute fast-forward. Start the video when you begin speaking; it is muted and runs 79 seconds. Script in talk.md.");

pres.writeFile({ fileName: path.join(outDir, "x3d-copilot-fastforward.pptx") }).then((f) => console.log("wrote", f));
