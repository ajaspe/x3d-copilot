import { Viewer, loadX3D, type ShadingMode } from "./viewer";
import { SceneEditor } from "./editor";
import { Validator } from "./validation";
import { countBySeverity, type Issue } from "./validation/issues";
import { unsupportedNodes } from "./validation/lint";
import { downgradeTo40 } from "./validation/downgrade";
import { Copilot, type AgentEvent, type AgentSettings } from "./ai/agent";
import { createExecutor, type AppBridge, type SceneReport } from "./ai/tools";
import { SUGGESTIONS } from "./ai/prompt";
import { createProvider, DEFAULT_MODELS, PROVIDER_KEY_HELP, type Effort, type ProviderId } from "./ai";
import { SceneTools, type TransformState } from "./select/gizmo";
import { Inspector } from "./select/inspector";
import { listTransforms, transformAtPos, buildTransformChanges, describeEntry, type TransformEntry } from "./select/sourceMap";
import { fmtVec } from "./select/math";
import type { RuntimeReport } from "./viewer";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const BASE = import.meta.env.BASE_URL;
const REPO_URL = "https://github.com/ajaspe/x3d-copilot";

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
const SETTINGS_KEY = "x3d-copilot.settings.v2";
const LEGACY_SETTINGS_KEY = "x3d-copilot.settings.v1";
const SCENE_KEY = "x3d-copilot.scene.v1";

interface StoredSettings {
  provider: ProviderId;
  keys: Record<ProviderId, string>;
  models: Record<ProviderId, string>;
  effort: Effort;
  baseURL: Record<ProviderId, string>;
  autoScreenshot: boolean;
}

function defaultSettings(): StoredSettings {
  return {
    provider: "gemini",
    keys: { anthropic: "", gemini: "" },
    models: { anthropic: DEFAULT_MODELS.anthropic[0].id, gemini: DEFAULT_MODELS.gemini[0].id },
    effort: "",
    baseURL: { anthropic: "", gemini: "" },
    autoScreenshot: true,
  };
}

function loadSettings(): StoredSettings {
  const d = defaultSettings();
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<StoredSettings>;
      return { ...d, ...s, keys: { ...d.keys, ...s.keys }, models: { ...d.models, ...s.models }, baseURL: { ...d.baseURL, ...s.baseURL } };
    }
    const legacy = localStorage.getItem(LEGACY_SETTINGS_KEY);
    if (legacy) {
      const s = JSON.parse(legacy);
      if (s.apiKey) {
        d.provider = "anthropic";
        d.keys.anthropic = s.apiKey;
        if (s.model) d.models.anthropic = s.model;
        d.effort = s.effort ?? "";
        d.baseURL.anthropic = s.baseURL ?? "";
        d.autoScreenshot = s.autoScreenshot ?? true;
      }
    }
  } catch {
    /* ignore */
  }
  return d;
}
let stored = loadSettings();
const agentSettings = (): AgentSettings => ({
  provider: stored.provider,
  apiKey: stored.keys[stored.provider] ?? "",
  model: stored.models[stored.provider] ?? DEFAULT_MODELS[stored.provider][0].id,
  effort: stored.effort,
  baseURL: stored.baseURL[stored.provider] || undefined,
});

// ---------------------------------------------------------------------------
// Core objects
// ---------------------------------------------------------------------------
const viewer = new Viewer(await loadX3D(BASE), $("#canvas"));
const validator = new Validator(`${BASE}schema/`);
const editor = new SceneEditor($("#editor"), localStorage.getItem(SCENE_KEY) ?? "");

let currentIssues: Issue[] = [];
let runtimeIssues: Issue[] = [];
let currentRuntime: RuntimeReport | null = null;
let renderSeq = 0;

$("#gh-link").setAttribute("href", REPO_URL);

