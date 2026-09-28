# Demo video plan — AI & Web3D Innovation entry (3–5 min)

Recorded by `scripts/record-demo-ai.mjs` (needs GEMINI_API_KEY), narrated by `scripts/narrate.mjs --variant ai`,
assembled by `scripts/assemble-video.mjs --variant ai` (model-working stretches time-lapsed 4×).

| # | On screen | Budget |
|---|-----------|--------|
| 1 | Title card, then the app. | 0:18 |
| 2 | From one sentence to an elaborate scene: an art-deco lobby with columns, chequered floor, PBR materials, lights, animated viewpoint tour. Tool chips. | 0:40 + lapse |
| 3 | Recursive texture: "add a spinning chrome sphere reflecting the room" → GeneratedCubeMapTexture; orbit around it. | 0:30 + lapse |
| 4 | Events: "Click to animate" example; the copilot adds a spin to the click; the cone is clicked. | 0:30 + lapse |
| 5 | Broken scene repaired by the copilot. | 0:25 + lapse |
| 6 | Selection as context: click the earth, "make this twice as big…". | 0:22 + lapse |
| 7 | Architecture card. | 0:35 |
| 8 | Closing card. | 0:18 |

## Narration

**S1.** X3D Copilot is an AI co-author for X3D 4.0 scenes that runs entirely in the browser. It pairs a language model, Gemini or Claude, with something models usually lack: the standard itself, and a way to check their own work.

**S2.** Let's start from an empty file and one sentence: an art-deco lobby with a chequered floor, fluted columns, warm lights and a slow camera tour. Watch the tool steps. The model looks up nodes in the ISO specification database whenever it needs a field name, a default or where a node may be placed. It writes the scene, and the tool immediately validates it against the X3D 4.0 XML Schema, a semantic linter, and the X_ITE runtime. Any error goes straight back to the model, which fixes it, and finally it takes a screenshot to check the render before answering.

**S3.** Now something harder: a chrome sphere that reflects the room around it. That needs a GeneratedCubeMapTexture, a render-to-texture node that re-renders the scene into the sphere's own reflection every frame. The model reads its definition from the specification, wires it into a PhysicalMaterial, and validates. A recursive texture, in standard X3D 4.0, from one sentence.

**S4.** Events and interaction are first-class. This scene has a TouchSensor driving a bounce. We ask the copilot to add a full spin on click and change the sign, and then we click the cone. Sensors, interpolators and ROUTEs are all checked by the linter, so a mis-wired event never ships silently.

**S5.** Repair is the same loop in reverse. This scene has eleven planted errors: a misspelled profile, a Material outside its Appearance, a wrong field name, a bad ROUTE, an interpolator with mismatched keys, an undefined USE. The model reads the scene, patches it, and every patch returns the validation report. Eleven errors become zero, and it verifies the render.

**S6.** The model also shares the user's spatial context. Clicking geometry selects its Transform with an X3D-native gizmo, built from PlaneSensors and CylinderSensors injected at runtime. The selection travels with the next message, so "make this twice as big and give it a physically based material" resolves to exactly that node.

**S7.** Under the hood: a provider-neutral agent loop, seven tools, and a spec database compiled from the X3D Unified Object Model with two hundred and sixty nodes and every field's type, default and allowed children. The model can only act through tools, and every tool result is checked against the standard. Nothing leaves the browser except the model call, made with the user's own key. The same pattern, a machine-readable specification plus validators as tools plus a visual check, applies to glTF or USD as well.

**S8.** X3D Copilot is open source under the MIT license, with fifty-three automated tests, and live today at albertojaspe.net slash x3d-copilot. AI-generated 3D content that is conformant by construction. Thank you.
