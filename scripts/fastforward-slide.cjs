/**
 * One-slide fast-forward presentation (16:9) for the AI & Web3D Innovation Competition final.
 * Produces the slide content with pptxgenjs; scripts/fastforward-transplant.py then moves the
 * slide into the official Web3D 2026 template so it inherits the conference master.
 *
 *   NODE_PATH=<dir with pptxgenjs> node scripts/fastforward-slide.cjs docs/submission/fastforward <out.pptx>
 */
const path = require("path");
const fs = require("fs");
const pptxgen = require("pptxgenjs");

const dir = process.argv[2];
const outFile = process.argv[3] || path.join(dir, "ff-raw.pptx");
const video = path.join(dir, "highlight.mp4");
const cover = path.join(dir, "cover.png");
const qr = path.join(dir, "qr.png");

// Palette taken from the Web3D 2026 template content slides
const NAVY = "06194F", SKY = "5CC8FF", WHITE = "FFFFFF", PALE = "C9D6EA", GOLD = "FFD166";
const HEAD = "Arial", BODY = "Calibri";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5, same as the template
pres.author = "Alberto Jaspe-Villanueva";
pres.title = "X3D Copilot";
pres.theme = { headFontFace: HEAD, bodyFontFace: BODY };

const slide = pres.addSlide();
// no background: the template master supplies the blue gradient and the Web3D logo

const card = (name, x, y, w, h) =>
  slide.addShape(pres.ShapeType.roundRect, { x, y, w, h, fill: { color: NAVY, transparency: 20 }, line: { color: NAVY, transparency: 100 }, rectRadius: 0.08, objectName: name });

// ---- title -----------------------------------------------------------------------
slide.addText([
  { text: "X3D Copilot", options: { fontFace: HEAD, fontSize: 40, bold: true, color: WHITE, breakLine: true } },
  { text: "Describe a 3D scene in plain words. Get a valid X3D 4.0 scene, live in your browser.", options: { fontFace: BODY, fontSize: 20, color: SKY } },
], { x: 0.6, y: 0.3, w: 12.1, h: 1.1, margin: 0, isTextBox: true, valign: "top", objectName: "Title" });

// ---- left column: what it is ---------------------------------------------------------
const L = 0.6, LW = 5.9;
card("Card what", L, 1.5, LW, 2.05);
slide.addText("WHAT IT IS", { x: L + 0.2, y: 1.55, w: LW - 0.4, h: 0.35, fontFace: HEAD, fontSize: 13, bold: true, color: SKY, charSpacing: 2, margin: 0, isTextBox: true, valign: "middle", objectName: "What header" });
const what = [
  ["A 3D editor that runs in the browser.", " Live view, source editor, drag objects, import glTF or OBJ, export X3D. Nothing to install."],
  ["An AI co-author.", " Just say what you want: “a snowman at night”, “make the hat jump when clicked”."],
  ["A referee that never sleeps.", " Every change, yours or the AI's, is checked against the X3D 4.0 standard before you see it."],
];
what.forEach(([lead, rest], i) => {
  slide.addText([
    { text: lead, options: { bold: true, color: WHITE } },
    { text: rest, options: { color: PALE } },
  ], { x: L + 0.2, y: 1.92 + i * 0.53, w: LW - 0.4, h: 0.52, fontFace: BODY, fontSize: 13, margin: 0, isTextBox: true, valign: "top", objectName: "What " + (i + 1) });
});

