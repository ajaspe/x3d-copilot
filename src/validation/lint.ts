/**
 * Semantic linter for X3D 4.0 XML documents.
 *
 * XSD validation tells you a document is *syntactically* X3D. This linter
 * catches the mistakes authors (human and AI) actually make that the schema
 * cannot express: broken DEF/USE, ROUTEs to non-existent fields or with
 * mismatched types/access, nodes placed in the wrong parent field, Shapes
 * without geometry, interpolator key/keyValue mismatches, missing Viewpoint...
 *
 * Every rule is grounded in the X3DUOM spec database (src/spec/uom.ts).
 * Parsing uses libxml2-wasm so the same code runs in Node (tests) and browsers.
 */
import { XmlDocument, XmlElement, XmlParseError, XmlTreeNode } from "libxml2-wasm";
import {
  uom,
  getNode,
  getStatement,
  acceptsNode,
  canonicalFieldName,
  canReceiveEvents,
  canSendEvents,
  suggest,
  UNIVERSAL_ATTRS,
  type TypeDef,
} from "../spec/uom";
import type { Issue, Severity } from "./issues";

const ROOT_STATEMENTS = new Set(Object.keys(uom.statements));
const GROUPING_LIKE = ["Group", "Transform", "Switch", "LOD", "Billboard", "Collision", "Anchor", "StaticGroup"];

/** Tolerant number pattern for X3D field values (allows 1, -1, .5, 1e-3, 0x1f is not allowed) */
const NUM = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;

interface Ctx {
  issues: Issue[];
  defs: Map<string, { type: string; line: number }>;
  protoNames: Set<string>;
  viewpointCount: number;
}

export interface LintOptions {
  /** Skip attribute value type checking (faster, fewer results). */
  skipValueChecks?: boolean;
}

export function lintX3D(xml: string, opts: LintOptions = {}): Issue[] {
  let doc: XmlDocument;
  try {
    doc = XmlDocument.fromString(xml, { url: "scene.x3d" });
  } catch (e) {
    if (e instanceof XmlParseError) {
      return e.details.map((d) => ({
        severity: "error" as Severity,
        message: `XML: ${d.message.trim()}`,
        line: d.line || undefined,
        col: d.col || undefined,
        source: "xml" as const,
        rule: "xml/well-formed",
      }));
    }
    return [{ severity: "error", message: `XML parse error: ${(e as Error).message}`, source: "xml" }];
  }

  const ctx: Ctx = { issues: [], defs: new Map(), protoNames: new Set(), viewpointCount: 0 };
  try {
    const root = doc.root;
    if (root.name !== "X3D") {
      push(ctx, "error", `Root element must be <X3D>, found <${root.name}>`, root.line, "structure/root");
    }
    checkRoot(ctx, root);

    // Pass 1: collect DEF names and ProtoDeclare names (USE may precede DEF textually in some encodings? No - but ROUTEs may).
    collectDefs(ctx, root);

    // Pass 2: walk the tree
    const scene = childElements(root).find((e) => e.name === "Scene");
    if (!scene) {
      push(ctx, "error", "<X3D> has no <Scene> element", root.line, "structure/no-scene");
    } else {
      for (const child of childElements(scene)) walk(ctx, child, null, "Scene", opts);
      if (ctx.viewpointCount === 0) {
        push(ctx, "info", "Scene defines no Viewpoint; the browser will pick a default camera. Add <Viewpoint position='0 0 10' description='...'/> for a predictable first view.", scene.line, "scene/no-viewpoint");
      }
    }
  } finally {
    doc.dispose();
  }
  return ctx.issues;
}

function push(ctx: Ctx, severity: Severity, message: string, line: number | undefined, rule: string, hint?: string) {
  ctx.issues.push({ severity, message, line: line || undefined, source: "lint", rule, hint });
}

