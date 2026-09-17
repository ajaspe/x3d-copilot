/**
 * CodeMirror 6 editor for X3D XML with spec-driven autocompletion (elements,
 * children and attributes come from the X3DUOM database) and diagnostics.
 */
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { xml, type ElementSpec, type AttrSpec } from "@codemirror/lang-xml";
import { oneDark } from "@codemirror/theme-one-dark";
import { lintGutter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { uom, UNIVERSAL_ATTRS } from "./spec/uom";
import { childNodesForCompletion, fieldsForCompletion } from "./validation/lint";
import type { Issue } from "./validation/issues";

function buildElementSpecs(): ElementSpec[] {
  const specs: ElementSpec[] = [];
  for (const name of Object.keys(uom.nodes)) {
    const def = uom.nodes[name];
    const attributes: AttrSpec[] = fieldsForCompletion(name).map((f) => ({
      name: f.name,
      values: f.type === "SFBool" ? ["true", "false"] : undefined,
      completion: { detail: f.type, info: f.desc ? `${f.desc}${f.def !== undefined ? ` (default ${f.def})` : ""}` : undefined },
    }));
    for (const u of UNIVERSAL_ATTRS) attributes.push({ name: u });
    specs.push({
      name,
      children: childNodesForCompletion(name),
      attributes,
      completion: { detail: def.component, info: def.info },
    });
  }
  specs.push(
    { name: "X3D", children: ["head", "Scene"], attributes: [{ name: "profile", values: uom.enums.profileNameChoices ?? [] }, { name: "version", values: ["4.0"] }] },
    { name: "head", children: ["meta", "component", "unit"] },
    { name: "meta", attributes: ["name", "content"] },
    { name: "component", attributes: [{ name: "name", values: uom.enums.componentNameChoices ?? [] }, "level"] },
    { name: "Scene", children: childNodesForCompletion("Scene") },
    { name: "ROUTE", attributes: ["fromNode", "fromField", "toNode", "toField"] },
    { name: "ProtoDeclare", children: ["ProtoInterface", "ProtoBody"], attributes: ["name", "appinfo"] },
    { name: "ProtoInterface", children: ["field"] },
    { name: "ProtoBody" },
    { name: "field", attributes: ["name", { name: "type", values: uom.fieldTypes }, { name: "accessType", values: uom.enums.accessTypeChoices ?? [] }, "value"] },
    { name: "ProtoInstance", children: ["fieldValue"], attributes: ["name", "DEF", "USE", "containerField"] },
    { name: "fieldValue", attributes: ["name", "value"] },
    { name: "IS", children: ["connect"] },
    { name: "connect", attributes: ["nodeField", "protoField"] },
  );
  return specs;
}

export class SceneEditor {
  readonly view: EditorView;
  private onChangeCb: ((text: string) => void) | null = null;
  private timer: number | undefined;
  private silent = false;

  constructor(parent: HTMLElement, initial: string) {
    const lang = xml({ elements: buildElementSpecs() });
    this.view = new EditorView({
      parent,
      state: EditorState.create({
        doc: initial,
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          lang,
          oneDark,
          lintGutter(),
          EditorView.lineWrapping,
          EditorView.updateListener.of((u) => {
            if (u.docChanged && !this.silent) this.scheduleChange();
          }),
        ],
      }),
    });
  }

  onChange(cb: (text: string) => void) {
    this.onChangeCb = cb;
  }

  private scheduleChange() {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.onChangeCb?.(this.getValue()), 450);
  }

  getValue(): string {
    return this.view.state.doc.toString();
  }

  /** Replace the whole document (kept in undo history). */
  setValue(text: string, opts: { silent?: boolean } = {}) {
    const cur = this.view.state.doc;
    if (cur.toString() === text) return;
    this.silent = !!opts.silent;
    this.view.dispatch({ changes: { from: 0, to: cur.length, insert: text } });
    this.silent = false;
  }

  setIssues(issues: Issue[]) {
    const doc = this.view.state.doc;
    const diags: Diagnostic[] = [];
    for (const i of issues) {
      if (!i.line || i.line < 1 || i.line > doc.lines) continue;
      const line = doc.line(i.line);
      let from = line.from;
      let to = line.to;
      if (i.col && i.col > 0 && line.from + i.col - 1 < line.to) from = line.from + i.col - 1;
      // trim leading whitespace so the squiggle starts at the tag
      const lead = /^\s*/.exec(line.text)?.[0].length ?? 0;
      if (from === line.from) from = Math.min(line.from + lead, line.to);
      if (to <= from) to = Math.min(from + 1, line.to);
      diags.push({ from, to, severity: i.severity === "info" ? "hint" : i.severity, message: i.message, source: i.source });
    }
    this.view.dispatch(setDiagnostics(this.view.state, diags));
  }

  revealLine(n: number) {
    const doc = this.view.state.doc;
    if (n < 1 || n > doc.lines) return;
    const line = doc.line(n);
    this.view.dispatch({ selection: { anchor: line.from, head: line.to }, scrollIntoView: true });
    this.view.focus();
  }

  focus() {
    this.view.focus();
  }
}
