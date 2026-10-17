// "How do I…?" answers for the Assistant panel. Local Ollama only (no paid API); keyword FAQ when it's down.
// Facts come from XR-INTERACTION.md, GESTURES.md, SPEC §42 and the MCP README. Keep HELP and FAQ in sync.

const OLLAMA = process.env.OLLAMA_URL ?? "http://localhost:11434"
const MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:7b"

const HELP = `SPATIAL STUDIO HELP (the only facts you may use)
- Add: in VR tap or pinch a row on the shelf floating to your left; it drops ~60 cm in front of you. On the laptop click a component in the Library (left). Or say/type "add a drum pad".
- Select: click, tap or grab a component. Escape deselects. Shift-click adds to the selection.
- Move: drag the bar under a component, or pinch near it and move your hand. Controller: grip. Laptop: drag the bar, gizmo arrows, arrow keys nudge 1 cm (Shift 10 cm), PageUp/PageDown move away/toward you.
- Scale: grab with BOTH hands and pull apart or push together (0.2x to 5x). Laptop: - and = keys, Alt + mouse wheel, or the gizmo balls. Or say "make it bigger".
- Turn (spin around the vertical axis only): two-hand grab and swing one hand forward, the other back, like a steering wheel. Laptop: [ and ] turn 15 degrees. Or say "rotate 45 degrees".
- Tilt (pitch or roll): select the item, then drag the gizmo's red quarter ring to tilt forward/back or the blue ring to roll sideways, with the mouse, a poke or ray + pinch. Hands and voice only turn; tilting is the gizmo rings.
- Snap is on: moves snap to 2.5 cm, turns to 15 degrees, scale to 0.05. Hold Shift while dragging to place freely. Components dropped onto a desk, stage or table land on its top.
- Delete: Delete/Backspace on the laptop, or say "remove the knob". Undo/redo: say "undo", or use the Undo chip.
- Frames: select several items and press Cmd+G to wrap them in a frame with auto-layout (row, column, grid or arc wall).
- X-ray mode: a view mode that shows the structure (frames, hidden items) through components; toggle it in the Studio toolbar.
- Scenes: an app can have several scenes (screens); add, rename and switch scenes in the Studio.
- Environments: studio loft, outer space, forest, concert stage, minimal gallery, or "your room" (AR passthrough). Say "take me to outer space".
- Wiring: in the Inspector (right) set "controls: <name>" so a knob or slider drives another component.
- Save / Launch: Save in the top bar stores the layout; Launch opens it as a real app at /apps/<id> you can open in the headset.
- Export / Claude Code: the code panel (bottom) shows the generated React Three Fiber code to copy, plus "Copy prompt for Claude". To bring a scene into Claude Code: Save it, install the Spatial MCP server once (claude mcp add spatial -- node mcp/server.mjs), then ask Claude Code to "rebuild my latest Spatial layout"; its get_layout and add_component tools fetch the layout and copy the components into your project.
- Voice: hold the mic button (push-to-talk), speak, release. A local model turns it into edits; only values you actually said are applied.
- Enter VR/AR: Enter AR or Enter VR in the top bar. On Quest, open the https tunnel URL in the Quest browser.`

const SYSTEM = `You are the Assistant inside Spatial Studio, a tool for building 3D/XR apps from components.
Answer the user's question in at most 3 short sentences, plain text, no lists or markdown.
Use ONLY the help below. If the help doesn't cover it, say you're not sure and suggest asking "What can I do?".

${HELP}`