function childElements(el: XmlElement): XmlElement[] {
  const out: XmlElement[] = [];
  let n: XmlTreeNode | null = el.firstChild;
  while (n) {
    if (n instanceof XmlElement) out.push(n);
    n = n.next;
  }
  return out;
}

function attrMap(el: XmlElement): Record<string, string> {
  const m: Record<string, string> = {};
  for (const a of el.attrs) m[a.name] = a.value;
  return m;
}

function checkRoot(ctx: Ctx, root: XmlElement) {
  const a = attrMap(root);
  if (!a.version) {
    push(ctx, "warning", "<X3D> is missing the version attribute; use version='4.0'", root.line, "root/version", 'version="4.0"');
  } else if (!["4.0", "4.1"].includes(a.version)) {
    push(ctx, "info", `<X3D version='${a.version}'>: this tool targets X3D 4.0; consider version='4.0' to use X3D4 nodes (PhysicalMaterial, glTF Inline, ...)`, root.line, "root/version");
  }
  const profiles = uom.enums.profileNameChoices;
  if (!a.profile) {
    push(ctx, "warning", "<X3D> is missing the profile attribute (e.g. profile='Immersive')", root.line, "root/profile", 'profile="Immersive"');
  } else if (profiles && !profiles.includes(a.profile)) {
    const s = suggest(a.profile, profiles);
    push(ctx, "error", `Unknown profile '${a.profile}'${s ? `; did you mean '${s}'?` : ""}`, root.line, "root/profile", s);
  }
  for (const child of childElements(root)) {
    if (child.name !== "head" && child.name !== "Scene") {
      push(ctx, "error", `<${child.name}> is not allowed directly under <X3D>; only <head> and <Scene>`, child.line, "structure/root-children");
    }
  }
}

function collectDefs(ctx: Ctx, el: XmlElement) {
  const stack: XmlElement[] = [el];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur.name === "ProtoDeclare" || cur.name === "ExternProtoDeclare") {
      const name = cur.attr("name")?.value;
      if (name) ctx.protoNames.add(name);
    }
    const def = cur.attr("DEF")?.value;
    if (def) {
      const prev = ctx.defs.get(def);
      if (prev) {
        push(ctx, "error", `Duplicate DEF name '${def}' (first defined on <${prev.type}> at line ${prev.line})`, cur.line, "def/duplicate");
      } else {
        ctx.defs.set(def, { type: cur.name, line: cur.line });
      }
    }
    for (const c of childElements(cur)) stack.push(c);
  }
}

