# Demo video plan — AI & Web3D Innovation entry (3–5 min)

Recorded by `scripts/record-demo-ai.mjs` (needs GEMINI_API_KEY), narrated by `scripts/narrate.mjs --variant ai`,
assembled by `scripts/assemble-video.mjs --variant ai --timelapse 8` (model-working stretches time-lapsed).

| # | On screen | Budget |
|---|-----------|--------|
| 1 | Title card, then the app. | 0:18 |
| 2 | From an empty file: "a tennis racket standing on a court, with a tennis ball bouncing next to it". Tool chips: lookup, replace, validate, screenshot. | 0:35 + lapse |
| 3 | Make it realistic: PBR materials (graphite frame, nylon strings, felt ball), a sun light with shadows on the ground, sky. | 0:30 + lapse |
| 4 | Events: "when the racket is clicked, the ball jumps three times higher"; the racket is clicked several times. | 0:40 + lapse |
| 5 | Broken scene repaired by the copilot. | 0:25 + lapse |
| 6 | Selection as context: click the earth, "make this twice as big…". | 0:22 + lapse |
| 7 | Architecture card. | 0:35 |
| 8 | Closing card. | 0:18 |

## Narration

**S1.** X3D Copilot is an AI co-author for X3D 4.0 scenes that runs entirely in the browser. It pairs a language model, Gemini or Claude, with something models usually lack: the standard itself, and a way to check their own work.

**S2.** We start from an empty file and one sentence: a tennis racket standing on a court, with a ball bouncing next to it. Watch the tool steps. The model looks up nodes in the ISO specification database whenever it needs a field name, a default or where a node may be placed. It builds the racket from primitives and an Extrusion, animates the ball with a TimeSensor and a PositionInterpolator, and the tool validates everything against the X3D 4.0 XML Schema, a semantic linter, and the X_ITE runtime. Any error goes straight back to the model, which fixes it, and it takes a screenshot to check the render before answering.

**S3.** Now we make it look real. Physically based materials: a graphite frame, nylon strings, yellow felt on the ball. A sun light that casts shadows on the court, and a proper sky. The model reads the current scene and changes only what is needed, with exact patches, each validated again. Standard X3D 4.0, nothing proprietary.

**S4.** Interaction comes next. We ask: when the racket is clicked, the ball should jump three times higher. The model adds a TouchSensor and a second animation path, and the linter checks every ROUTE, so a mis-wired event never ships silently. And now we click the racket. Each click fires the higher jump, exactly as any X3D browser would run it.

**S5.** Repair is the same loop in reverse. This scene has eleven planted errors: a misspelled profile, a Material outside its Appearance, a wrong field name, a bad ROUTE, an interpolator with mismatched keys, an undefined USE. The model reads the scene, patches it, and every patch returns the validation report. Eleven errors become zero, and it verifies the render.

**S6.** The model also shares the user's spatial context. Clicking geometry selects its Transform with an X3D-native gizmo, built from PlaneSensors and CylinderSensors injected at runtime. The selection travels with the next message, so "make this twice as big and give it a physically based material" resolves to exactly that node.

**S7.** Under the hood: a provider-neutral agent loop, seven tools, and a spec database compiled from the X3D Unified Object Model with two hundred and sixty nodes and every field's type, default and allowed children. The model can only act through tools, and every tool result is checked against the standard. Nothing leaves the browser except the model call, made with the user's own key. The same pattern, a machine-readable specification plus validators as tools plus a visual check, applies to glTF or USD as well.

**S8.** X3D Copilot is open source under the MIT license, with fifty-four automated tests, and live today at albertojaspe.net slash x3d-copilot. AI-generated 3D content that is conformant by construction. Thank you.
