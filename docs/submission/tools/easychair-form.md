# EasyChair form answers — Web3D/Metaverse Tools Competition (Web3D 2026)

Submit at https://easychair.org/my/conference?conf=web3d26 → competition track. Deadline 30 Sept 2026.
Attach `x3d-copilot-tools-summary.pdf` (this folder, two columns, 2 pages) as the 1–2 page Abstract/Summary.

**Title (for the submission form):** A Standards-Checked X3D 4.0 Editor for the Browser with Direct Manipulation, Format Conversion and an AI Co-Author

**Keywords (one per line):**
X3D 4.0
Web3D
3D authoring tool
XML Schema validation
Semantic linting
X_ITE
glTF import
Direct manipulation
Browser-based editor
Open source

**Name of the X3D tool (new or improved existing):**
X3D Copilot (new tool)

**Type of tool:**
Editor + validator + converter (imports glTF/GLB, OBJ, STL, PLY, SVG, VRML, X3D JSON → X3D XML; exports X3D XML / Classic VRML / X3D JSON / PNG) with an integrated AI co-author.

**Domain categories:**
Education (learning X3D), content creation, research prototyping, standards conformance checking / QA of X3D assets.

**Abstract/Summary (1–2 pages):** attached PDF. Short version for the text box:

X3D Copilot is a web application for creating, validating and converting X3D scenes in the current version of the standard, X3D 4.0, with no installation. It provides a live X_ITE view, a source editor with autocompletion derived from the X3D specification, direct manipulation of objects through a gizmo that is itself built from X3D sensor nodes, import of glTF, OBJ, STL, PLY, SVG and VRML as editable X3D, and export to X3D XML, Classic VRML, JSON and PNG. Every change, whether typed, dragged or generated, is checked by three independent validators: the official X3D 4.0 XML Schema running in the browser through libxml2 compiled to WebAssembly, a semantic linter of about thirty rules derived from the X3D Unified Object Model, and the X_ITE runtime. An optional AI co-author works through the same validators, so scenes it writes or repairs conform to the standard. The tool is open source, covered by 56 automated tests, and deployed as a static site.

**What problem does this tool solve?**
Hand-written X3D fails silently (bad ROUTEs, misplaced nodes, wrong field names) and LLM-generated X3D invents fields and never sees its output. X3D Copilot gives authors — students, researchers, content creators — an editor where the standard itself (XSD + X3DUOM) plus the runtime check every edit, and where an AI assistant is forced through the same checks, turning natural-language requests into valid, rendered X3D 4.0.

**Note for the judges:** the live demo needs your own Gemini or Claude API key (⚙ Settings; a free Gemini key from aistudio.google.com/apikey is enough). The key stays in the browser. Editing, validation, gizmo and import/export work without a key.

**Is it open-source?**
Yes — MIT license. https://github.com/ajaspe/x3d-copilot (live: https://albertojaspe.net/x3d-copilot/)

**Video (max 5 minutes):**
https://youtu.be/hkA0HNPSj7Y   (placeholder until the Tools video is uploaded; the AI video is https://youtu.be/ll1CE0XaRjo)

**Category:** submit for both — Tool of the Year and Tool/Pipeline Innovation of the Year (the video's last section explains why for each).

**Virtual meeting/demo:** available on request (Doha time zone friendly).

**Attendance:** online.
