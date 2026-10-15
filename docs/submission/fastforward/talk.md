# X3D Copilot, fast-forward talk (1 slide, about 2.5 minutes)

**AI & Web3D Innovation Competition, Web3D 2026, Doha.**
Slide: `x3d-copilot-fastforward-v2.pptx`. The first part (about 50 seconds) is spoken over the static slide. Then click the video and talk over it; it is muted and runs 105 seconds.

Pace: the spoken part is about 330 words, written for 120 to 130 words per minute, so it is comfortable to say slowly. Short sentences on purpose: pause at every full stop.

Clip timeline (seconds): 0 still life, 10 typing the prompt, 18 snowman, 32 moon shadows, 39 hat click, 54 solar system, 70 dragging the earth, 82 PBR spheres, 95 broken scene repaired, 105 end.

---

## Part 1, slide only (about 50 s)

Good afternoon. I am Alberto Jaspe, from KAUST, and this is X3D Copilot.

X3D Copilot is a 3D editor that runs in the browser, with nothing to install. It shows the scene and the X3D source side by side. You can edit the source, drag objects with a gizmo, import glTF or VRML, and export X3D.

It also has an AI co-author. You describe what you want in plain words, and it builds or modifies the scene.

The problem with that idea is well known. A language model writes X3D that looks correct, and the browser shows nothing. Wrong field names, nodes in the wrong place, and the model never sees its own result.

X3D Copilot solves this with a closed loop. The AI cannot touch the file directly; it works only through tools. First, it reads the X3D specification, the Unified Object Model that this community publishes. Then it edits the scene. Then the standard checks the result: the official X3D 4.0 schema, running in the browser, a set of semantic rules, and X_ITE as the runtime. If there is any error, the report goes back to the AI, and it must fix the error before it answers. Finally, it takes a screenshot and checks what it made.

That is the loop. Let me show you.

## Part 2, click the video (105 s)

[0 s, still life] This still life was created from one sentence: physically based materials, shadows, and valid X3D 4.0.

[10 s, typing] Here I type a request: a snowman at night.

[18 s, snowman] The AI looks up the nodes, writes the scene, validates it, and the result renders.

[32 s, shadows] Now I ask for shadows from the moon. Same loop, a few seconds.

[39 s, hat click] Then: make the hat jump when I click it. It adds the TouchSensor, the TimeSensor, the interpolator and the ROUTEs. All of them checked.

[54 s, solar system] It remains a complete editor. This solar system is an ordinary X3D file, animated, and the source is always in sync.

[70 s, dragging] You can select the earth and move it. The gizmo is built from X3D sensor nodes, and the source updates as you drag.

[82 s, materials] Physically based materials, metallic and roughness, and the rest of the X3D 4.0 rendering features.

[95 s, repair] Finally, a scene with eleven errors. One request, and the AI repairs all of them, with the validators as the referee.

## Closing (over the last seconds, or after the clip)

Why does this matter? Generative 3D is only useful if the result is a standard file that everyone can open. Here, every scene that leaves the tool is valid X3D 4.0, by construction.

It is open source, it works with Gemini or Claude using your own key, and the link is on the slide. Thank you.

---

## Audience note

The X3D Working Group will be in the room: people who wrote the specification, the X3DUOM and the schema, and very likely Holger Seelig, the author of X_ITE. Three habits for the talk and the questions:

- Credit them. The tool is built on their artefacts: X3DUOM, x3d-4.0.xsd, X_ITE. Say it once in the talk (done in Part 1) and again when relevant in the answers.
- Use their words: node, field, accessType, containerField, ROUTE, DEF/USE, profile, component. Do not say "tag" or "property".
- Be precise about what is validated and what is not. They will know the difference between well-formed, schema-valid and semantically correct. Over-claiming costs more than admitting a limit.

## Likely questions and quick answers

**How does the AI know X3D? Is the spec in the prompt?**
No. A build script compiles the X3DUOM 4.0 XML into a JSON database: 260 concrete nodes, 78 abstract types, 17 statements, with every field's type, accessType, default, range and acceptable child types. The AI reads it through two tools, lookup_node and search_nodes. The same database drives the autocompletion and the linter.

