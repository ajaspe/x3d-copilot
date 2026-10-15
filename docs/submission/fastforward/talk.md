# X3D Copilot, fast-forward talk (1 slide, about 2.5 minutes)

**AI & Web3D Innovation Competition, Web3D 2026, Doha.**
Slide: `x3d-copilot-fastforward-v2.pptx`. The first part (about 50 seconds) is spoken over the static slide. Then click the video and talk over it; it is muted and runs 105 seconds.

Pace: this script is 300 words, written for about 120 words per minute, so it is comfortable to say slowly. Short sentences on purpose: pause at every full stop.

Clip timeline (seconds): 0 still life, 10 typing the prompt, 18 snowman, 32 moon shadows, 39 hat click, 54 solar system, 70 dragging the earth, 82 PBR spheres, 95 broken scene repaired, 105 end.

---

## Part 1, slide only (about 50 s)

Hi everyone. I am Alberto, from KAUST. This is X3D Copilot.

So, what is it? It is a 3D editor that runs in your browser. Nothing to install. You see the scene, you see the X3D source, you can drag objects around, import and export.

And it has an AI co-author. You just tell it what you want, in plain words, and it builds the scene for you.

Now, we all know the problem with that. You ask a language model for a 3D scene, it writes something that looks fine, and then the browser shows nothing. Wrong field names, nodes in the wrong place, and the model never sees its own result.

So here is the trick. The AI cannot touch the file directly. It works through tools. First, it reads the X3D specification. Then it edits the scene. Then the standard checks the result: the official schema, a set of semantic rules, and the 3D runtime. If there is any error, it goes back to the AI, and the AI must fix it before it answers. Finally, it takes a screenshot and looks at what it made.

That is the loop. Let me show you.

## Part 2, click the video (105 s)

[0 s, still life] This still life was made from one sentence. Real materials, real shadows, valid X3D.

[10 s, typing] Here I just type: a snowman at night.

[18 s, snowman] The AI looks up the nodes, writes the scene, validates it, and there it is.

[32 s, shadows] Now I ask for shadows from the moon. Same loop, a few seconds.

[39 s, hat click] And: make the hat jump when I click it. It adds the sensor, the animation, the routes. All checked.

[54 s, solar system] It is still a real editor, of course. This solar system is a normal X3D file, animated, and the source is right there.

[70 s, dragging] You can grab the earth and move it. The gizmo is built with X3D sensors, and the source updates as you drag.

[82 s, materials] Physically based materials, metallic, roughness, everything in X3D 4.0.

[95 s, repair] And my favourite part. This scene has eleven errors. One request, and the AI repairs all of them. The validators are the referee.

## Closing (over the last seconds, or after the clip)

So why does this matter? Because generative 3D is only useful if the result is a standard file that everybody can open. Here, every scene that leaves the tool is valid X3D 4.0. Not by luck, by construction.

It is open source, it works with Gemini or Claude with your own key, and the link is on the slide. Scan it, type a sentence, and see what you get. Thank you.