// ---------------------------------------------------------------------------
// Validation + rendering pipeline
// ---------------------------------------------------------------------------
async function runPipeline(text: string, opts: { render?: boolean } = { render: true }): Promise<SceneReport> {
  const seq = ++renderSeq;
  const { issues, schemaChecked } = validator.validate(text);
  const wellFormed = !issues.some((i) => i.source === "xml");
  let runtime: RuntimeReport | null = null;
  if (wellFormed && opts.render !== false) {
    runtime = await viewer.loadScene(text);
    if (seq !== renderSeq) return { issues, schemaChecked, runtime: null, lines: text.split("\n").length };
    runtimeIssues = [];
    for (const e of runtime.errors) runtimeIssues.push({ severity: "error", message: `X_ITE: ${e}`, source: "runtime", rule: "runtime/error" });
    for (const w of runtime.warnings) runtimeIssues.push({ severity: "warning", message: `X_ITE: ${w}`, source: "runtime", rule: "runtime/warning" });
    const missing = unsupportedNodes(text, viewer.supportedNodes());
    for (const n of missing) runtimeIssues.push({ severity: "warning", message: `<${n}> is valid X3D but not implemented by X_ITE ${viewer.version}; it will not render`, source: "runtime", rule: "runtime/unsupported-node" });
    currentRuntime = runtime;
    attachSceneTools();
  } else if (!wellFormed) {
    runtimeIssues = [];
    currentRuntime = null;
  } else {
    runtime = currentRuntime; // render skipped: keep the last runtime result
  }
  issues.push(...runtimeIssues);
  currentIssues = issues;
  renderIssues();
  editor.setIssues(issues);
  updateViewStatus(runtime, text, wellFormed);
  try {
    localStorage.setItem(SCENE_KEY, text);
  } catch {
    /* quota */
  }
  return { issues, schemaChecked, runtime, lines: text.split("\n").length };
}

editor.onChange((text) => void runPipeline(text));

// ---------------------------------------------------------------------------
// Selection + transform gizmo
// ---------------------------------------------------------------------------
let sourceTransforms: TransformEntry[] = [];
let selectedEntry: TransformEntry | null = null;
let pendingReselect: number | null = null;

const inspector = new Inspector($("#view-pane"), {
  onChange(state, commit) {
    if (tools.selection === null) return;
    tools.setState(tools.selection, state);
    onGizmoTransform(tools.selection, tools.getState(tools.selection)!, commit);
  },
  onDeselect: () => tools.select(null),
  onSelectParent: selectParentTransform,
  onGoToSource() {
    if (selectedEntry) editor.revealRange(selectedEntry.tagFrom, selectedEntry.tagTo);
  },
  onModes: (modes) => tools.setModes(modes),
  onAsk() {
    chatInput.value = `About the selected ${selectedEntry ? describeEntry(selectedEntry) : "node"}: `;
    chatInput.focus();
  },
});

const tools = new SceneTools(viewer.X3D, {
  onSelect(index) {
    if (index === null) {
      selectedEntry = null;
      inspector.hide();
      return;
    }
    sourceTransforms = listTransforms(editor.state);
    const entry = sourceTransforms[index];
    if (!entry) {
      // source and scene out of sync (should not happen); ignore
      selectedEntry = null;
      inspector.hide();
      return;
    }
    selectedEntry = entry;
    const st = tools.getState(index)!;
    inspector.show(describeEntry(entry), entry.line, st);
    editor.revealRange(entry.tagFrom, entry.tagTo);
  },
  onTransform: onGizmoTransform,
});

function selectParentTransform() {
  if (!selectedEntry) return;
  sourceTransforms = listTransforms(editor.state);
  const cur = sourceTransforms[selectedEntry.index] ?? selectedEntry;
  if (cur.parent >= 0) tools.select(cur.parent);
}

function onGizmoTransform(index: number, state: TransformState, commit: boolean) {
  inspector.update(state);
  if (!commit) return;
  sourceTransforms = listTransforms(editor.state);
  const entry = sourceTransforms[index];
  if (!entry) return;
  if (entry.use) {
    addMessage("system", `This is a USE reference to '${entry.use}'; edit the DEF-ed Transform instead.`);
    return;
  }
  const changes = buildTransformChanges(entry, state);
  editor.applyGizmoChanges(changes);
}

// gizmo edits: re-lint the text but keep the live scene (already up to date)
editor.onGizmoChange((text) => {
  pendingReselect = tools.selection;
  void runPipeline(text, { render: false }).then(() => {
    sourceTransforms = listTransforms(editor.state);
    if (pendingReselect !== null && sourceTransforms[pendingReselect]) selectedEntry = sourceTransforms[pendingReselect];
  });
});