function walk(ctx: Ctx, el: XmlElement, parent: XmlElement | null, parentType: string, opts: LintOptions) {
  const name = el.name;
  const attrs = attrMap(el);

  // --- statements -------------------------------------------------------
  if (name === "ROUTE") return checkRoute(ctx, el, attrs);
  if (name === "ProtoInstance") {
    if (!attrs.name) push(ctx, "error", "<ProtoInstance> requires a name attribute", el.line, "proto/instance-name");
    else if (ctx.protoNames.size && !ctx.protoNames.has(attrs.name)) {
      push(ctx, "warning", `ProtoInstance name='${attrs.name}' does not match any ProtoDeclare/ExternProtoDeclare in this file`, el.line, "proto/unknown-instance");
    }
    return;
  }
  if (ROOT_STATEMENTS.has(name)) {
    // ProtoDeclare, ProtoBody, IS, connect, field, fieldValue, IMPORT, EXPORT...
    if (name === "ProtoDeclare" || name === "ExternProtoDeclare") {
      const body = childElements(el).find((c) => c.name === "ProtoBody");
      if (body) for (const c of childElements(body)) walk(ctx, c, body, "ProtoBody", opts);
    }
    return;
  }
  // WorldInfo is a node in the spec; fine.

  const def = getNode(name);
  if (!def) {
    const s = suggest(name, Object.keys(uom.nodes));
    push(ctx, "error", `Unknown node <${name}>${s ? `; did you mean <${s}>?` : ""}`, el.line, "node/unknown", s);
    // still recurse so we catch DEF/USE issues inside
    for (const c of childElements(el)) walk(ctx, c, el, name, opts);
    return;
  }

  if (name === "Viewpoint" || name === "OrthoViewpoint" || name === "GeoViewpoint") ctx.viewpointCount++;

  // --- USE ----------------------------------------------------------------
  if (attrs.USE !== undefined) {
    const target = ctx.defs.get(attrs.USE);
    if (!target) {
      push(ctx, "error", `USE='${attrs.USE}' refers to a DEF name that does not exist`, el.line, "use/undefined");
    } else if (target.type !== name) {
      push(ctx, "error", `<${name} USE='${attrs.USE}'> but '${attrs.USE}' was DEF-ed as <${target.type}> (line ${target.line}); USE must repeat the same node type`, el.line, "use/type-mismatch");
    }
    const extra = Object.keys(attrs).filter((k) => !["USE", "containerField", "class", "id", "style"].includes(k));
    if (extra.length) {
      push(ctx, "warning", `<${name} USE='${attrs.USE}'> must not carry other field attributes (${extra.join(", ")}); they are ignored`, el.line, "use/extra-attributes");
    }
    if (childElements(el).length) {
      push(ctx, "warning", `<${name} USE='${attrs.USE}'> must not contain child nodes; they are ignored`, el.line, "use/children");
    }
  }

  // --- attributes ----------------------------------------------------------
  for (const [k, v] of Object.entries(attrs)) {
    if (UNIVERSAL_ATTRS.has(k)) continue;
    if (k.includes(":")) continue; // xmlns:..., xsd:...
    const f = def.fields[k];
    if (!f) {
      const s = suggest(k, Object.keys(def.fields).filter((x) => !UNIVERSAL_ATTRS.has(x) && x !== "IS" && x !== "metadata"));
      push(ctx, "error", `<${name}> has no field '${k}'${s ? `; did you mean '${s}'?` : ""}`, el.line, "field/unknown", s);
      continue;
    }
    if (f.t === "SFNode" || f.t === "MFNode") {
      push(ctx, "error", `'${k}' on <${name}> is a ${f.t} field: it must be a child element, not an attribute`, el.line, "field/node-as-attribute");
      continue;
    }
    if (f.a === "inputOnly" || f.a === "outputOnly") {
      push(ctx, "error", `'${k}' on <${name}> is ${f.a} and cannot be set as an attribute (only via ROUTE)`, el.line, "field/event-as-attribute");
      continue;
    }
    if (!opts.skipValueChecks) checkValue(ctx, el, name, k, f.t, v, f);
  }

  // --- placement in parent -------------------------------------------------
  if (parent && parent.name !== "ProtoBody" && parentType !== "Scene") {
    const parentDef = getNode(parent.name);
    if (parentDef) {
      const cf = attrs.containerField ?? def.containerField;
      if (cf) {
        const pf = parentDef.fields[cf];
        if (!pf) {
          const candidates = Object.entries(parentDef.fields)
            .filter(([, pfd]) => (pfd.t === "SFNode" || pfd.t === "MFNode") && acceptsNode(pfd.n, name))
            .map(([fn]) => fn);
          const alt = candidates[0];
          push(
            ctx,
            "error",
            `<${name}> cannot be a child of <${parent.name}>: <${parent.name}> has no '${cf}' field${alt ? `. Use containerField='${alt}'` : ""}${
              !alt ? `. ${placementHint(name, def)}` : ""
            }`,
            el.line,
            "placement/no-such-field",
            alt ? `containerField="${alt}"` : undefined,
          );
        } else if (pf.t !== "SFNode" && pf.t !== "MFNode") {
          push(ctx, "error", `<${parent.name}> field '${cf}' is ${pf.t}, not a node field; <${name}> cannot go there`, el.line, "placement/not-node-field");
        } else if (!acceptsNode(pf.n, name)) {
          push(
            ctx,
            "error",
            `<${name}> is not an acceptable type for <${parent.name}>.${cf} (expects ${pf.n?.join(" | ") ?? "X3DNode"}). ${placementHint(name, def)}`,
            el.line,
            "placement/type-mismatch",
          );
        }
      }
    }
  } else if (parentType === "Scene") {
    // Top-level: must be a child node (X3DChildNode) or a few specials
    const okTop = acceptsNode(["X3DChildNode", "X3DMetadataObject", "LayerSet", "WorldInfo"], name) || attrs.containerField;
    if (!okTop) {
      push(ctx, "error", `<${name}> cannot be a direct child of <Scene>; wrap it in a <Shape> or grouping node. ${placementHint(name, def)}`, el.line, "placement/scene-child");
    }
  }

  // --- node-specific checks --------------------------------------------------
  const kids = childElements(el);
  if (attrs.USE === undefined) checkSingleNodeFields(ctx, el, def, kids);
  if (attrs.USE === undefined) {
    if (name === "Shape") {
      const geom = kids.find((k) => {
        const kd = getNode(k.name);
        return kd && (attrMap(k).containerField ?? kd.containerField) === "geometry";
      });
      if (!geom) push(ctx, "warning", "<Shape> has no geometry child (Box, Sphere, IndexedFaceSet, ...) - nothing will be drawn", el.line, "shape/no-geometry");
      const app = kids.find((k) => k.name === "Appearance");
      if (!app && geom && !["PointSet", "LineSet", "IndexedLineSet"].includes(geom.name)) {
        push(ctx, "info", "<Shape> has no <Appearance>; it will render with the default flat white material", el.line, "shape/no-appearance");
      }
    }
    if (GROUPING_LIKE.includes(name) && kids.length === 0) {
      push(ctx, "warning", `<${name}${attrs.DEF ? ` DEF='${attrs.DEF}'` : ""}> is empty`, el.line, "group/empty");
    }
    if (name.endsWith("Interpolator") || name === "CoordinateInterpolator2D" || name === "PositionInterpolator2D") {
      checkInterpolator(ctx, el, name, attrs);
    }
    if (name === "Inline" && !attrs.url) {
      push(ctx, "warning", "<Inline> has an empty url", el.line, "inline/no-url");
    }
    if (name === "Material" && parent?.name !== "Appearance" && !attrs.containerField) {
      // handled by placement, but give a friendlier message
    }
  }

  for (const c of kids) walk(ctx, c, el, name, opts);
}

