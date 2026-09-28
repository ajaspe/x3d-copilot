# X3D Copilot

**A browser-based X3D 4.0 editor with a spec-grounded AI co-author, live X_ITE rendering, ISO schema + semantic validation, and multi-format import.**

> Web3D 2026 competition entry (Web3D/Metaverse Tools · AI & Web3D Innovation). Live: https://albertojaspe.net/x3d-copilot/

X3D Copilot lets you *talk* a scene into existence and keeps it honest: every change the AI (or you) makes is
checked against the **official X3D 4.0 XML Schema**, a **semantic linter grounded in the X3D Unified Object Model**
(ISO/IEC 19775-1), and the **X_ITE** runtime, and the model then *looks* at the rendered result before it reports back.

```
 ┌──────────────┐    tools     ┌──────────────────────┐   X3D XML   ┌──────────────┐
 │  Claude      │◄────────────►│  X3D Copilot (browser)│◄──────────►│  CodeMirror  │
 │  (your key)  │ get/edit/    │  · X3DUOM spec DB     │            │  editor      │
 │              │ replace/     │  · semantic linter    │            └──────────────┘
 │  reads       │ validate/    │  · XSD (libxml2-wasm) │   scene     ┌──────────────┐
 │  validation  │ lookup/      │  · glTF/OBJ/STL → X3D │◄──────────►│  X_ITE       │
 │  reports &   │ screenshot   │                       │  screenshot │  X3D browser │
 │  screenshots │              └──────────────────────┘            └──────────────┘
 └──────────────┘
```

## Features

**Editor & viewer**
- Live X_ITE (X3D 4.0) rendering with Phong/Gouraud/flat/wireframe/point shading, view-all, PNG screenshots.
- CodeMirror 6 XML editor with **spec-driven autocompletion**: node names, allowed children per parent, fields with
  types/defaults/descriptions, all generated from the X3D Unified Object Model.
- Inline diagnostics (gutter markers + issue list, click to jump).
- Import `.x3d`, `.x3dv`, `.x3dj`, `.wrl`, **`.gltf`/`.glb`**, `.obj`, `.stl`, `.ply`, `.svg` (drag & drop). Non-X3D
  formats are converted to X3D XML through X_ITE's loaders and become editable source.
- Export X3D XML (as edited or canonicalised), Classic VRML `.x3dv`, JSON `.x3dj`, PNG.
- Seven example scenes, including an X3D4 PBR material study, an HAnim 2.0 humanoid, and a deliberately broken scene.

**Validation (three independent layers)**
1. **Well-formedness + XSD** against `x3d-4.0.xsd` (+ Web3D extension schemas) using libxml2 compiled to
   WebAssembly - runs entirely client-side, in Node too.
2. **Semantic lint** (~30 rules) that the schema cannot express: duplicate DEF, undefined USE, USE with a different node
   type, ROUTE to unknown node/field, ROUTE from a non-output / to a non-input field, ROUTE type mismatch, node in the
   wrong parent field (e.g. `<Material>` directly in `<Shape>`), several children in an SFNode field, Shape without
   geometry, empty groups, attribute type/arity checks (SFVec3f needs 3 numbers, colours in [0,1], booleans lowercase,
   zero rotation axis), spec range checks (`transparency`, `groundAngle`, ...), interpolator key/keyValue consistency,
   missing Viewpoint, unknown nodes/fields with *did-you-mean* suggestions, nodes unsupported by the running X_ITE build.
3. **Runtime**: X_ITE parse errors and warnings (missing textures, bad URLs...) are captured and surfaced.

**AI co-author (Gemini or Claude)**
- Chat with **Google Gemini** or **Anthropic Claude** directly from the browser: your key stays in `localStorage` and is
  sent only to the provider's API host. Switch provider and model in ⚙ Settings; “Fetch models” lists what your key
  can use.
- The model works only through tools: `get_scene`, `edit_scene` (exact, unique text patches), `replace_scene`,
  `validate_scene`, `lookup_node` / `search_nodes` (the ISO spec database), `screenshot` (vision check of the render).
- Every edit returns the full validation report, so the model **repairs its own mistakes** until the scene is valid and
  renders; then it looks at a screenshot to check framing, lighting and colours.
- Streaming, function calling with multimodal tool results, thinking level / effort control. The provider layer
  (`src/ai/providers/`) is ~150 lines per backend, so adding another is straightforward.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest: linter, XSD, tools, all example scenes
npm run build      # static site in dist/
```

Set your API key in **⚙ Settings**. No server component exists: the whole tool is static files.

Getting a key: **Gemini** - https://aistudio.google.com/apikey (free tier available, no card needed);
**Claude** - https://console.anthropic.com/settings/keys (requires billing).

## Project layout

```
public/schema/        x3d-4.0.xsd + extension schemas + xmldsig (vendored, ISO/Web3D)
public/examples/      example scenes (all tested)
spec/                 X3dUnifiedObjectModel-4.0.xml (Web3D Consortium)
scripts/build-uom.mjs generates src/generated/x3duom.json (260 nodes, 78 abstract types, 17 statements)
src/spec/uom.ts       spec database queries: hierarchy, acceptable children, field lookup, fuzzy suggestions
src/validation/       lint.ts (semantic rules), xsd.ts (libxml2-wasm), index.ts (pipeline)
src/viewer.ts         X_ITE wrapper: load, capture runtime issues, screenshot, convert formats, serialise
src/editor.ts         CodeMirror 6 with UOM-driven completion + diagnostics
src/ai/               prompt.ts, tools.ts (tool schemas + executors), agent.ts (provider-neutral tool loop),
                      providers/gemini.ts + providers/anthropic.ts (SDK adapters)
src/main.ts           UI wiring
tests/                vitest suites
```

## Standards & credits

- X3D 4.0, ISO/IEC 19775-1:2023, XML encoding ISO/IEC 19776-1; schema and X3DUOM © Web3D Consortium.
- [X_ITE](https://create3000.github.io/x_ite/) X3D browser by Holger Seelig (MIT).
- [libxml2-wasm](https://github.com/jameslan/libxml2-wasm) (MIT), [CodeMirror 6](https://codemirror.net/) (MIT),
  [Google Gen AI SDK](https://github.com/googleapis/js-genai) (Apache-2.0),
  [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) (MIT).

MIT License.