// cursor in the editor selects the enclosing Transform
editor.onCursor((pos) => {
  if (!tools.enabled) return;
  const list = listTransforms(editor.state);
  const entry = transformAtPos(list, pos);
  if (entry && entry.index !== tools.selection) {
    sourceTransforms = list;
    tools.select(entry.index);
  }
});

function attachSceneTools() {
  const prev = tools.selection;
  try {
    tools.attach(viewer.browser.currentScene);
    if (prev !== null && prev < tools.count) tools.select(prev);
    else if (prev !== null) tools.select(null);
  } catch (e) {
    console.warn("scene tools", e);
  }
}

const btnSelect = $("#btn-select");
btnSelect.addEventListener("click", () => {
  const on = !tools.enabled;
  tools.setEnabled(on);
  btnSelect.classList.toggle("on", on);
  if (currentRuntime?.ok) void runPipeline(editor.getValue()); // re-inject / remove selectors
});

function selectionContext(): string {
  if (tools.selection === null || !selectedEntry) return "";
  const st = tools.getState(tools.selection);
  if (!st) return "";
  return `\n\n[Context: the user has selected <${describeEntry(selectedEntry)}> at source line ${selectedEntry.line} (translation ${fmtVec(st.translation)}, rotation ${fmtVec(st.rotation, 5)}, scale ${fmtVec(st.scale)}). "This"/"it"/"the selected object" refers to that Transform.]`;
}

function updateViewStatus(rt: RuntimeReport | null, text: string, wellFormed: boolean) {
  const el = $("#view-status");
  if (!rt) {
    el.textContent = wellFormed ? "Rendering…" : "Not rendered: fix XML errors first";
    el.classList.toggle("err", !wellFormed);
    return;
  }
  el.classList.toggle("err", !rt.ok);
  const nodes = (text.match(/<[A-Z][A-Za-z0-9]*[\s/>]/g) ?? []).length;
  el.textContent = rt.ok ? `X_ITE ${viewer.version} · ${nodes} nodes · ${rt.ms} ms` : `Render failed: ${rt.errors[0]}`;
}

// ---------------------------------------------------------------------------
// Issues pane
// ---------------------------------------------------------------------------
function renderIssues() {
  const list = $("#issue-list");
  const showSchema = ($("#show-schema") as HTMLInputElement).checked;
  const showInfo = ($("#show-info") as HTMLInputElement).checked;
  const visible = currentIssues.filter((i) => (showSchema || i.source !== "schema") && (showInfo || i.severity !== "info"));
  list.innerHTML = "";
  const counts = countBySeverity(currentIssues);
  const badge = $("#issue-summary");
  badge.className = "badge " + (counts.error ? "err" : counts.warning ? "warn" : "ok");
  badge.textContent = counts.error ? `${counts.error} error${counts.error > 1 ? "s" : ""}` : counts.warning ? `${counts.warning} warning${counts.warning > 1 ? "s" : ""}` : validator.schemaReady ? "valid X3D 4.0" : "valid (schema loading…)";
  if (!visible.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = currentIssues.length ? "Nothing to show with the current filters." : "No issues found. The scene is well-formed, spec-conformant X3D 4.0.";
    list.appendChild(li);
    return;
  }
  for (const i of visible) {
    const li = document.createElement("li");
    li.className = i.severity;
    li.innerHTML = `<span class="sev">${i.severity === "error" ? "●" : i.severity === "warning" ? "▲" : "ℹ"}</span><span class="loc">${i.line ? `L${i.line}` : "—"}</span><span class="text"></span><span class="src">${i.source}</span>`;
    li.querySelector(".text")!.textContent = i.message;
    if (i.line) li.addEventListener("click", () => editor.revealLine(i.line!));
    list.appendChild(li);
  }
}
$("#show-schema").addEventListener("change", renderIssues);
$("#show-info").addEventListener("change", renderIssues);

// ---------------------------------------------------------------------------
// Copilot wiring
// ---------------------------------------------------------------------------
const bridge: AppBridge = {
  getScene: () => editor.getValue(),
  applyScene: async (text) => {
    editor.setValue(text, { silent: true });
    const report = await runPipeline(text);
    return report;
  },
  validate: () => runPipeline(editor.getValue()),
  screenshot: () => viewer.screenshot(),
  supportedNodes: () => viewer.supportedNodes(),
};
const execute = createExecutor(bridge);