/** SFNode fields (geometry, appearance, material, ...) may hold only one child. */
function checkSingleNodeFields(ctx: Ctx, el: XmlElement, def: TypeDef, kids: XmlElement[]) {
  const groups = new Map<string, XmlElement[]>();
  for (const k of kids) {
    const kd = getNode(k.name);
    if (!kd) continue;
    const cf = attrMap(k).containerField ?? kd.containerField;
    if (!cf) continue;
    const list = groups.get(cf) ?? [];
    list.push(k);
    groups.set(cf, list);
  }
  for (const [cf, list] of groups) {
    const pf = def.fields[cf];
    if (pf && pf.t === "SFNode" && list.length > 1) {
      push(ctx, "error", `<${el.name}>.${cf} is a single-node (SFNode) field but has ${list.length} children (${list.map((k) => `<${k.name}>`).join(", ")})`, list[1].line, "placement/sfnode-multiple");
    }
  }
}

function placementHint(name: string, def: TypeDef): string {
  if (def.containerField === "geometry") return `Geometry nodes go inside <Shape>.`;
  if (def.containerField === "material") return `<${name}> goes inside <Appearance>.`;
  if (def.containerField === "texture") return `Texture nodes go inside <Appearance>.`;
  if (def.containerField === "appearance") return `<Appearance> goes inside <Shape>.`;
  if (def.containerField === "coord") return `<${name}> goes inside a geometry node such as <IndexedFaceSet>.`;
  return `Default containerField of <${name}> is '${def.containerField}'.`;
}

