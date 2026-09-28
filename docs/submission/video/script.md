# Demo video plan — X3D Copilot (Tools competition, ≤ 5 min)

Produced by `scripts/record-demo.mjs` (Playwright drives the app and records the screen),
`scripts/narrate.mjs` (Edge neural TTS) and `scripts/assemble-video.mjs` (ffmpeg; stretches where the
model is working are time-lapsed 4× with a badge).

| # | Segment (what is on screen) | Budget |
|---|-----------------------------|--------|
| 1 | Title card, then the app with the PBR material study. | 0:20 |
| 2 | Examples → Solar system; orbit; wireframe and back; View all. | 0:25 |
| 3 | Interaction: "Click to animate" example; the cone is clicked twice and bounces/flashes. | 0:22 |
| 4 | Broken scene: 11 errors; click issues → editor jumps. | 0:35 |
| 5 | Copilot repairs the broken scene (tool chips, validation, screenshot). | 0:30 + lapse |
| 6 | Selection: earth selected → gizmo + inspector; scrub; source updates. | 0:35 |
| 7 | Import a glTF duck → X3D; Export menu. | 0:20 |
| 8 | A scene from one sentence: the copilot generates a small scene (tool chips, validation, screenshot). | 0:25 + lapse |
| 9 | Closing card. | 0:40 |

## Narration

**S1.** X3D Copilot is an X3D 4.0 editor that runs entirely in the browser. Three panes: an AI co-author, a live X_ITE view, and the scene source. Nothing to install, and everything you see here is standard X3D.

**S2.** Scenes render as you type. Animation, sensors, physically based materials and HAnim characters all work, with shading modes and screenshots one click away. Autocompletion is generated from the X3D Unified Object Model, so it knows every node, its allowed children and every field's type and default.

**S3.** Events work exactly as in any X3D browser. This scene wires a TouchSensor to a TimeSensor: clicking the cone starts a bounce and a colour flash through interpolators and ROUTEs, and every one of those connections is checked by the validators.

**S4.** Validation is the heart of the tool. Every change is checked three ways: against the official X3D 4.0 XML Schema, running as libxml2 in WebAssembly; by a semantic linter with about thirty rules the schema cannot express, such as broken ROUTEs, nodes in the wrong parent field, or interpolator key mismatches; and by the X_ITE runtime itself. This deliberately broken scene shows eleven errors, each with a line number, a plain-language explanation and a suggested fix.

**S5.** The AI co-author can only act through tools. It reads the scene, applies exact patches, and every patch returns the full validation report, so it repairs its own mistakes. When it needs a field name or a default value it looks the node up in the ISO specification database instead of guessing. Once the scene renders, it takes a screenshot to check the result. Here it fixes all eleven errors and verifies the render before answering.

**S6.** Objects can be manipulated directly. Clicking geometry selects its innermost Transform. The gizmo is itself X3D: PlaneSensors and CylinderSensors injected at runtime, never written to your file. Drag to move, rotate or scale, or scrub the numbers in the inspector. The source updates with minimal attribute edits, and placing the cursor on a Transform selects it in the view. The selection is also passed to the AI, so "rotate this by forty-five degrees" just works.

**S7.** Common formats import as editable X3D: glTF, OBJ, STL, PLY, VRML, all converted through X_ITE's own loaders and normalised to X3D 4.0. Export as X3D XML, Classic VRML, or JSON.

**S8.** And the copilot creates as well as repairs. One sentence, a wooden table with a bowl of fruit, becomes a complete scene: the model looks up the nodes it needs, writes the file, validates it, and checks the render before answering.

**S9.** X3D Copilot is open source under the MIT license, with fifty-four automated tests covering the schema validator, every linter rule and every example scene, and continuous integration on GitHub. It is live today at albertojaspe.net slash x3d-copilot. We believe it deserves consideration as Tool of the Year because it is a complete, usable X3D authoring environment with zero installation, and as Innovation of the Year because it is the first X3D tool where an AI is grounded in the ISO object model and closed-loop validated by schema, linter, runtime and its own eyes. Thank you.