const chatLog = $("#chat-log");
let currentAssistant: HTMLDivElement | null = null;
let currentTextNode: HTMLSpanElement | null = null;

function addMessage(role: "user" | "assistant" | "system", text = ""): HTMLDivElement {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  if (text) div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  return div;
}

function onAgentEvent(e: AgentEvent) {
  switch (e.type) {
    case "turn_start":
      currentAssistant = addMessage("assistant");
      currentTextNode = null;
      $("#btn-send").setAttribute("disabled", "true");
      $("#btn-stop").removeAttribute("hidden");
      break;
    case "text":
      if (!currentAssistant) currentAssistant = addMessage("assistant");
      if (!currentTextNode) {
        currentTextNode = document.createElement("span");
        currentAssistant.appendChild(currentTextNode);
      }
      currentTextNode.textContent += e.delta;
      chatLog.scrollTop = chatLog.scrollHeight;
      break;
    case "tool_start": {
      if (!currentAssistant) currentAssistant = addMessage("assistant");
      currentTextNode = null;
      const chip = document.createElement("div");
      chip.className = "tool running";
      chip.dataset.id = e.id;
      chip.textContent = toolLabel(e.name, e.input);
      currentAssistant.appendChild(chip);
      chatLog.scrollTop = chatLog.scrollHeight;
      break;
    }
    case "tool_end": {
      const chip = currentAssistant?.querySelector<HTMLDivElement>(`.tool[data-id="${e.id}"]`);
      if (!chip) break;
      chip.className = `tool ${e.result.isError ? "err" : "ok"}`;
      chip.innerHTML = "";
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = e.result.summary;
      details.appendChild(summary);
      if (e.name !== "get_scene" && e.name !== "screenshot") {
        const pre = document.createElement("pre");
        pre.textContent = e.result.text.slice(0, 4000);
        details.appendChild(pre);
      }
      chip.appendChild(details);
      if (e.result.image) {
        const img = document.createElement("img");
        img.className = "shot";
        img.src = e.result.image;
        img.alt = "screenshot";
        chip.appendChild(img);
      }
      break;
    }
    case "stopped":
      addMessage("system", e.reason);
      break;
    case "error":
      addMessage("system", `⚠ ${e.message}`);
      break;
    case "turn_end": {
      if (currentAssistant && e.usage.input + e.usage.output > 0) {
        const u = document.createElement("div");
        u.className = "usage";
        u.textContent = `${e.usage.input.toLocaleString()} in · ${e.usage.output.toLocaleString()} out${e.usage.cacheRead ? ` · ${e.usage.cacheRead.toLocaleString()} cached` : ""}`;
        currentAssistant.appendChild(u);
      }
      if (currentAssistant && !currentAssistant.textContent?.trim()) currentAssistant.remove();
      currentAssistant = null;
      $("#btn-send").removeAttribute("disabled");
      $("#btn-stop").setAttribute("hidden", "true");
      break;
    }
  }
}

function toolLabel(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "get_scene": return "Reading the scene…";
    case "replace_scene": return "Writing a new scene…";
    case "edit_scene": return `Editing the scene (${(input.edits as unknown[])?.length ?? 0} change${((input.edits as unknown[])?.length ?? 0) === 1 ? "" : "s"})…`;
    case "validate_scene": return "Validating…";
    case "lookup_node": return `Looking up <${input.name}> in the X3D spec…`;
    case "search_nodes": return `Searching nodes for “${input.query}”…`;
    case "screenshot": return "Looking at the render…";
    default: return name;
  }
}

const copilot = new Copilot(agentSettings, execute, onAgentEvent);

