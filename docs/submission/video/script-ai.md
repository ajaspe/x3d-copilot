# Demo video plan — AI & Web3D Innovation entry (3–5 min)

Recorded by `scripts/record-demo-ai.mjs` (needs GEMINI_API_KEY), narrated by `scripts/narrate.mjs --variant ai`,
assembled by `scripts/assemble-video.mjs --variant ai --timelapse 8` (only the stretches where the model is working are time-lapsed).

| # | On screen | Budget |
|---|-----------|--------|
| 1 | Title card, then the app. | 0:18 |
| 2 | From an empty file: a tiny planet with a starry sky, a small house and a boy, in the spirit of The Little Prince. Tool chips. | 0:35 + lapse |
| 3 | "Add a Billboard sign that always faces the camera: Asteroid B-612." Orbit to show it turning. | 0:22 + lapse |
| 4 | "Give it a cartoon look" (cel shading through X3D shaders or flat colours with outlines). | 0:25 + lapse |
| 5 | Events: "when the door is clicked it opens"; the door is clicked several times, with time to see it swing. | 0:40 + lapse |
| 6 | Broken scene repaired by the copilot. | 0:25 + lapse |
| 7 | Selection as context: click the earth, "make this twice as big…". | 0:22 + lapse |
| 8 | Architecture card. | 0:35 |
| 9 | Closing card. | 0:12 |

## Narration

**S1.** X3D Copilot is an AI co-author for X3D 4.0 scenes that runs entirely in the browser. It pairs a language model, Gemini or Claude, with something models usually lack: the standard itself, and a way to check their own work.

**S2.** We start from an empty file and one sentence: a tiny planet floating in a field of stars, with a small house and a boy standing on it, in the spirit of The Little Prince. Watch the tool steps. The model looks up nodes in the ISO specification database whenever it needs a field name, a default or where a node may be placed. It writes the scene, and the tool validates it against the X3D 4.0 XML Schema, a semantic linter, and the X_ITE runtime. Any error goes straight back to the model, which fixes it, and it takes a screenshot to check the render before answering.

**S3.** Now we add a sign that always faces the camera, using an X3D Billboard node: Asteroid B-612. The model reads the current scene and adds only what is needed, with exact patches, each validated again. As we orbit, the sign keeps turning towards us.

**S4.** Let's change the style: a cartoon look. The model can reach for X3D's shader nodes, or for flat, vivid materials with dark outlines, and either way the result stays standard X3D 4.0 that the validators accept.

**S5.** Interaction comes last. We ask that clicking the door of the house opens it. The model adds a TouchSensor, a TimeSensor and an OrientationInterpolator on a hinge, and the linter checks every ROUTE, so a mis-wired event never ships silently. And now we click the door. It swings open, and clicking again closes it, exactly as any X3D browser would run it.

**S6.** Repair is the same loop in reverse. This scene has eleven planted errors: a misspelled profile, a Material outside its Appearance, a wrong field name, a bad ROUTE, an interpolator with mismatched keys, an undefined USE. The model reads the scene, patches it, and every patch returns the validation report. Eleven errors become zero, and it verifies the render.

**S7.** The model also shares the user's spatial context. Clicking geometry selects its Transform with an X3D-native gizmo, built from PlaneSensors and CylinderSensors injected at runtime. The selection travels with the next message, so "make this twice as big and give it a physically based material" resolves to exactly that node.

**S8.** Under the hood: a provider-neutral agent loop, seven tools, and a spec database compiled from the X3D Unified Object Model with two hundred and sixty nodes and every field's type, default and allowed children. The model can only act through tools, and every tool result is checked against the standard. Nothing leaves the browser except the model call, made with the user's own key. The same pattern, a machine-readable specification plus validators as tools plus a visual check, applies to glTF or USD as well.

**S9.** X3D Copilot is open source under the MIT license. AI-generated 3D content that is conformant by construction. Thank you.
