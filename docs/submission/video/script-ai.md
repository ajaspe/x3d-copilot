# Demo video plan — AI & Web3D Innovation entry (3–5 min; target 4:00)

Recorded by `scripts/record-demo-ai.mjs` (needs GEMINI_API_KEY), narrated by `scripts/narrate.mjs --variant ai`,
assembled by `scripts/assemble-video.mjs --variant ai`.

| # | On screen | Budget |
|---|-----------|--------|
| 1 | Title card, then the app (hello scene). | 0:20 |
| 2 | From one sentence to a full animated scene: prompt typed, tool chips (lookup, replace, validate, screenshot), scene appears, orbit. | 1:05 |
| 3 | The broken scene: 11 errors; the copilot repairs them; issue count drops to zero; render. | 0:55 |
| 4 | Selection as context: click the earth, "make this twice as big and give it a physically based material". | 0:45 |
| 5 | Architecture card (diagram) while the narration explains the loop. | 0:35 |
| 6 | Closing card. | 0:20 |

## Narration

**S1.** X3D Copilot is an AI co-author for X3D 4.0 scenes that runs entirely in the browser. It pairs a language model, Gemini or Claude, with something models usually lack: the standard itself, and a way to check their own work.

**S2.** Let's start from nothing. One sentence: a small solar system with nested orbits, warm lighting and a dark sky. Watch the tool steps. The model looks up nodes in the ISO specification database when it needs a field name or a default. It writes the scene, and the tool immediately validates it against the X3D 4.0 XML Schema, a semantic linter, and the X_ITE runtime. If anything is wrong, the report goes straight back to the model, which fixes it. Finally it takes a screenshot and checks the render before answering. The result is a complete, animated, standards-conformant scene.

**S3.** Repair is the same loop in reverse. This scene has eleven planted errors: a misspelled profile, a Material outside its Appearance, a wrong field name, a bad ROUTE, an interpolator with mismatched keys, an undefined USE. The model reads the scene, applies exact patches, and every patch returns the validation report. Eleven errors become zero, and it verifies the render.

**S4.** The model also shares the user's spatial context. Clicking geometry selects its Transform with an X3D-native gizmo, built from PlaneSensors and CylinderSensors injected at runtime. The selection travels with the next message, so "make this twice as big and give it a physically based material" resolves to exactly that node.

**S5.** Under the hood: a provider-neutral agent loop, seven tools, and a spec database compiled from the X3D Unified Object Model, with two hundred and sixty nodes and every field's type, default and allowed children. The model can only act through tools, and every tool result is checked against the standard. Nothing leaves the browser except the model call, made with the user's own key. The same pattern, a machine-readable specification plus validators as tools plus a visual check, applies to glTF or USD as well.

**S6.** X3D Copilot is open source under the MIT license, with fifty-three automated tests, and live today at albertojaspe.net slash x3d-copilot. AI-generated 3D content that is conformant by construction. Thank you.
