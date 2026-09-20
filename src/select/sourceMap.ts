/**
 * Maps <Transform> elements in the editor's XML syntax tree (Lezer) to the
 * live scene graph by document order, and produces precise text edits for
 * their translation / rotation / scale attributes.
 *
 * Ordering rule shared with the live traversal in gizmo.ts: every <Transform>
 * element counts (including USE references), except inside <ProtoDeclare>
 * (prototype bodies are not instantiated) and <fieldValue> (proto instance
 * internals).
 */
import type { EditorState, ChangeSpec } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { fmtVec, parseNumbers, type AxisAngle, type Vec3 } from "./math";

export interface AttrRange {
  /** full attribute range (name="value"), for removal */
  from: number;
  to: number;
  /** value range without the quotes */
  valueFrom: number;
  valueTo: number;
  value: string;
}

export interface TransformEntry {
  index: number;
  /** whole element range */
  from: number;
  to: number;
  /** start tag range (<Transform ...>) */
  tagFrom: number;
  tagTo: number;
  /** position just before the closing '>' or '/>' of the start tag, for inserting attributes */
  insertAt: number;
  line: number;
  attrs: Map<string, AttrRange>;
  def?: string;
  use?: string;
  /** index of the enclosing Transform, or -1 */
  parent: number;
}

export interface TransformValues {
  translation: Vec3;
  rotation: AxisAngle;
  scale: Vec3;
  center: Vec3;
}

const EXCLUDED_ANCESTORS = new Set(["ProtoDeclare", "ExternProtoDeclare", "fieldValue"]);

export function listTransforms(state: EditorState): TransformEntry[] {
  const tree = syntaxTree(state);
  const doc = state.doc;
  const out: TransformEntry[] = [];
  // stack of open elements: { name, transformIndex | -1, excluded }
  const stack: { name: string; tIndex: number; excluded: boolean }[] = [];

  tree.iterate({
    enter(node) {
      if (node.name !== "Element") return;
      const openTag = node.node.firstChild; // OpenTag or SelfClosingTag
      if (!openTag) return;
      const tagNameNode = openTag.getChild("TagName");
      const name = tagNameNode ? doc.sliceString(tagNameNode.from, tagNameNode.to) : "";
      const excluded = stack.some((s) => s.excluded) || EXCLUDED_ANCESTORS.has(name);
      let tIndex = -1;
      if (name === "Transform" && !excluded) {
        const attrs = new Map<string, AttrRange>();
        for (const a of openTag.getChildren("Attribute")) {
          const an = a.getChild("AttributeName");
          const av = a.getChild("AttributeValue");
          if (!an) continue;
          const aname = doc.sliceString(an.from, an.to);
          if (!av) continue;
          const raw = doc.sliceString(av.from, av.to);
          const quoted = raw.length >= 2 && (raw[0] === '"' || raw[0] === "'");
          // include the whitespace run before the attribute so removal leaves clean text
          let wsFrom = a.from;
          while (wsFrom > openTag.from && /\s/.test(doc.sliceString(wsFrom - 1, wsFrom))) wsFrom--;
          attrs.set(aname, {
            from: wsFrom,
            to: a.to,
            valueFrom: quoted ? av.from + 1 : av.from,
            valueTo: quoted ? av.to - 1 : av.to,
            value: quoted ? raw.slice(1, -1) : raw,
          });
        }
        // insert position: before the tag's closing token
        const closer = openTag.name === "SelfClosingTag" ? openTag.getChild("SelfCloseEndTag") : openTag.getChild("EndTag");
        const insertAt = closer ? closer.from : openTag.to - (openTag.name === "SelfClosingTag" ? 2 : 1);
        tIndex = out.length;
        const parent = [...stack].reverse().find((s) => s.tIndex >= 0)?.tIndex ?? -1;
        out.push({
          index: tIndex,
          from: node.from,
          to: node.to,
          tagFrom: openTag.from,
          tagTo: openTag.to,
          insertAt,
          line: doc.lineAt(node.from).number,
          attrs,
          def: attrs.get("DEF")?.value,
          use: attrs.get("USE")?.value,
          parent,
        });
      }
      stack.push({ name, tIndex, excluded });
    },
    leave(node) {
      if (node.name === "Element") stack.pop();
    },
  });
  return out;
}

/** Innermost Transform element containing `pos`. */
export function transformAtPos(list: TransformEntry[], pos: number): TransformEntry | undefined {
  let best: TransformEntry | undefined;
  for (const t of list) {
    if (pos >= t.from && pos <= t.to && (!best || t.to - t.from < best.to - best.from)) best = t;
  }
  return best;
}

export function readValues(t: TransformEntry): TransformValues {
  return {
    translation: parseNumbers(t.attrs.get("translation")?.value, 3, [0, 0, 0]) as Vec3,
    rotation: parseNumbers(t.attrs.get("rotation")?.value, 4, [0, 0, 1, 0]) as AxisAngle,
    scale: parseNumbers(t.attrs.get("scale")?.value, 3, [1, 1, 1]) as Vec3,
    center: parseNumbers(t.attrs.get("center")?.value, 3, [0, 0, 0]) as Vec3,
  };
}

const DEFAULTS: Record<string, string> = { translation: "0 0 0", rotation: "0 0 1 0", scale: "1 1 1" };

/**
 * Build editor changes that set translation / rotation / scale on the element.
 * Attributes equal to the X3D default are removed rather than written.
 */
export function buildTransformChanges(t: TransformEntry, values: Partial<Pick<TransformValues, "translation" | "rotation" | "scale">>): ChangeSpec[] {
  const changes: ChangeSpec[] = [];
  const inserts: string[] = [];
  for (const key of ["translation", "rotation", "scale"] as const) {
    const v = values[key];
    if (!v) continue;
    const text = fmtVec(v, key === "rotation" ? 5 : 4);
    const isDefault = normalizeNums(text) === DEFAULTS[key];
    const existing = t.attrs.get(key);
    if (existing) {
      if (isDefault) {
        // remove attribute including one preceding whitespace run
        changes.push({ from: existing.from, to: existing.to });
      } else if (existing.value !== text) {
        changes.push({ from: existing.valueFrom, to: existing.valueTo, insert: text });
      }
    } else if (!isDefault) {
      inserts.push(`${key}="${text}"`);
    }
  }
  if (inserts.length) changes.push({ from: t.insertAt, insert: " " + inserts.join(" ") });
  return changes;
}

function normalizeNums(s: string): string {
  return s.trim().split(/\s+/).map((n) => String(Number(n))).join(" ");
}

/** Short human label for the breadcrumb. */
export function describeEntry(t: TransformEntry): string {
  if (t.use) return `Transform USE="${t.use}"`;
  if (t.def) return `Transform DEF="${t.def}"`;
  return `Transform #${t.index + 1}`;
}
