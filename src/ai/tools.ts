/**
 * Tools the copilot can call. Each tool is a JSON-schema definition for the
 * Claude API plus an executor bound to the live application (editor, viewer,
 * validator). Executors return either text or a list of content blocks.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { describeNode, searchNodes, concreteNodesOf, uom } from "../spec/uom";
import { formatIssues, countBySeverity, type Issue } from "../validation/issues";
import type { RuntimeReport } from "../viewer";

export interface SceneReport {
  issues: Issue[];
  schemaChecked: boolean;
  runtime: RuntimeReport | null;
  lines: number;
}

/** What the tool layer needs from the app. */
export interface AppBridge {
  getScene(): string;
  /** Apply new source, validate, render; returns the full report. */
  applyScene(text: string): Promise<SceneReport>;
  validate(): Promise<SceneReport>;
  screenshot(): Promise<string>; // data URL
  supportedNodes(): Set<string>;
}

export type ToolContent = string | Anthropic.ToolResultBlockParam["content"];

export interface ToolExecResult {
  content: ToolContent;
  isError?: boolean;
  /** short human-readable summary for the chat UI */
  summary: string;
  /** optional image (data URL) to show in the chat */
  image?: string;
}

export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: "get_scene",
    description: "Return the current X3D scene source exactly as shown in the editor (XML). Call this before editing an existing scene.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "replace_scene",
    description:
      "Replace the entire scene source with new X3D XML, then validate (lint + XSD + X_ITE render) and return the report. Use for new scenes or large rewrites. The document must be a complete <X3D> file.",
    input_schema: {
      type: "object",
      properties: { x3d: { type: "string", description: "Complete X3D 4.0 XML document." } },
      required: ["x3d"],
      additionalProperties: false,
    },
  },
  {
    name: "edit_scene",
    description:
      "Apply one or more exact text replacements to the current scene source, then validate and render. Each `old` string must occur exactly once in the source (include enough surrounding context to make it unique). Use `old` = '' with `anchor_before` to insert text right before a unique anchor string, e.g. insert new nodes before '</Scene>'. Preferred over replace_scene for targeted changes.",
    input_schema: {
      type: "object",
      properties: {
        edits: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              old: { type: "string", description: "Exact existing text to replace (must be unique). Empty string when inserting with anchor_before." },
              new: { type: "string", description: "Replacement text (or text to insert)." },
              anchor_before: { type: "string", description: "Only when old is empty: unique existing text before which `new` is inserted." },
            },
            required: ["old", "new"],
            additionalProperties: false,
          },
        },
      },
      required: ["edits"],
      additionalProperties: false,
    },
  },
  {
    name: "validate_scene",
    description: "Re-run all validators (well-formedness, semantic lint, XSD schema, X_ITE runtime) on the current scene and return the report without changing anything.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "lookup_node",
    description:
      "Look up an X3D 4.0 node (or abstract type / statement) in the ISO spec database: fields with type, accessType, default, accepted child types, default containerField, component. Use whenever unsure about a field name, default or where a node may be placed.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string", description: "Node type name, e.g. PhysicalMaterial, Extrusion, X3DGeometryNode" } },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "search_nodes",
    description: "Search the X3D 4.0 node catalogue by keyword (name, description or component), or list all concrete nodes deriving from an abstract type (e.g. X3DGeometryNode, X3DLightNode, X3DInterpolatorNode).",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keyword, e.g. 'texture', 'sensor', or an abstract type name like X3DGeometryNode" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "screenshot",
    description: "Render the current scene from the active viewpoint and return a PNG image so you can check the visual result (framing, colours, visibility).",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
];

export function formatReport(r: SceneReport, opts: { includeHints?: boolean } = {}): string {
  const counts = countBySeverity(r.issues);
  const shown = opts.includeHints ? r.issues : r.issues.filter((i) => i.severity !== "info");
  const lines: string[] = [];
  lines.push(
    `Validation: ${counts.error} error(s), ${counts.warning} warning(s), ${counts.info} hint(s)${r.schemaChecked ? " [XSD checked]" : " [XSD not loaded]"}; source has ${r.lines} lines.`,
  );
  if (shown.length) lines.push(formatIssues(shown, 40));
  if (r.runtime) {
    if (r.runtime.ok) lines.push(`Render: OK in X_ITE (${r.runtime.ms} ms)${r.runtime.warnings.length ? `; runtime warnings: ${r.runtime.warnings.slice(0, 5).join(" | ")}` : ""}`);
    else lines.push(`Render: FAILED in X_ITE: ${r.runtime.errors.join(" | ")}`);
  } else {
    lines.push("Render: not attempted (document not well-formed).");
  }
  return lines.join("\n");
}