// ---- left column: how it works --------------------------------------------------------
card("Card how", L, 3.7, LW, 2.65);
slide.addText("HOW IT WORKS", { x: L + 0.2, y: 3.75, w: LW - 0.4, h: 0.35, fontFace: HEAD, fontSize: 13, bold: true, color: SKY, charSpacing: 2, margin: 0, isTextBox: true, valign: "middle", objectName: "How header" });
const how = [
  ["You ask", " in plain words, for a new scene or a change to the one on screen."],
  ["The AI reads the X3D specification", " and edits the scene through tools; it never writes blind."],
  ["The standard checks the result:", " schema, semantic rules and the 3D runtime. The AI must fix every error before it answers."],
  ["The AI looks at the render", " and replies. You keep editing by hand, by dragging, or by chat."],
];
how.forEach(([lead, rest], i) => {
  const y = 4.12 + i * 0.55;
  slide.addText(String(i + 1), { x: L + 0.2, y, w: 0.45, h: 0.5, fontFace: HEAD, fontSize: 26, bold: true, color: SKY, margin: 0, isTextBox: true, valign: "top", objectName: "Step num " + (i + 1) });
  slide.addText([
    { text: lead, options: { bold: true, color: WHITE } },
    { text: rest, options: { color: PALE } },
  ], { x: L + 0.7, y, w: LW - 0.9, h: 0.52, fontFace: BODY, fontSize: 13, margin: 0, isTextBox: true, valign: "top", objectName: "Step text " + (i + 1) });
});

// ---- right column: video --------------------------------------------------------------
const VX = 6.85, VY = 1.5, VW = 5.85, VH = VW * 9 / 16; // 5.85 x 3.29
card("Video frame", VX - 0.08, VY - 0.08, VW + 0.16, VH + 0.16);
slide.addMedia({ type: "video", path: video, cover: "image/png;base64," + fs.readFileSync(cover).toString("base64"), x: VX, y: VY, w: VW, h: VH, objectName: "Highlight video" });
slide.addText("In the clip: an AI-built still life, a snowman from one sentence, moon shadows, a click that makes the hat hop, the solar system, dragging objects, physically based materials, and a scene with eleven errors repaired in one request.",
  { x: VX, y: VY + VH + 0.12, w: VW, h: 0.55, fontFace: BODY, fontSize: 11, italic: true, color: PALE, margin: 0, isTextBox: true, valign: "top", objectName: "Video caption" });

// ---- try it box (stops before the template logo at x = 11.7) ---------------------------------
const TY = 5.55, TH = 1.0;
card("Card try", VX, TY, 4.7, TH);
slide.addImage({ path: qr, x: VX + 0.08, y: TY + 0.08, w: TH - 0.16, h: TH - 0.16, objectName: "QR" });
slide.addText([
  { text: "Try it now: ", options: { bold: true, color: WHITE } },
  { text: "albertojaspe.net/x3d-copilot", options: { bold: true, color: GOLD, breakLine: true } },
  { text: "Code (MIT): ", options: { color: PALE } },
  { text: "github.com/ajaspe/x3d-copilot", options: { color: WHITE, breakLine: true } },
  { text: "Video: ", options: { color: PALE } },
  { text: "youtu.be/ll1CE0XaRjo", options: { color: WHITE, breakLine: true } },
  { text: "Bring your own Gemini or Claude key for the AI.", options: { color: PALE, italic: true } },
], { x: VX + TH, y: TY + 0.05, w: 4.7 - TH - 0.1, h: TH - 0.1, fontFace: BODY, fontSize: 11.5, margin: 0, isTextBox: true, valign: "middle", objectName: "Links" });

// ---- author ----------------------------------------------------------------------------
slide.addText([
  { text: "Alberto Jaspe-Villanueva", options: { bold: true, color: WHITE } },
  { text: "   King Abdullah University of Science and Technology (KAUST)   ·   AI & Web3D Innovation Competition, Web3D 2026", options: { color: PALE } },
], { x: L, y: 6.55, w: 10.9, h: 0.4, fontFace: BODY, fontSize: 12, margin: 0, isTextBox: true, valign: "middle", objectName: "Author" });

slide.addNotes("Two-minute fast-forward. Click the video as you start speaking; it is muted and runs 105 seconds. Full script in talk.md.");

pres.writeFile({ fileName: outFile }).then((f) => console.log("wrote", f));
