# Innovation Statement — X3D Copilot (AI & Web3D Innovation Competition, Web3D 2026)

**Category:** AI-Driven Content Generation (secondary fit: Open Innovation)
**Prototype:** https://albertojaspe.net/x3d-copilot/ · **Source:** https://github.com/ajaspe/x3d-copilot (MIT)

Large language models can write 3D scene descriptions, but in practice their X3D is unreliable: they invent field names, confuse X3D versions, misplace nodes, and never see what they produced. The usual answer is a bigger model or more prompt text. X3D Copilot takes a different route: **it grounds the model in the standard itself and closes the loop with verification the model cannot bypass.**

**What is new.**
1. *Spec-grounded generation.* The ISO/IEC 19775-1 X3D Unified Object Model is compiled into a queryable database (260 nodes, 78 abstract types, every field with type, access, default, accepted children, container field). The model reaches it through a `lookup_node`/`search_nodes` tool, so when it is unsure about `PhysicalMaterial.roughness` or where a `Coordinate` may go, it reads the specification instead of guessing.
2. *Closed-loop, multi-layer verification.* The model can only change the scene through tools (`edit_scene`, `replace_scene`), and every change returns a report from three independent validators: the official X3D 4.0 XML Schema (libxml2 in WebAssembly), a ~30-rule semantic linter derived from the object model (ROUTE integrity, placement, types, interpolators, DEF/USE), and the X_ITE runtime. The model repairs its own errors until the report is clean.
3. *The AI looks at its work.* A `screenshot` tool returns the rendered frame, so the model checks framing, lighting and visibility, catching mistakes no schema can express.
4. *Shared spatial context.* Users select objects in the 3D view with an X3D-native gizmo (built from PlaneSensor/CylinderSensor nodes injected at runtime); the selection is passed to the model, so "rotate *this* 45 degrees" resolves to an exact node.
5. *Model-agnostic, in-browser.* The agent loop is provider-neutral (Google Gemini and Anthropic Claude today, an adapter of ~150 lines each), runs entirely client-side with the user's key, and needs no server: the whole tool is a static site.

**Why it matters.** The result is AI-generated content that is *standards-conformant by construction*: every scene that leaves the tool passes the ISO schema and renders in a conformant browser. In our tests the model repairs a scene with eleven planted errors (bad profile, misplaced Material, wrong field names, mismatched interpolator keys, broken ROUTEs, undefined USE) in a single turn, and generates complete animated scenes (nested orbits, sensors, PBR materials) from one sentence, verifying them visually before answering.

**Impact and scalability.** The pattern (machine-readable spec + validators as tools + vision check) is not specific to X3D: the spec database is regenerated from the X3DUOM by a script, and the same architecture applies to glTF, USD or CityGML with a different schema and object model. For the Web3D community it lowers the entry barrier to X3D to a sentence in a chat box while *raising* conformance, which helps education, rapid prototyping and the long-term health of the standard. Everything is open source (MIT), covered by 53 automated tests, and deployed as a plain static site that anyone can host.

*(≈460 words)*