const chatForm = $("#chat-form") as HTMLFormElement;
const chatInput = $("#chat-input") as HTMLTextAreaElement;
chatForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const text = chatInput.value.trim();
  if (!text || copilot.busy) return;
  chatInput.value = "";
  addMessage("user", text);
  let shot: string | undefined;
  if (($("#chat-attach") as HTMLInputElement).checked) {
    try {
      shot = await viewer.screenshot(800);
    } catch {
      /* ignore */
    }
  }
  const hint = stored.autoScreenshot ? "" : "\n\n(Do not call the screenshot tool unless I ask for it.)";
  await copilot.send(text + selectionContext() + hint, shot);
});
chatInput.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter" && !ev.shiftKey) {
    ev.preventDefault();
    chatForm.requestSubmit();
  }
});
$("#btn-stop").addEventListener("click", () => copilot.abort());
$("#btn-clear-chat").addEventListener("click", () => {
  copilot.reset();
  chatLog.innerHTML = "";
  addMessage("system", "Conversation cleared.");
});

const sugg = $("#chat-suggestions");
for (const s of SUGGESTIONS.slice(0, 4)) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = s;
  b.addEventListener("click", () => {
    chatInput.value = s;
    chatForm.requestSubmit();
  });
  sugg.appendChild(b);
}

// ---------------------------------------------------------------------------
// Settings dialog
// ---------------------------------------------------------------------------
const dlg = $("#settings") as HTMLDialogElement;
const setProvider = $("#set-provider") as HTMLSelectElement;
const setKey = $("#set-key") as HTMLInputElement;
const setModel = $("#set-model") as HTMLInputElement;
const setEffort = $("#set-effort") as HTMLSelectElement;
const setBaseUrl = $("#set-baseurl") as HTMLInputElement;
const setAutoshot = $("#set-autoshot") as HTMLInputElement;
const modelList = $("#model-list") as HTMLDataListElement;
const modelNote = $("#set-model-note");
/** Working copy while the dialog is open (per-provider fields swap as the provider changes). */
let draft: StoredSettings = structuredClone(stored);

function updateModelBadge() {
  const s = agentSettings();
  const b = $("#model-badge");
  b.textContent = s.apiKey ? `${s.provider === "gemini" ? "gemini" : "claude"} · ${s.model.replace(/^(claude-|gemini-)/, "")}${s.effort ? ` · ${s.effort}` : ""}` : "no API key";
  b.className = "badge " + (s.apiKey ? "ok" : "warn");
}

function fillModelList(p: ProviderId, models: { id: string; label: string }[]) {
  modelList.innerHTML = "";
  for (const m of models) {
    const o = document.createElement("option");
    o.value = m.id;
    o.label = m.label;
    o.textContent = m.label;
    modelList.appendChild(o);
  }
  modelNote.textContent = `${models.length} model(s) for ${p === "gemini" ? "Gemini" : "Claude"}; type any model id or pick one.`;
}

function showProviderFields(p: ProviderId) {
  const help = PROVIDER_KEY_HELP[p];
  setKey.value = draft.keys[p] ?? "";
  setKey.placeholder = help.placeholder;
  ($("#set-key-link") as HTMLAnchorElement).href = help.url;
  $("#set-host").textContent = help.host;
  setModel.value = draft.models[p] || DEFAULT_MODELS[p][0].id;
  setBaseUrl.value = draft.baseURL[p] ?? "";
  fillModelList(p, DEFAULT_MODELS[p]);
}

function readProviderFields(p: ProviderId) {
  draft.keys[p] = setKey.value.trim();
  draft.models[p] = setModel.value.trim() || DEFAULT_MODELS[p][0].id;
  draft.baseURL[p] = setBaseUrl.value.trim();
}

$("#btn-settings").addEventListener("click", () => {
  draft = structuredClone(stored);
  setProvider.value = draft.provider;
  setEffort.value = draft.effort;
  setAutoshot.checked = draft.autoScreenshot;
  showProviderFields(draft.provider);
  dlg.showModal();
});
setProvider.addEventListener("change", () => {
  readProviderFields(draft.provider);
  draft.provider = setProvider.value as ProviderId;
  showProviderFields(draft.provider);
});
$("#set-fetch-models").addEventListener("click", async () => {
  const p = setProvider.value as ProviderId;
  readProviderFields(p);
  if (!draft.keys[p]) {
    modelNote.textContent = "Enter an API key first.";
    return;
  }
  modelNote.textContent = "Fetching models…";
  try {
    const provider = createProvider({ provider: p, apiKey: draft.keys[p], model: draft.models[p], effort: "", baseURL: draft.baseURL[p] || undefined });
    const models = await provider.listModels();
    fillModelList(p, models.length ? models : DEFAULT_MODELS[p]);
    if (models.length && !models.some((m) => m.id === setModel.value)) modelNote.textContent += ` Current model '${setModel.value}' is not in the list.`;
  } catch (e) {
    const provider = createProvider({ provider: p, apiKey: draft.keys[p], model: "", effort: "" });
    modelNote.textContent = `Could not list models: ${provider.describeError(e)}`;
  }
});
dlg.addEventListener("close", () => {
  if (dlg.returnValue !== "save") return;
  readProviderFields(setProvider.value as ProviderId);
  draft.provider = setProvider.value as ProviderId;
  draft.effort = setEffort.value as Effort;
  draft.autoScreenshot = setAutoshot.checked;
  stored = draft;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(stored));
  updateModelBadge();
});
updateModelBadge();

