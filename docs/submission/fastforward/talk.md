# Fast-forward talk (2 minutes, 1 slide)

**AI & Web3D Innovation Competition, Web3D 2026, Doha.**
Slide: `x3d-copilot-fastforward.pptx`. Start the embedded video (muted, 79 s) as you say the first sentence; it ends around the time you reach "Why does this matter". If the venue cannot play embedded video, play `highlight.mp4` from a player on the side, or just show the slide.

Pace: about 140 words per minute. The script below is 270 words.

---

Hello, I am Alberto Jaspe from KAUST, and this is X3D Copilot.

Everyone has tried asking a language model for a 3D scene. It writes something that looks right, and then the browser shows a blank screen. The model invents field names, misplaces nodes, and never sees its own output.

X3D Copilot closes that loop. [video: typing the prompt] You type one sentence: a snowman at night. The AI cannot write to the scene directly. It can only act through tools. It looks up the node it needs in the X3D 4.0 object model, all 260 nodes compiled from the specification. It applies a patch. And then the standard checks that patch, three times: the official XML Schema, running in your browser through WebAssembly; a semantic linter of thirty rules derived from the object model; and the X_ITE runtime that renders it. Any failure goes straight back to the model, and it repairs its own mistake before it ever answers you.

[video: snowman, details, shadows] Then you keep talking. Add details. Add moonlight shadows. Make the hat jump when I click it. Every step is validated, every step renders, and the model takes a screenshot to check what it actually did.

[video: broken scene repaired] Give it a scene with eleven planted errors, and it repairs all of them in one request, with the validators as its referee.

Why does this matter? Because generative 3D is only useful if the result conforms to the standard that everyone else can load. Here, conformance is not a hope, it is a construction.

It runs entirely in the browser, it is open source under MIT, and it works today with Gemini or Claude using your own key. Scan the code, type a sentence, and get a valid X3D 4.0 scene. Thank you.
