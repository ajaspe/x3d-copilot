# Demo video plan — X3D Copilot (Tools competition, ≤ 5 min; target 3:30)

Produced automatically by `scripts/record-demo.mjs` (Playwright drives the app and records
the screen) + `scripts/narrate.mjs` (text-to-speech) + `scripts/assemble-video.mjs` (ffmpeg).
The narration below is what the TTS reads; timings are the segment budgets.

| # | Segment (what is on screen) | Budget |
|---|-----------------------------|--------|
| 1 | Title card: "X3D Copilot — a spec-grounded, AI-assisted X3D 4.0 editor in the browser". Then the app with the PBR material study rotating. | 0:20 |
| 2 | Examples menu → Solar system; orbit with the mouse; shading switched to wireframe and back; View all. | 0:25 |
| 3 | Broken scene: the issue list fills with 11 errors; click an issue → editor jumps; hover shows the three sources (lint / schema / runtime). | 0:35 |
| 4 | Copilot: "Fix everything wrong with this scene…" — tool chips appear (read, edit, validate, screenshot), issues drop to zero, scene renders. | 0:60 |
| 5 | Selection: click the earth → gizmo + inspector; drag an arrow; scrub the rotation; source updates live; Esc. | 0:35 |
| 6 | Import: drop a glTF duck → converted to X3D XML; Export menu; then "Convert Material to PhysicalMaterial" via chat (short). | 0:30 |
| 7 | Closing card: tests (51 passing), MIT, links; "why Tool of the Year / Innovation of the Year". | 0:25 |

## Narration

**S1.** X3D Copilot is an X3D 4.0 editor that runs entirely in the browser. Three panes: an AI co-author, a live X_ITE view, and the scene source. Nothing to install, and everything you see here is standard X3D.

**S2.** Scenes render as you type. Animation, sensors, physically based materials and HAnim characters all work, with shading modes and screenshots one click away. Autocompletion is generated from the X3D Unified Object Model, so it knows every node, its allowed children and every field's type and default.

**S3.** The heart of the tool is validation. Every change is checked three ways: against the official X3D 4.0 XML Schema, running as libxml2 in WebAssembly; by a semantic linter with about thirty rules the schema cannot express, such as broken ROUTEs, nodes in the wrong parent field, or interpolator key mismatches; and by the X_ITE runtime itself. This deliberately broken scene shows eleven errors, each with a line number, a plain-language explanation and a suggested fix.

**S4.** The AI co-author can only act through tools. It reads the scene, applies exact patches, and every patch returns the full validation report, so it repairs its own mistakes. When it needs a field name or a default value it looks the node up in the ISO specification database instead of guessing. And once the scene renders, it takes a screenshot to check the result. Here it fixes all eleven errors and verifies the render before answering.

**S5.** Objects can be manipulated directly. Clicking geometry selects its innermost Transform. The gizmo is itself X3D: PlaneSensors and CylinderSensors injected at runtime, never written to your file. Drag to move, rotate or scale, or scrub the numbers in the inspector. The source updates with minimal attribute edits, and placing the cursor on a Transform selects it in the view. The selection is also passed to the AI, so "rotate this by forty-five degrees" just works.

**S6.** Common formats import as editable X3D: glTF, OBJ, STL, PLY, VRML, all converted through X_ITE's own loaders. Export as X3D XML, Classic VRML, or JSON.

**S7.** X3D Copilot is open source under the MIT license, with fifty-three automated tests covering the schema validator, every linter rule and every example scene, and continuous integration on GitHub. It is live today at albertojaspe.net slash x3d-copilot. We believe it deserves consideration as Tool of the Year because it is a complete, usable X3D authoring environment with zero installation, and as Innovation of the Year because it is the first X3D tool where an AI is grounded in the ISO object model and closed-loop validated by schema, linter, runtime and its own eyes. Thank you.