function checkRoute(ctx: Ctx, el: XmlElement, a: Record<string, string>) {
  for (const req of ["fromNode", "fromField", "toNode", "toField"]) {
    if (!a[req]) push(ctx, "error", `<ROUTE> is missing '${req}'`, el.line, "route/missing-attribute");
  }
  if (!a.fromNode || !a.toNode || !a.fromField || !a.toField) return;

  const from = ctx.defs.get(a.fromNode);
  const to = ctx.defs.get(a.toNode);
  if (!from) {
    const s = suggest(a.fromNode, ctx.defs.keys());
    push(ctx, "error", `ROUTE fromNode='${a.fromNode}' is not a DEF name in this scene${s ? `; did you mean '${s}'?` : ""}`, el.line, "route/unknown-node", s);
  }
  if (!to) {
    const s = suggest(a.toNode, ctx.defs.keys());
    push(ctx, "error", `ROUTE toNode='${a.toNode}' is not a DEF name in this scene${s ? `; did you mean '${s}'?` : ""}`, el.line, "route/unknown-node", s);
  }
  if (!from || !to) return;

  const fromDef = getNode(from.type);
  const toDef = getNode(to.type);
  let fromType: string | undefined;
  let toType: string | undefined;

  if (fromDef) {
    const canon = canonicalFieldName(fromDef, a.fromField);
    if (!canon) {
      const s = suggest(a.fromField, outputFields(fromDef));
      push(ctx, "error", `<${from.type} DEF='${a.fromNode}'> has no field '${a.fromField}'${s ? `; did you mean '${s}'?` : ""}`, el.line, "route/unknown-field", s);
    } else {
      const f = fromDef.fields[canon];
      if (!canSendEvents(f.a)) {
        push(ctx, "error", `ROUTE fromField '${a.fromField}' on <${from.type}> is ${f.a}; only outputOnly/inputOutput fields can be routed from`, el.line, "route/not-output");
      }
      fromType = f.t;
    }
  }
  if (toDef) {
    const canon = canonicalFieldName(toDef, a.toField);
    if (!canon) {
      const s = suggest(a.toField, inputFields(toDef));
      push(ctx, "error", `<${to.type} DEF='${a.toNode}'> has no field '${a.toField}'${s ? `; did you mean '${s}'?` : ""}`, el.line, "route/unknown-field", s);
    } else {
      const f = toDef.fields[canon];
      if (!canReceiveEvents(f.a)) {
        push(ctx, "error", `ROUTE toField '${a.toField}' on <${to.type}> is ${f.a}; only inputOnly/inputOutput fields can be routed to`, el.line, "route/not-input");
      }
      toType = f.t;
    }
  }
  if (fromType && toType && fromType !== toType) {
    push(ctx, "error", `ROUTE type mismatch: ${a.fromNode}.${a.fromField} is ${fromType} but ${a.toNode}.${a.toField} is ${toType}`, el.line, "route/type-mismatch");
  }
}

function outputFields(def: TypeDef): string[] {
  return Object.entries(def.fields).filter(([n, f]) => canSendEvents(f.a) && !UNIVERSAL_ATTRS.has(n) && n !== "IS").map(([n]) => n);
}
function inputFields(def: TypeDef): string[] {
  return Object.entries(def.fields).filter(([n, f]) => canReceiveEvents(f.a) && !UNIVERSAL_ATTRS.has(n) && n !== "IS").map(([n]) => n);
}

const DIM: Record<string, number> = {
  SFBool: 1, SFInt32: 1, SFFloat: 1, SFDouble: 1, SFTime: 1,
  SFVec2f: 2, SFVec2d: 2, SFVec3f: 3, SFVec3d: 3, SFVec4f: 4, SFVec4d: 4,
  SFColor: 3, SFColorRGBA: 4, SFRotation: 4, SFMatrix3f: 9, SFMatrix3d: 9, SFMatrix4f: 16, SFMatrix4d: 16,
};