export function applyEdits(source: string, edits: { old: string; new: string; anchor_before?: string }[]): { text: string; error?: string } {
  let text = source;
  for (const [i, e] of edits.entries()) {
    if (e.old === "") {
      if (!e.anchor_before) return { text: source, error: `edit #${i + 1}: 'old' is empty but no anchor_before given` };
      const n = countOccurrences(text, e.anchor_before);
      if (n !== 1) return { text: source, error: `edit #${i + 1}: anchor_before occurs ${n} times (must be exactly 1)` };
      const idx = text.indexOf(e.anchor_before);
      text = text.slice(0, idx) + e.new + text.slice(idx);
      continue;
    }
    const n = countOccurrences(text, e.old);
    if (n === 0) {
      const hint = nearestLine(text, e.old);
      return { text: source, error: `edit #${i + 1}: 'old' text not found.${hint ? ` Closest existing line: ${hint}` : ""} Call get_scene and copy the text exactly.` };
    }
    if (n > 1) return { text: source, error: `edit #${i + 1}: 'old' text occurs ${n} times; include more context to make it unique` };
    text = text.replace(e.old, () => e.new);
  }
  return { text };
}

function countOccurrences(hay: string, needle: string): number {
  if (!needle) return 0;
  let c = 0;
  let i = 0;
  while ((i = hay.indexOf(needle, i)) !== -1) {
    c++;
    i += needle.length;
  }
  return c;
}

function nearestLine(text: string, needle: string): string | undefined {
  const first = needle.trim().split("\n")[0].trim();
  if (first.length < 4) return undefined;
  const key = first.slice(0, Math.min(24, first.length));
  const line = text.split("\n").find((l) => l.includes(key.split(/\s+/)[0]));
  return line?.trim().slice(0, 120);
}

export function createExecutor(app: AppBridge) {
  return async function execute(name: string, input: Record<string, unknown>): Promise<ToolExecResult> {
    switch (name) {
      case "get_scene": {
        const s = app.getScene();
        return { content: s, summary: `Read scene (${s.split("\n").length} lines)` };
      }
      case "replace_scene": {
        const x3d = String(input.x3d ?? "");
        if (!x3d.trim()) return { content: "Empty document.", isError: true, summary: "Empty replace rejected" };
        const report = await app.applyScene(x3d);
        const errs = countBySeverity(report.issues).error;
        return {
          content: formatReport(report),
          isError: false,
          summary: `Replaced scene · ${errs ? `${errs} error(s)` : "valid"}${report.runtime ? (report.runtime.ok ? " · rendered" : " · render failed") : ""}`,
        };
      }
      case "edit_scene": {
        const edits = (input.edits as { old: string; new: string; anchor_before?: string }[]) ?? [];
        const { text, error } = applyEdits(app.getScene(), edits);
        if (error) return { content: error, isError: true, summary: `Edit failed: ${error.slice(0, 80)}` };
        const report = await app.applyScene(text);
        const errs = countBySeverity(report.issues).error;
        return {
          content: formatReport(report),
          summary: `Applied ${edits.length} edit(s) · ${errs ? `${errs} error(s)` : "valid"}${report.runtime ? (report.runtime.ok ? " · rendered" : " · render failed") : ""}`,
        };
      }
      case "validate_scene": {
        const report = await app.validate();
        return { content: formatReport(report, { includeHints: true }), summary: "Validated scene" };
      }
      case "lookup_node": {
        const n = String(input.name ?? "").trim();
        const d = describeNode(n);
        if (!d) {
          const alt = searchNodes(n, 6).map((x) => x.name);
          return { content: `No node named '${n}' in X3D 4.0.${alt.length ? ` Similar: ${alt.join(", ")}` : ""}`, isError: true, summary: `Lookup ${n}: not found` };
        }
        const supported = app.supportedNodes();
        const note = supported.size && uom.nodes[n] && !supported.has(n) ? `\nNOTE: ${n} is in the spec but NOT implemented by this X_ITE build; it will be ignored at render time.` : "";
        return { content: d + note, summary: `Looked up ${n}` };
      }
      case "search_nodes": {
        const q = String(input.query ?? "").trim();
        if (uom.abstract[q]) {
          const list = concreteNodesOf(q);
          return { content: `Concrete nodes deriving from ${q} (${list.length}): ${list.join(", ")}`, summary: `Listed ${list.length} ${q} nodes` };
        }
        const res = searchNodes(q, 15);
        if (!res.length) return { content: `No nodes match '${q}'.`, summary: `Search '${q}': nothing` };
        return {
          content: res.map((r) => `${r.name} [${r.component}]${r.info ? ` - ${r.info}` : ""}`).join("\n"),
          summary: `Search '${q}': ${res.length} result(s)`,
        };
      }
      case "screenshot": {
        const dataUrl = await app.screenshot();
        const b64 = dataUrl.split(",")[1] ?? "";
        return {
          content: [
            { type: "image", source: { type: "base64", media_type: "image/png", data: b64 } },
            { type: "text", text: "Screenshot of the current view from the active viewpoint." },
          ],
          summary: "Took a screenshot",
          image: dataUrl,
        };
      }
      default:
        return { content: `Unknown tool ${name}`, isError: true, summary: `Unknown tool ${name}` };
    }
  };
}