// ---------------------------------------------------------------------------
// Toolbar: examples, import, export, view
// ---------------------------------------------------------------------------
interface ExampleEntry { file: string; title: string; description?: string }
const examplesSel = $("#examples") as HTMLSelectElement;
async function loadExampleIndex(): Promise<ExampleEntry[]> {
  try {
    const res = await fetch(`${BASE}examples/index.json`);
    const list = (await res.json()) as ExampleEntry[];
    for (const ex of list) {
      const o = document.createElement("option");
      o.value = ex.file;
      o.textContent = ex.title;
      o.title = ex.description ?? "";
      examplesSel.appendChild(o);
    }
    return list;
  } catch {
    return [];
  }
}
async function loadExample(file: string) {
  const res = await fetch(`${BASE}examples/${file}`);
  const text = await res.text();
  tools.select(null);
  editor.setValue(text, { silent: true });
  await runPipeline(text);
  viewer.viewAll();
}
examplesSel.addEventListener("change", () => {
  if (examplesSel.value) void loadExample(examplesSel.value);
});

const fileInput = $("#file-input") as HTMLInputElement;
$("#btn-import").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  const f = fileInput.files?.[0];
  if (f) void importFile(f);
  fileInput.value = "";
});
async function importFile(file: File) {
  const name = file.name.toLowerCase();
  const status = $("#view-status");
  try {
    let text: string;
    if (name.endsWith(".x3d") || name.endsWith(".xml")) {
      text = await file.text();
    } else {
      status.textContent = `Converting ${file.name} to X3D via X_ITE…`;
      const converted = downgradeTo40(await viewer.convertFileToX3D(file));
      text = converted.xml;
      const dropped = converted.removed.length ? ` Dropped ${converted.removed.map((r) => `${r.node}.${r.attr}`).join(", ")} (X3D 4.1 only).` : "";
      addMessage("system", `Imported ${file.name} and converted it to X3D 4.0 XML (${text.split("\n").length} lines) using X_ITE's ${name.split(".").pop()?.toUpperCase()} importer.${dropped}`);
    }
    tools.select(null);
    editor.setValue(text, { silent: true });
    await runPipeline(text);
    viewer.viewAll();
  } catch (e) {
    addMessage("system", `⚠ Import failed: ${(e as Error).message}`);
  }
}

// drag & drop
const drop = $("#drop-hint");
for (const t of ["dragenter", "dragover"]) document.addEventListener(t, (ev) => { ev.preventDefault(); drop.classList.remove("hidden"); });
for (const t of ["dragleave", "drop"]) document.addEventListener(t, (ev) => { ev.preventDefault(); if (t === "drop" || (ev as DragEvent).relatedTarget === null) drop.classList.add("hidden"); });
document.addEventListener("drop", (ev) => {
  const f = (ev as DragEvent).dataTransfer?.files?.[0];
  if (f) void importFile(f);
});