function tokens(v: string): string[] {
  return v.trim().split(/[\s,]+/).filter(Boolean);
}

function checkValue(ctx: Ctx, el: XmlElement, node: string, field: string, type: string, value: string, f: { min?: string; max?: string }) {
  const where = `<${node}> ${field}`;
  if (type === "SFString" || type === "MFString") return;
  if (type === "SFImage" || type === "MFImage") return;
  if (type === "SFBool") {
    if (!/^(true|false)$/.test(value.trim())) push(ctx, "error", `${where} must be 'true' or 'false' (lowercase), got '${value}'`, el.line, "value/bool");
    return;
  }
  if (type === "MFBool") {
    for (const t of tokens(value)) if (!/^(true|false)$/.test(t)) { push(ctx, "error", `${where} contains non-boolean token '${t}'`, el.line, "value/bool"); return; }
    return;
  }
  const toks = tokens(value);
  if (toks.length === 0) return; // empty is allowed for MF fields
  const bad = toks.find((t) => !NUM.test(t));
  if (bad !== undefined) {
    push(ctx, "error", `${where} (${type}) contains a non-numeric token '${bad}'`, el.line, "value/number");
    return;
  }
  const isMF = type.startsWith("MF");
  const base = isMF ? "SF" + type.slice(2) : type;
  const dim = DIM[base];
  if (!dim) return;
  if (!isMF && toks.length !== dim) {
    push(ctx, "error", `${where} is ${type} and needs exactly ${dim} number${dim > 1 ? "s" : ""}, got ${toks.length}`, el.line, "value/arity");
    return;
  }
  if (isMF && toks.length % dim !== 0) {
    push(ctx, "error", `${where} is ${type}: ${toks.length} numbers is not a multiple of ${dim}`, el.line, "value/arity");
    return;
  }
  if (base === "SFInt32" && toks.some((t) => !/^[-+]?\d+$/.test(t))) {
    push(ctx, "error", `${where} is ${type} and must contain integers`, el.line, "value/integer");
  }
  if (base === "SFColor" || base === "SFColorRGBA") {
    const out = toks.map(Number).find((n) => n < 0 || n > 1);
    if (out !== undefined) push(ctx, "error", `${where} colour components must be in [0,1], got ${out}`, el.line, "value/color-range");
  }
  if (base === "SFRotation") {
    for (let i = 0; i < toks.length; i += 4) {
      const [x, y, z] = toks.slice(i, i + 3).map(Number);
      if (x === 0 && y === 0 && z === 0) push(ctx, "warning", `${where} has a zero-length rotation axis (0 0 0 angle); use e.g. '0 1 0 ${toks[i + 3]}'`, el.line, "value/rotation-axis");
    }
  }
  if (f.min !== undefined || f.max !== undefined) {
    const nums = toks.map(Number);
    const lo = f.min !== undefined ? Number(f.min) : -Infinity;
    const hi = f.max !== undefined ? Number(f.max) : Infinity;
    const out = nums.find((n) => n < lo || n > hi);
    if (out !== undefined && Number.isFinite(lo + hi)) {
      push(ctx, "warning", `${where} value ${out} is outside the allowed range [${f.min ?? ""}, ${f.max ?? ""}]`, el.line, "value/range");
    } else if (out !== undefined) {
      push(ctx, "warning", `${where} value ${out} is outside the allowed range (${f.min !== undefined ? `min ${f.min}` : ""}${f.max !== undefined ? `max ${f.max}` : ""})`, el.line, "value/range");
    }
  }
}

