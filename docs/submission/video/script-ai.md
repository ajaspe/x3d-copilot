# Demo video plan — AI & Web3D Innovation entry (3–5 min)

Recorded by `scripts/record-demo-ai.mjs` (needs GEMINI_API_KEY), narrated by `scripts/narrate.mjs --variant ai`,
assembled by `scripts/assemble-video.mjs --variant ai --timelapse 6` (model-working stretches time-lapsed).

| # | On screen | Budget |
|---|-----------|--------|
| 1 | Title card, then the app. | 0:18 |
| 2 | Start simple: "a red sphere on a blue tiled floor with a spotlight and a sky". Tool chips: lookup, replace, validate, screenshot. | 0:35 + lapse |
| 3 | Build up: "add three small cubes orbiting the sphere, each with a different PhysicalMaterial". | 0:25 + lapse |
| 4 | Recursive texture: "make the sphere a chrome mirror that reflects the scene" → GeneratedCubeMapTexture; orbit. | 0:30 + lapse |
| 5 | Events: "when the sphere is clicked, it jumps and flashes"; then the sphere is clicked three times. | 0:40 + lapse |
| 6 | Broken scene repaired by the copilot. | 0:25 + lapse |
| 7 | Selection as context: click the earth, "make this twice as big…". | 0:22 + lapse |
| 8 | Architecture card. | 0:35 |
| 9 | Closing card. | 0:18 |

## Narration

**S1.** X3D Copilot is an AI co-author for X3D 4.0 scenes that runs entirely in the browser. It pairs a language model, Gemini or Claude, with something models usually lack: the standard itself, and a way to check their own work.

**S2.** Let's start simple, from an empty file: a red sphere on a blue tiled floor, a spotlight and a sky. Watch the tool steps. The model looks up nodes in the ISO specification database whenever it needs a field name, a default or where a node may be placed. It writes the scene, and the tool validates it against the X3D 4.0 XML Schema, a semantic linter, and the X_ITE runtime. Any error goes straight back to the model, which fixes it, and finally it takes a screenshot to check the render before answering.

**S3.** Now we build on it. Three small cubes orbiting the sphere, each with a different physically based material. The model reads the current scene, adds Transforms, interpolators and ROUTEs with exact patches, and each patch is validated again.

**S4.** Something harder: make the sphere a chrome mirror that reflects the scene around it. That needs a GeneratedCubeMapTexture, a render-to-texture node that re-renders the scene into the sphere's own reflection every frame. The model reads its definition from the specification, wires it into a metallic PhysicalMaterial, and validates. A recursive texture, in standard X3D 4.0, from one sentence.

**S5.** Interaction is first-class. We ask for a click behaviour: when the sphere is clicked it should jump and flash. The model adds a TouchSensor, a TimeSensor and interpolators, and the linter checks every ROUTE, so a mis-wired event never ships silently. And now we click the sphere. Each click restarts the animation, exactly as any X3D browser would run it.

**S6.** Repair is the same loop in reverse. This scene has eleven planted errors: a misspelled profile, a Material outside its Appearance, a wrong field name, a bad ROUTE, an interpolator with mismatched keys, an undefined USE. The model reads the scene, patches it, and every patch returns the validation report. Eleven errors become zero, and it verifies the render.

**S7.** The model also shares the user's spatial context. Clicking geometry selects its Transform with an X3D-native gizmo, built from PlaneSensors and CylinderSensors injected at runtime. The selection travels with the next message, so "make this twice as big and give it a physically based material" resolves to exactly that node.

**S8.** Under the hood: a provider-neutral agent loop, seven tools, and a spec database compiled from the X3D Unified Object Model with two hundred and sixty nodes and every field's type, default and allowed children. The model can only act through tools, and every tool result is checked against the standard. Nothing leaves the browser except the model call, made with the user's own key. The same pattern, a machine-readable specification plus validators as tools plus a visual check, applies to glTF or USD as well.

**S9.** X3D Copilot is open source under the MIT license, with fifty-four automated tests, and live today at albertojaspe.net slash x3d-copilot. AI-generated 3D content that is conformant by construction. Thank you.