/** Keyword answers for when Ollama is down. First match wins, so specific entries go first. */
const FAQ: [RegExp, string][] = [
  [/\b(tilt|pitch|roll|lean|angle)\b/, "Select it, then drag the gizmo's red ring to tilt it forward or back, or the blue ring to roll it sideways. That works with the mouse, a poke or ray + pinch."],
  [/\b(rotate|turn|spin|yaw)\b/, "Grab it with both hands and swing one hand forward and the other back, like a steering wheel. On the laptop press [ or ] to turn 15°, or say “rotate 45 degrees”."],
  [/\b(scale|bigger|smaller|size|resize|grow|shrink|stretch)\b/, "Grab it with both hands and pull apart to grow or push together to shrink. On the laptop use - and =, or Alt + mouse wheel. Or say “make it bigger”."],
  [/\b(move|drag|place|position|nudge|carry)\b/, "Pinch near the component (or drag the bar under it) and move your hand. On the laptop drag the bar or use the arrow keys (Shift for 10 cm)."],
  [/\b(snap|grid|align)\b/, "Snapping is on: moves snap to 2.5 cm and turns to 15°. Hold Shift while dragging to place freely."],
  [/\b(frame|group|auto ?layout|row|column|arc)\b/, "Select several items and press Cmd+G to wrap them in a frame. Frames lay their children out as a row, column, grid or arc wall."],
  [/\b(x ?-?ray|xray|see through|structure)\b/, "X-ray mode shows the structure (frames, hidden items) through your components. Toggle it in the Studio toolbar."],
  [/\b(scene|screen|page)s?\b/, "An app can have several scenes. Add, rename and switch scenes in the Studio; each keeps its own items and environment."],
  [/\b(environment|space|forest|stage|loft|gallery|passthrough|background|world)\b/, "Pick an environment: studio loft, outer space, forest, concert stage, minimal gallery or your room (AR). Say “take me to outer space”."],
  [/\b(launch|save|publish|share|run|play)\b/, "Press Save in the top bar to store the layout, or Launch to open it as a real app at /apps/<id>. Open that link in the headset to play it."],
  [/\b(mcp|claude|export|code|copy|project|tsx)\b/, "Save the scene, add the Spatial MCP server to Claude Code once (claude mcp add spatial -- node mcp/server.mjs), then ask it to rebuild your latest Spatial layout. Or copy the code from the code panel."],
  [/\b(voice|talk|speak|mic|microphone|say)\b/, "Hold the mic button, speak, and release. Only the values you actually say get applied, so “make the pad blue” changes just the colour."],
  [/\b(wire|bind|connect|control)\b/, "Select a component and, in the Inspector, set “controls: <name>”. Anything else bound to that name follows it."],
  [/\b(delete|remove|undo|redo|mistake)\b/, "Press Delete on the laptop or say “remove the knob”. Say “undo” or tap the Undo chip to take it back."],
  [/\b(add|insert|new|component|shelf|library)\b/, "In VR, tap a row on the shelf to your left. On the laptop, click a component in the Library. Or just say “add a drum pad”."],
  [/\b(vr|ar|headset|quest|enter)\b/, "Press Enter VR or Enter AR in the top bar. On a Quest, open the https tunnel URL in the Quest browser first."],
]
const GENERAL = "You can add components (“add a knob”), move, scale and turn them with your hands, change colours by voice, pick an environment, group items into frames, then Save and Launch a real app. Ask me how to do any of these."

function faq(text: string) {
  const t = text.toLowerCase()
  return FAQ.find(([re]) => re.test(t))?.[1] ?? GENERAL
}

/** Plain text, at most 3 sentences: small models pad answers with lists and extra advice. */
function clip(s: string) {
  const plain = s.replace(/[*_`#>]/g, "").replace(/^\s*[-•\d.]+\s+/gm, "").replace(/\s+/g, " ").trim()
  return (plain.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [plain]).slice(0, 3).join("").trim()
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { text?: unknown } | null
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 500) : ""
  if (!text) return Response.json({ error: "text is required" }, { status: 400 })
  if (/^what can i do\??$/i.test(text)) return Response.json({ answer: GENERAL, source: "faq" })

  try {
    const res = await fetch(`${OLLAMA}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: text }],
        options: { temperature: 0.2, num_predict: 140 },
      }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) throw new Error(`ollama ${res.status}`)
    const data = (await res.json()) as { message?: { content?: string } }
    const answer = clip(data.message?.content ?? "")
    if (!answer) throw new Error("empty answer")
    return Response.json({ answer, source: "ollama" })
  } catch {
    return Response.json({ answer: faq(text), source: "faq" })
  }
}