// export menu
const exportMenu = $("#btn-export").parentElement!;
$("#btn-export").addEventListener("click", (ev) => { ev.stopPropagation(); exportMenu.classList.toggle("open"); });
document.addEventListener("click", () => exportMenu.classList.remove("open"));
$("#export-menu").addEventListener("click", async (ev) => {
  const kind = (ev.target as HTMLElement).dataset.export;
  if (!kind) return;
  const title = sceneTitle(editor.getValue());
  try {
    switch (kind) {
      case "x3d": download(`${title}.x3d`, editor.getValue(), "model/x3d+xml"); break;
      case "x3d-canonical": download(`${title}.x3d`, viewer.toXML(), "model/x3d+xml"); break;
      case "x3dv": download(`${title}.x3dv`, viewer.toVRML(), "model/x3d+vrml"); break;
      case "x3dj": download(`${title}.x3dj`, viewer.toJSON(), "model/x3d+json"); break;
      case "png": {
        const url = await viewer.screenshot(4096);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title}.png`;
        a.click();
        break;
      }
    }
  } catch (e) {
    addMessage("system", `⚠ Export failed: ${(e as Error).message}`);
  }
});
function sceneTitle(xml: string): string {
  const m = /<meta\s+name=["']title["']\s+content=["']([^"']+)["']/.exec(xml);
  return (m?.[1] ?? "scene").replace(/\.x3d$/i, "").replace(/[^\w.-]+/g, "_");
}
function download(name: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("#btn-viewall").addEventListener("click", () => viewer.viewAll());
$("#shading").addEventListener("change", () => viewer.setShading(($("#shading") as HTMLSelectElement).value as ShadingMode));
$("#btn-validate").addEventListener("click", () => void runPipeline(editor.getValue()));
$("#btn-format").addEventListener("click", async () => {
  if (currentRuntime && !currentRuntime.ok) return addMessage("system", "Fix render errors before formatting (the canonical form comes from X_ITE's loaded scene).");
  try {
    const canon = downgradeTo40(viewer.toXML()).xml;
    tools.select(null);
    editor.setValue(canon, { silent: true });
    await runPipeline(canon);
  } catch (e) {
    addMessage("system", `⚠ Format failed: ${(e as Error).message}`);
  }
});

document.addEventListener("keydown", (ev) => {
  const inField = (ev.target as HTMLElement).matches("input, textarea, .cm-content");
  if (!inField && ev.key === "Escape" && tools.selection !== null) { ev.preventDefault(); tools.select(null); }
  if (!inField && ev.key === "Backspace" && tools.selection !== null) { ev.preventDefault(); selectParentTransform(); }
  if (!inField && ev.key.toLowerCase() === "s" && !ev.ctrlKey && !ev.metaKey) { ev.preventDefault(); btnSelect.click(); }
  if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") { ev.preventDefault(); void runPipeline(editor.getValue()); }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "o") { ev.preventDefault(); fileInput.click(); }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "s") { ev.preventDefault(); download(`${sceneTitle(editor.getValue())}.x3d`, editor.getValue(), "model/x3d+xml"); }
});

// splitters
for (const sp of document.querySelectorAll<HTMLElement>(".splitter")) {
  sp.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    sp.classList.add("active");
    const side = sp.dataset.splitter;
    const ws = $("#workspace");
    const move = (e: PointerEvent) => {
      const rect = ws.getBoundingClientRect();
      if (side === "left") {
        ws.style.setProperty("--chat-w", `${Math.max(240, Math.min(e.clientX - rect.left, rect.width * 0.5))}px`);
      } else {
        const w = rect.right - e.clientX;
        ws.style.setProperty("--code-w", `${Math.max(260, Math.min(w, rect.width * 0.7))}px`);
      }
    };
    const up = () => {
      sp.classList.remove("active");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
(async () => {
  addMessage(
    "system",
    "Welcome. Describe a scene or a change and the copilot will write spec-valid X3D 4.0, validate it against the ISO schema and X_ITE, and look at the result. Set your API key in ⚙ Settings. Everything runs in your browser.",
  );
  const examples = await loadExampleIndex();
  await viewer.ready;
  if (editor.getValue().trim()) {
    await runPipeline(editor.getValue());
  } else if (examples.length) {
    examplesSel.value = examples[0].file;
    await loadExample(examples[0].file);
  }
  // load the XSD in the background, then re-validate once
  void validator.ensureSchema().then(() => {
    if (validator.schemaError) addMessage("system", `⚠ ${validator.schemaError}`);
    void runPipeline(editor.getValue(), { render: false });
  });
})();

// Debug / automation handle (used by the browser smoke tests)
Object.assign(window, { __x3dcopilot: { viewer, editor, validator, runPipeline, execute, copilot, tools, inspector } });
