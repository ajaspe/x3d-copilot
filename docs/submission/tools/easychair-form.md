# EasyChair form answers — Web3D/Metaverse Tools Competition (Web3D 2026)

Submit at https://easychair.org/my/conference?conf=web3d26 → competition track. Deadline 30 Sept 2026.
Attach `summary.pdf` (this folder) as the 1–2 page Abstract/Summary.

**Name of the X3D tool (new or improved existing):**
X3D Copilot (new tool)

**Type of tool:**
Editor + validator + converter (imports glTF/GLB, OBJ, STL, PLY, SVG, VRML, X3D JSON → X3D XML; exports X3D XML / Classic VRML / X3D JSON / PNG) with an integrated AI co-author.

**Domain categories:**
Education (learning X3D), content creation, research prototyping, standards conformance checking / QA of X3D assets.

**Abstract/Summary (1–2 pages):** attached PDF. Short version for the text box:

X3D Copilot is a zero-install, browser-based X3D 4.0 editor in which every change — typed, AI-generated or dragged with a gizmo — is validated against the official x3d-4.0.xsd (libxml2 in WebAssembly), a ~30-rule semantic linter derived from the X3D Unified Object Model, and the X_ITE runtime. An AI co-author (Gemini or Claude, called from the browser with the user's key) can act only through tools: read/patch/replace the scene, validate, look up nodes in the ISO spec database, and take screenshots — so it repairs its own errors and checks the visual result. Objects are selectable in the view with an X3D-native transform gizmo built from PlaneSensor/CylinderSensor nodes, synchronised two-way with the source. Common 3D formats import as editable X3D. Open source (MIT), 56 automated tests, CI; hosted at albertojaspe.net.

**What problem does this tool solve?**
Hand-written X3D fails silently (bad ROUTEs, misplaced nodes, wrong field names) and LLM-generated X3D invents fields and never sees its output. X3D Copilot gives authors — students, researchers, content creators — an editor where the standard itself (XSD + X3DUOM) plus the runtime check every edit, and where an AI assistant is forced through the same checks, turning natural-language requests into valid, rendered X3D 4.0.

**Note for the judges:** the live demo needs your own Gemini or Claude API key (⚙ Settings; a free Gemini key from aistudio.google.com/apikey is enough). The key stays in the browser. Editing, validation, gizmo and import/export work without a key.

**Is it open-source?**
Yes — MIT license. https://github.com/ajaspe/x3d-copilot (live: https://albertojaspe.net/x3d-copilot/)

**Video (max 5 minutes):**
<YouTube/Vimeo link — see docs/submission/video/>

**Category:** submit for both — Tool of the Year and Tool/Pipeline Innovation of the Year (the video's last section explains why for each).

**Virtual meeting/demo:** available on request (Doha time zone friendly).

**Attendance:** online.
