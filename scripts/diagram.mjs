/** Render the architecture diagram (HTML/CSS) to PNG with the system browser. */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "docs", "submission", "ai");
mkdirSync(out, { recursive: true });

const html = `<html><body style="margin:0;width:1600px;height:900px;background:#0f1216;color:#e6edf3;font-family:'Segoe UI',system-ui,sans-serif;">
<style>
  .box{position:absolute;border:2px solid #2a323c;border-radius:14px;background:#161b22;padding:14px 18px;font-size:22px}
  .box h3{margin:0 0 8px;font-size:26px;color:#34d399}
  .box small{display:block;color:#8b98a5;font-size:18px;line-height:1.35}
  .tool{display:inline-block;margin:4px 6px 0 0;padding:2px 10px;border:1px solid #2a323c;border-radius:999px;font-family:Consolas,monospace;font-size:17px;background:#1e252e}
  .arrow{position:absolute;color:#34d399;font-size:22px;font-weight:600}
  svg{position:absolute;left:0;top:0}
</style>
<svg width="1600" height="900">
  <defs><marker id="m" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#34d399"/></marker></defs>
  <g stroke="#34d399" stroke-width="3" fill="none" marker-end="url(#m)">
    <path d="M430,300 L590,300"/>
    <path d="M590,360 L430,360"/>
    <path d="M1010,250 L1150,250"/>
    <path d="M1150,320 L1010,320"/>
    <path d="M1010,470 L1150,470"/>
    <path d="M1150,540 L1010,540"/>
    <path d="M800,600 L800,690"/>
    <path d="M1300,600 L1300,690"/>
    <path d="M300,420 L300,690"/>
  </g>
</svg>
<div class="box" style="left:60px;top:220px;width:340px"><h3>User</h3><small>chat in natural language · edits source · clicks objects (X3D-native gizmo)</small></div>
<div class="arrow" style="left:432px;top:256px;width:160px;text-align:center;font-size:18px">request + selection</div>
<div class="arrow" style="left:432px;top:372px;width:160px;text-align:center;font-size:18px">answer + tool steps</div>
<div class="box" style="left:600px;top:150px;width:400px;height:380px"><h3>Agent loop (browser)</h3><small>provider-neutral; Gemini / Claude adapters · streaming · multimodal tool results · history compaction</small>
  <div style="margin-top:12px"><span class="tool">get_scene</span><span class="tool">edit_scene</span><span class="tool">replace_scene</span><span class="tool">validate_scene</span><span class="tool">lookup_node</span><span class="tool">search_nodes</span><span class="tool">screenshot</span></div></div>
<div class="arrow" style="left:1020px;top:212px">tool call</div>
<div class="arrow" style="left:1020px;top:330px">spec text</div>
<div class="box" style="left:1160px;top:170px;width:380px"><h3>Spec database</h3><small>X3D Unified Object Model 4.0 → 260 nodes, 78 abstract types, fields with type / access / default / accepted children / containerField</small></div>
<div class="arrow" style="left:1020px;top:432px">scene change</div>
<div class="arrow" style="left:1020px;top:550px">validation report</div>
<div class="box" style="left:1160px;top:400px;width:380px"><h3>Validators</h3><small>1. XSD x3d-4.0 (libxml2 → WebAssembly)<br/>2. semantic linter, ~30 spec-derived rules<br/>3. X_ITE runtime errors & warnings</small></div>
<div class="box" style="left:60px;top:700px;width:480px"><h3>Source pane</h3><small>CodeMirror 6 · X3DUOM autocompletion · inline diagnostics · minimal attribute edits from the gizmo</small></div>
<div class="box" style="left:600px;top:700px;width:400px"><h3>Screenshot → model</h3><small>the AI inspects its own render: framing, lighting, visibility</small></div>
<div class="box" style="left:1100px;top:700px;width:440px"><h3>X_ITE X3D 4.0 browser</h3><small>live render · runtime selection sensors & gizmo · glTF/OBJ/STL/PLY → X3D · XML/VRML/JSON export</small></div>
<div style="position:absolute;left:60px;top:40px;font-size:38px;font-weight:700">X3D Copilot — architecture</div>
<div style="position:absolute;left:60px;top:92px;font-size:22px;color:#8b98a5">Static site · no server · the model can only act through tools, and every tool result is checked against the standard</div>
</body></html>`;

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.setContent(html);
await page.screenshot({ path: join(out, "architecture.png") });
await browser.close();
console.log("wrote", join(out, "architecture.png"));