**Which validation exactly?**
Three layers, all in the browser. One, well-formedness plus the official x3d-4.0.xsd and its extension schemas, run by libxml2 compiled to WebAssembly. Two, a semantic linter of about thirty rules the schema cannot express: node placement by containerField, DEF/USE integrity, ROUTE source and destination fields, access types and type match, attribute arity and ranges, SFNode multiplicity, interpolator key/keyValue consistency, missing Viewpoint, nodes the runtime does not implement. Three, X_ITE loading the scene, with its errors and warnings captured.

**Why a linter if you already have the schema?**
The XSD validates structure and attribute syntax. It cannot know that a ROUTE points to a field that does not exist, that the source is inputOnly, that an SFColor has only two numbers, or that a key array is shorter than keyValue. The linter is where the X3DUOM earns its keep.

**What about PROTO, ExternProto and Script nodes?**
They pass through. A ProtoInstance is accepted wherever a node is accepted, and Script nodes with their own field declarations are allowed. The linter does not check proto bodies or script code semantically; X_ITE does at load time. That is a known gap and the next linter rule set.

**How much does the AI get wrong, and how often does the loop run?**
No formal benchmark yet, and I say so. In practice, a new scene takes one to three validation rounds; the eleven-error example is repaired in one request. The loop is capped at 24 tool calls per request and two screenshots, then it stops and reports. Measuring repair rates across models is the next piece of work.

**Which models? Can I use a local model?**
Gemini and Claude today, through two adapters of about 150 lines each behind one interface. Any model with tool calling can be added the same way. A local model through an OpenAI-compatible endpoint is possible but not done; small models struggle with the tool discipline.

**What does a request cost?**
With Gemini Flash, cents. The snowman request was roughly a hundred thousand input tokens, a third of them cached, and fifteen thousand output. Patches instead of full rewrites keep it down, and old tool results are compacted after each turn.

**Is the key safe? Does anything go through your server?**
There is no server. The site is static files. The key stays in the browser's local storage and calls go directly to Google or Anthropic. An optional proxy URL exists for institutions that want to hold the key centrally.

**Why X_ITE and not X3DOM?**
X3D 4.0 coverage: PhysicalMaterial, shadows, texture projection, HAnim 2.0, plus loaders for glTF, OBJ, STL, PLY and VRML, delivered as an ES module and actively maintained. Credit to Holger here. The viewer is a plug-in point; nothing in the validators depends on it.

**Does the gizmo end up in my file?**
No. The gizmo is built from PlaneSensor, CylinderSensor and ProximitySensor nodes injected at runtime into X_ITE's scene graph. The source in the editor is never touched by it; only the Transform values you change are written back, as minimal attribute edits.

**X_ITE writes 4.1 on export. What do you do?**
A normaliser rewrites the version to 4.0 and drops attributes that are not in the 4.0 object model, listing them as warnings. When 4.1 is published, swapping the X3DUOM and the schema regenerates everything.

**X3D JSON, Classic VRML, glTF?**
Import: X3D XML and JSON, Classic VRML, glTF and GLB, OBJ, STL, PLY, SVG, through X_ITE's loaders, then normalised to X3D 4.0 XML. Export: X3D XML, Classic VRML, X3D JSON, PNG. glTF export is not there yet.

**HAnim?**
Renders and validates like any other node set; one shipped example is an HAnim 2.0 character. There is no dedicated rigging tool yet; it is the planned next feature, as a new AI tool plugged into the same loop.

**Large scenes?**
Edits are text patches, so the model never resends the file. Validation runs in tens of milliseconds on typical scenes. I have not tested scenes of tens of thousands of lines; the limit is the model's context, not the validators.

**Tests?**
56 automated tests: schema fixtures, one per linter rule, the patch tool, the source map and gizmo maths, the normaliser, and a check that every shipped example is clean while the broken one triggers exactly its nine rules. CI runs on every push.

**Is this not just a wrapper around an LLM?**
The model is replaceable; the contribution is the loop around it. The AI is grounded in the Consortium's own object model, closed-loop validated by schema, linter and runtime, and checks its own render. Plus a full X3D 4.0 editor whose gizmo is itself X3D, all with no installation.

**License and the spec artefacts?**
MIT for the code. X3DUOM and the schema are redistributed as published by the Web3D Consortium, with attribution, under their terms.

**What is next?**
HAnim authoring, glTF export, a benchmark of repair rates per model, and exposing the validators as an MCP server so other tools and agents can use the same checks.
