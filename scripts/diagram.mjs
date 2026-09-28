/**
 * Render the architecture diagram to PNG with the system browser.
 * Boxes are laid out with absolute positions; connectors are computed in the page
 * from the boxes' actual edges, so arrows never pass under a box, and labels sit
 * beside their arrow.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "docs", "submission", "ai");
mkdirSync(out, { recursive: true });

const html = `<html><body style="margin:0;width:1600px;height:900px;background:#0f1216;color:#e6edf3;font-family:'Segoe UI',system-ui,sans-serif;position:relative;overflow:hidden">
<style>
  .box{position:absolute;box-sizing:border-box;border:2px solid #2a323c;border-radius:14px;background:#161b22;padding:12px 16px;font-size:20px}
  .box h3{margin:0 0 6px;font-size:25px;color:#34d399}
  .box small{display:block;color:#8b98a5;font-size:17px;line-height:1.3}
  .tool{display:inline-block;margin:4px 6px 0 0;padding:1px 9px;border:1px solid #2a323c;border-radius:999px;font-family:Consolas,monospace;font-size:16px;background:#1e252e}
  .lbl{position:absolute;color:#34d399;font-size:15px;font-weight:600;white-space:nowrap;background:#0f1216;padding:0 4px}
  svg{position:absolute;left:0;top:0;pointer-events:none}
</style>
<div style="position:absolute;left:60px;top:34px;font-size:36px;font-weight:700">X3D Copilot — architecture</div>
<div style="position:absolute;left:60px;top:84px;font-size:20px;color:#8b98a5">Static site · no server · the model can only act through tools, and every tool result is checked against the standard</div>

<div class="box" id="user"   style="left:60px;top:230px;width:330px"><h3>User</h3><small>chat in natural language · edits the source · clicks objects in the view (X3D-native gizmo)</small></div>
<div class="box" id="agent"  style="left:560px;top:150px;width:420px;height:400px"><h3>Agent loop (browser)</h3><small>provider-neutral · Gemini / Claude adapters · streaming · multimodal tool results · history compaction</small>
  <div style="margin-top:10px"><span class="tool">get_scene</span><span class="tool">edit_scene</span><span class="tool">replace_scene</span><span class="tool">validate_scene</span><span class="tool">lookup_node</span><span class="tool">search_nodes</span><span class="tool">screenshot</span></div></div>
<div class="box" id="spec"   style="left:1160px;top:150px;width:380px"><h3>Spec database</h3><small>X3D Unified Object Model 4.0 → 260 nodes, 78 abstract types; every field's type, access, default, accepted children, containerField</small></div>
<div class="box" id="valid"  style="left:1160px;top:390px;width:380px"><h3>Validators</h3><small>1. XSD x3d-4.0 (libxml2 → WebAssembly)<br/>2. semantic linter, ~30 spec-derived rules<br/>3. X_ITE runtime errors &amp; warnings</small></div>
<div class="box" id="source" style="left:60px;top:700px;width:440px"><h3>Source pane</h3><small>CodeMirror 6 · X3DUOM autocompletion · inline diagnostics · minimal attribute edits from the gizmo</small></div>
<div class="box" id="shot"   style="left:560px;top:700px;width:420px"><h3>Screenshot → model</h3><small>the AI inspects its own render: framing, lighting, visibility</small></div>
<div class="box" id="xite"   style="left:1100px;top:700px;width:440px"><h3>X_ITE X3D 4.0 browser</h3><small>live render · runtime selection sensors &amp; gizmo · glTF/OBJ/STL/PLY → X3D · XML/VRML/JSON export</small></div>
<svg id="s" width="1600" height="900"><defs><marker id="m" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" fill="#34d399"/></marker></defs><g id="g" stroke="#34d399" stroke-width="3" fill="none" marker-end="url(#m)"></g></svg>
<script>
const R = (id) => document.getElementById(id).getBoundingClientRect();
const g = document.getElementById('g');
const lbls = [];
function line(x1,y1,x2,y2){ const p=document.createElementNS('http://www.w3.org/2000/svg','path'); p.setAttribute('d',\`M\${x1},\${y1} L\${x2},\${y2}\`); g.appendChild(p); }
function label(x,y,text,anchor){ const d=document.createElement('div'); d.className='lbl'; d.textContent=text; document.body.appendChild(d); const w=d.getBoundingClientRect().width; d.style.left=(anchor==='center'? x-w/2 : x)+'px'; d.style.top=(y-11)+'px'; }
// horizontal pair between two boxes (a on the left, b on the right): top arrow a->b, bottom arrow b->a
function hpair(a,b,t1,t2,yOffTop,yOffBot){ const A=R(a),B=R(b); const gap=16;
  const y1=Math.max(A.top,B.top)+yOffTop, y2=Math.max(A.top,B.top)+yOffBot;
  line(A.right+gap,y1,B.left-gap,y1); label((A.right+B.left)/2,y1-16,t1,'center');
  line(B.left-gap,y2,A.right+gap,y2); label((A.right+B.left)/2,y2+18,t2,'center'); }
// vertical arrow from bottom of a to top of b at a's centre x
function vdown(a,b,t){ const A=R(a),B=R(b); const x=A.left+A.width/2; line(x,A.bottom+14,x,B.top-14); if(t) label(x+12,(A.bottom+B.top)/2,t,'left'); }
hpair('user','agent','request + selection','answer + tool steps',60,120);
hpair('agent','spec','lookup / search','field definitions',50,100);
hpair('agent','valid','edit / replace / validate','graded report',40,90);
vdown('user','source','types, or drags the gizmo');
vdown('agent','shot','screenshot tool');
vdown('valid','xite','render, runtime warnings');
</script>
</body></html>`;

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.setContent(html);
await page.waitForTimeout(300);
await page.screenshot({ path: join(out, "architecture.png") });
await browser.close();
console.log("wrote", join(out, "architecture.png"));
