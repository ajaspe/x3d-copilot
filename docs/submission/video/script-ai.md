# Demo video plan — AI & Web3D Innovation entry (3–5 min)

Recorded by `scripts/record-demo-ai.mjs` (needs GEMINI_API_KEY), narrated by `scripts/narrate.mjs --variant ai`,
assembled by `scripts/assemble-video.mjs --variant ai --timelapse 8` (only the stretches where the model is working are time-lapsed).

| # | On screen | Budget |
|---|-----------|--------|
| 1 | Title card, then the app. | 0:18 |
| 2 | From an empty file: a snowman on snowy ground at night under stars. Tool chips. | 0:35 + lapse |
| 3 | Details: nose, eyes, buttons, arms, scarf, top hat. | 0:20 + lapse |
| 4 | "Make the moonlight cast shadows." | 0:22 + lapse |
| 5 | Events: clicking the snowman makes his hat jump; several clicks with time to see it. | 0:35 + lapse |
| 6 | Broken scene repaired by the copilot. | 0:25 + lapse |
| 7 | Selection as context: click the earth, "make this twice as big…". | 0:22 + lapse |
| 8 | Architecture card. | 0:35 |
| 9 | Closing card. | 0:12 |

## Narration

**S1.** X3D Copilot is an AI co-author for X3D 4.0 scenes that runs entirely in the browser. It pairs a language model, Gemini or Claude, with something models usually lack: the standard itself, and a way to check their own work.

**S2.** We start from an empty file and one sentence: a snowman on snowy ground at night, under a starry sky. Watch the tool steps. The model looks up nodes in the ISO specification database whenever it needs a field name, a default or where a node may be placed. It writes the scene, the tool validates it against the X3D 4.0 XML Schema, a semantic linter and the X_ITE runtime, any error goes straight back to the model, and it takes a screenshot to check the render before answering.

**S3.** Now we build on it: a carrot nose, coal eyes and buttons, stick arms, a scarf and a top hat. The model reads the current scene and adds only what is needed, with exact patches, each validated again.

**S4.** Now some atmosphere: we ask for the moonlight to cast shadows. The model turns the moon's DirectionalLight into a shadow caster and marks the snowman and the trees to cast shadows on the snow, all with standard X3D 4.0 lighting fields that the validators accept.

**S5.** Interaction comes last. We ask that clicking the snowman makes his hat do a small jump. The model adds a TouchSensor, a TimeSensor and a PositionInterpolator on the hat, and the linter checks every ROUTE, so a mis-wired event never ships silently. And now we click him: the hat hops and lands back, exactly as any X3D browser would run it.
**S6.** Repair is the same loop in reverse. This scene has eleven planted errors: a misspelled profile, a misplaced Material, a wrong field name, a bad ROUTE, mismatched interpolator keys, an undefined USE. The model patches them, every patch returns the validation report, eleven errors become zero, and it verifies the render.

**S7.** The model also shares the user's spatial context. Clicking geometry selects its Transform with an X3D-native gizmo, built from PlaneSensors and CylinderSensors injected at runtime. The selection travels with the next message, so "make this twice as big and give it a physically based material" resolves to exactly that node.

**S8.** Under the hood: a provider-neutral agent loop, seven tools, and a spec database compiled from the X3D Unified Object Model, with every node, field, default and allowed child. The model can only act through tools, and every tool result is checked against the standard. Nothing leaves the browser except the model call, made with the user's own key. The same pattern applies to glTF or USD as well.

**S9.** X3D Copilot is open source under the MIT license. AI-generated 3D content that is conformant by construction. Thank you.