const INTERP_DIM: Record<string, number> = {
  ScalarInterpolator: 1,
  ColorInterpolator: 3,
  PositionInterpolator: 3,
  PositionInterpolator2D: 2,
  OrientationInterpolator: 4,
  CoordinateInterpolator: 3,
  CoordinateInterpolator2D: 2,
  NormalInterpolator: 3,
};

function checkInterpolator(ctx: Ctx, el: XmlElement, name: string, a: Record<string, string>) {
  const keys = tokens(a.key ?? "");
  const vals = tokens(a.keyValue ?? "");
  if (keys.length === 0) {
    push(ctx, "warning", `<${name}> has no key values; it will never produce output`, el.line, "interp/no-key");
    return;
  }
  const nums = keys.map(Number);
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] < nums[i - 1]) { push(ctx, "error", `<${name}> key values must be monotonically non-decreasing (${nums[i - 1]} then ${nums[i]})`, el.line, "interp/key-order"); break; }
  }
  if (nums[0] < 0 || nums[nums.length - 1] > 1) {
    push(ctx, "warning", `<${name}> key values are normally in [0,1] (fraction of the TimeSensor cycle)`, el.line, "interp/key-range");
  }
  const dim = INTERP_DIM[name];
  if (dim && vals.length) {
    if (name === "CoordinateInterpolator" || name === "NormalInterpolator" || name === "CoordinateInterpolator2D") {
      if (vals.length % (keys.length * dim) !== 0) {
        push(ctx, "error", `<${name}> keyValue count (${vals.length / dim} vectors) must be a multiple of key count (${keys.length})`, el.line, "interp/count-mismatch");
      }
    } else if (vals.length !== keys.length * dim) {
      push(ctx, "error", `<${name}> has ${keys.length} keys but ${vals.length / dim} keyValue entries (${vals.length} numbers / ${dim} per value); counts must match`, el.line, "interp/count-mismatch");
    }
  }
}

/** Convenience: compact statistics used by the UI header. */
export function summarize(issues: Issue[]): string {
  const e = issues.filter((i) => i.severity === "error").length;
  const w = issues.filter((i) => i.severity === "warning").length;
  const n = issues.filter((i) => i.severity === "info").length;
  const parts: string[] = [];
  if (e) parts.push(`${e} error${e > 1 ? "s" : ""}`);
  if (w) parts.push(`${w} warning${w > 1 ? "s" : ""}`);
  if (n) parts.push(`${n} hint${n > 1 ? "s" : ""}`);
  return parts.length ? parts.join(", ") : "no issues";
}

/** Quick pre-check: does the scene reference any node that the given browser's node list lacks? */
export function unsupportedNodes(xml: string, supported: Set<string>): string[] {
  const found = new Set<string>();
  const re = /<([A-Z][A-Za-z0-9]*)[\s/>]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const n = m[1];
    if (uom.nodes[n] && !supported.has(n)) found.add(n);
  }
  return [...found];
}

// Helpers exported for autocompletion
export function fieldsForCompletion(node: string): { name: string; type: string; def?: string; desc?: string }[] {
  const def = getNode(node) ?? getStatement(node);
  if (!def) return [];
  return Object.entries(def.fields)
    .filter(([n, f]) => f.t !== "SFNode" && f.t !== "MFNode" && f.a !== "inputOnly" && f.a !== "outputOnly" && n !== "IS")
    .map(([n, f]) => ({ name: n, type: f.t, def: f.d, desc: f.desc }));
}

export function childNodesForCompletion(parent: string): string[] {
  const pdef = getNode(parent);
  if (!pdef) return parent === "Scene" ? Object.keys(uom.nodes).filter((n) => acceptsNode(["X3DChildNode"], n)) : [];
  const accepts = new Set<string>();
  for (const f of Object.values(pdef.fields)) if (f.t === "SFNode" || f.t === "MFNode") for (const t of f.n ?? []) accepts.add(t);
  if (accepts.size === 0) return [];
  return Object.keys(uom.nodes).filter((n) => acceptsNode([...accepts], n)).sort();
}
