# Demo video plan — X3D Copilot (Tools competition, ≤ 5 min)

Produced by `scripts/record-demo.mjs` (Playwright drives the app and records the screen),
`scripts/narrate.mjs` (Edge neural TTS) and `scripts/assemble-video.mjs` (ffmpeg; stretches where the
model is working are time-lapsed with a badge).

Story: hook (AI builds a scene) → edit & view → manipulate → interact → validate & repair → render → import/export → why.

| # | Segment (what is on screen) | Criteria shown |
|---|-----------------------------|----------------|
| 1 | Title card over the app; one sentence → the copilot builds a studio still life (tool chips, validation, screenshot). | originality, AI, ease of use |
| 2 | Solar system example: animation, orbit, wireframe → Phong, View all; autocompletion popup in the editor. | animation, UI, configurability, X3D adherence |
| 3 | Gizmo: click the earth, inspector, scrub values, source updates; "make this bigger" via chat. | UI, technical execution |
| 4 | Snowman example: click him, the hat hops. | animation/events |
| 5 | Broken scene: 11 errors listed, click to jump; then the copilot repairs it. | error handling, X3D adherence, test cases |
| 6 | PBR material study: orbit; shading modes. | advanced features (shaders, PBR) |
| 7 | Import glTF duck → X3D; Export menu (XML, VRML, JSON, PNG). | converter, extensibility |
| 8 | Closing card. | open source, tests, performance |

## Narration

**S1.** X3D Copilot is an X3D 4.0 editor with a built-in AI co-author, and it runs entirely in the browser. Let's start with one sentence: a studio still life with a ceramic vase, a bronze sphere and a glass cube. The copilot looks up the nodes it needs in the ISO specification database, writes the file, validates it against the X3D schema, a semantic linter and the X_ITE runtime, and checks a screenshot before answering. The result is standard X3D 4.0, with physically based materials and shadows, that you can now edit by hand.

**S2.** Three panes: the copilot, a live X_ITE view and the source. Scenes render as you type: this solar system runs nested Transforms with independent TimeSensors and interpolators. Shading modes, view-all and screenshots are one click away, and autocompletion is generated from the X3D Unified Object Model, so it knows every node, its allowed children and every field's type and default.

**S3.** Objects can be manipulated directly. Clicking geometry selects its innermost Transform. The gizmo is itself X3D: PlaneSensors and CylinderSensors injected at runtime, never written to your file. Drag the handles, or scrub the numbers in the inspector, and the source updates with minimal attribute edits. The selection is also passed to the copilot, so "make this twice as big" just works.

**S4.** Events run exactly as in any X3D browser. This snowman was authored through the copilot and ships as an example: a TouchSensor starts a TimeSensor and an interpolator on the hat, so a click makes it hop, and every ROUTE in that chain is checked by the validators.

**S5.** Validation is the heart of the tool, in three layers: the official X3D 4.0 XML Schema running as libxml2 in WebAssembly, a semantic linter with about thirty rules the schema cannot express, and the X_ITE runtime. This deliberately broken scene shows eleven errors, each with a line number, a plain-language explanation and a suggested fix. And the copilot can only act through these same checks: it patches the scene, reads the report back, and repairs its own mistakes until the scene is valid and renders.

**S6.** X3D 4.0 rendering features are all there: PhysicalMaterial with metallic and roughness, unlit materials, shadows, texture projection, and shading modes from Phong to wireframe.

**S7.** Other formats become editable X3D: glTF, OBJ, STL, PLY and VRML are converted through X_ITE's own loaders and normalised to X3D 4.0. Export as X3D XML, Classic VRML, JSON, or a PNG.

**S8.** X3D Copilot is open source under the MIT license, a static site with no server, with fifty-six automated tests covering the schema validator, every linter rule and every example scene. It is live today at albertojaspe.net slash x3d-copilot. We believe it deserves consideration as Tool of the Year because it is a complete, usable X3D authoring environment with zero installation, and as Innovation of the Year because it is the first X3D tool where an AI is grounded in the ISO object model and closed-loop validated by schema, linter, runtime and its own eyes. Thank you.
