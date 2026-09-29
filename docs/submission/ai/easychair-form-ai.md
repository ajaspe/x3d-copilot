# EasyChair form answers — AI & Web3D Innovation Competition (Web3D 2026)

Submit at https://easychair.org/my/conference?conf=web3d26 → AI & Web3D Innovation track. Deadline 30 Sept 2026.

**Title:** Closing the Loop: Spec-Grounded, Self-Verifying AI Authoring of X3D 4.0 Scenes in the Browser

**Keywords (one per line):**
X3D 4.0
Web3D
Large language models
AI-driven content generation
Tool use and agents
Standards conformance
XML Schema validation
X_ITE
Browser-based 3D authoring
Scene graph editing

**Abstract (short):** Large language models can draft X3D quickly, but left alone they invent fields, misplace nodes, break ROUTEs and never see what they produce. We present a browser-based prototype in which an LLM (Gemini or Claude) authors and edits X3D 4.0 scenes under continuous verification. The model is grounded in the ISO/IEC 19775-1 X3D Unified Object Model, compiled into a database it queries through a tool, and it can only change the scene through validated edits: every change is checked against the official X3D 4.0 XML Schema, a semantic linter derived from the object model, and the X_ITE runtime, and the report is fed back until the scene is valid. A screenshot tool lets the model inspect its own render. Users work alongside it with live rendering, an X3D-native transform gizmo whose selection becomes context for the model, and glTF/OBJ/STL import. The result is AI-generated 3D content that is standards-conformant by construction, delivered as an open-source static site.

**Category:** AI-Driven Content Generation (primary). Also relevant: Open Innovation.

**Team:** Alberto Jaspe-Villanueva (KAUST) — individual entry.

**Working prototype (URL):** https://albertojaspe.net/x3d-copilot/
(Bring your own Gemini or Claude API key in ⚙ Settings; nothing leaves the browser except the model API calls.)

**Source code:** https://github.com/ajaspe/x3d-copilot (public, MIT)

**Documentation:** attached `ai-documentation.pdf` (4 pages: abstract, feature overview with annotated UI, technical overview, architecture, AI models used, Web3D frameworks employed, evaluation criteria, innovation statement); README in the repository.

**Demo video (3–5 min):** <YouTube link — docs/submission/video/x3d-copilot-ai-demo.mp4>

**Innovation statement (≤500 words):** paste `innovation-statement.md`.

**AI models used:** Google Gemini 3.8 Flash (default), Gemini 3.1 Pro, Gemini 2.5 Pro/Flash; Anthropic Claude Opus 5 / Sonnet 5 / Haiku 4.5 — selectable; multimodal (vision) function calling.

**Web3D frameworks:** X3D 4.0 (ISO/IEC 19775-1) with the X_ITE 16 browser; X3D 4.0 XML Schema; X3D Unified Object Model 4.0; X3D XML / Classic VRML / JSON encodings; glTF, OBJ, STL, PLY import.

**Note on multiple submissions:** the same open-source tool is also entered in the Web3D/Metaverse Tools competition, where the focus is the editor/validator/converter functionality. This entry focuses on the AI architecture (spec grounding + closed-loop verification + visual self-check), which is the innovation being claimed here.
