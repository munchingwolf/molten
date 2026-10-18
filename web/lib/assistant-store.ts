import { create } from "zustand"
import { stripName } from "./wake"
import { applyOps, extractOps, type Op, type RegEntry, type Viewer } from "./assist-ops"
import { liveFilled } from "./guides"
import { registry } from "./registry"
import { slotCommand } from "./slot-commands"
import { useStudio } from "./studio-store"

// Assistant panel state (desktop + VR). Edits go to /api/assist (H's voice route) and are applied with
// applyOps one op at a time so every op gets its own ✓/✗ line; questions go to /api/ask. See components/studio/ASSISTANT.md.

export type OpLine = { label: string; ok: boolean }
export type Message = { role: "user" | "assistant"; text: string; ops?: OpLine[]; at: number }
export type AssistantStatus = "idle" | "listening" | "thinking"

type AssistantState = {
  messages: Message[]
  status: AssistantStatus
  setStatus: (s: AssistantStatus) => void
  /** Pass `viewer` (head pose) in XR so "add"/"move left" are relative to where the user looks. */
  send: (text: string, viewer?: Viewer) => Promise<void>
  /** Push-to-talk (hold → record, release → /api/stt → send). The transcript lands in the conversation. */
  startTalking: () => Promise<void>
  stopTalking: (viewer?: Viewer) => void
}

// One mic at a time. `held` covers a release that comes before getUserMedia resolves.
const mic: { held: boolean; t0: number; rec?: MediaRecorder; viewer?: Viewer } = { held: false, t0: 0 }

const QUESTION = /^(how|what|why|where|when|which|who|can i|could i|do i|does|is there|is it|are there|help|explain|tell me)\b/i
const POLITE_EDIT = /^(please|(can|could|would|will) you)\b/i // "could you add a knob?" is an edit, not a question
const isQuestion = (t: string) => QUESTION.test(t) || (/\?\s*$/.test(t) && !POLITE_EDIT.test(t))
const HISTORY = /^(undo|redo)\b/i

/** One-line log label, computed before the op runs (a removed item has no name afterwards). */
function label(o: Op) {
  const name = useStudio.getState().items.find((i) => i.id === (o.target ?? useStudio.getState().selectedId))?.component ?? "selection"
  switch (o.op) {
    case "add_component": return `add_component ${o.component}`
    case "scale": return `scale ×${o.amount} ${name}`
    case "rotate": return `rotate ${o.amount}° ${name}`
    case "move": return `move ${o.direction} ${Math.round((o.amount ?? 0.1) * 100)} cm ${name}`
    case "set_prop": return `set ${o.prop} = ${String(o.value)} ${name}`
    case "swap_style": return `swap_style ${name} → ${o.component}`
    case "set_environment": return `environment ${String(o.value)}`
    case "go_scene": return `scene ${String(o.value)}`
    default: return `${o.op} ${name}`
  }
}

// Same payload as voice.tsx: every entry, so "the lamp" is recognised; assist-ops never adds a "soon" one.
const REGISTRY: RegEntry[] = registry.map((e) => ({
  name: e.name, displayName: e.displayName, aliases: e.aliases, category: e.category, style: e.style, status: e.status,
  props: (e as { props?: RegEntry["props"] }).props,
}))
const namesOf = (component: string) => {
  const e = REGISTRY.find((r) => r.name === component)
  return e ? [e.displayName, ...(e.aliases ?? [])] : []
}

/** What the server-side gate needs: the layout, the selection and the registry. */
function context(text: string) {
  const { items, selectedId } = useStudio.getState()
  return { text, layout: { items }, selectedId, registry: REGISTRY }
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  })
  if (!res.ok) throw new Error(`${url} ${res.status}`)
  return res.json() as Promise<T>
}

async function ask(text: string) {
  try {
    return (await post<{ answer?: string }>("/api/ask", { text })).answer || "I'm not sure. Try “What can I do?”"
  } catch {
    return "I can't reach the help service right now. Try “add a knob” or “make it bigger”."
  }
}

/** Edit ops for `text`: the server route (local model + word gating), else the same keyword grammar in the browser. */
async function editOps(text: string): Promise<Op[]> {
  const ctx = context(text)
  try {
    const { ops } = await post<{ ops?: Op[] }>("/api/assist", ctx)
    if (Array.isArray(ops)) return ops
  } catch {
    // route missing or Ollama down: fall through to the keyword grammar
  }
  return extractOps(text, { items: ctx.layout.items, selectedId: ctx.selectedId, registry: ctx.registry })
}

export const useAssistant = create<AssistantState>((set, get) => {
  const say = (m: Omit<Message, "at">) => set((s) => ({ messages: [...s.messages, { ...m, at: Date.now() }] }))
  const note = (text: string) => say({ role: "assistant", text })

  // Quest has no Web Speech API, so this is ElevenLabs via /api/stt only (voice.tsx keeps the browser fallback).
  const transcribe = async (audio: Blob, ms: number, viewer?: Viewer) => {
    if (ms < 350) return set({ status: "idle" }), note("Hold the button while you speak.")
    set({ status: "thinking" })
    let text = "", err = ""
    try {
      const res = await fetch("/api/stt", { method: "POST", headers: { "content-type": audio.type || "audio/webm" }, body: audio, signal: AbortSignal.timeout(20_000) })
      const data = (await res.json()) as { text?: string; error?: string }
      text = data.text?.trim() ?? ""
      if (!res.ok) err = res.status === 503 ? "Voice needs ELEVENLABS_API_KEY on the server. Type instead, or use the chips." : `Speech-to-text failed (${data.error ?? res.status}).`
    } catch {
      err = "Speech-to-text is unreachable right now."
    }
    set({ status: "idle" }) // send() ignores calls while "thinking"
    if (text) return get().send(text, viewer)
    note(err || "Didn't catch that. Hold and speak.")
  }

  return {
    messages: [{ role: "assistant", text: "Hi, I'm Stark. Start with my name: \"Stark, add a knob\", \"Stark, make it bigger and blue\", \"Stark, go to the next scene\". Or ask how something works.", at: 0 }],
    status: "idle",
    setStatus: (status) => set({ status }),

    send: async (raw, viewer) => {
      const shown = raw.trim().slice(0, 500)
      if (!shown || get().status === "thinking") return
      say({ role: "user", text: shown })
      // "Stark, add a knob": the name is how you address the assistant, not part of the command.
      const { said, rest: text } = stripName(shown)
      if (!text) return void say({ role: "assistant", text: said ? "Yes? Tell me what to build." : "Didn't catch that." })

      // Undo/redo are store actions, not model ops (the op grammar deliberately ignores "undo").
      const h = HISTORY.exec(text)?.[1].toLowerCase() as "undo" | "redo" | undefined
      if (h) {
        const { past, future } = useStudio.getState()
        const ok = (h === "undo" ? past : future).length > 0
        useStudio.getState()[h]()
        say({ role: "assistant", text: ok ? "Done." : `Nothing to ${h}.`, ops: [{ label: h, ok }] })
        return
      }

      // With a template open, "add the drums" / "next" / "fill the rest" fill its slots exactly like a drag (snapped, wired).
      const { guide, items } = useStudio.getState()
      const fill = guide && slotCommand(text, guide.slots, liveFilled(guide.filled, items), namesOf)
      if (fill) {
        const ops = fill.slotIds.map((id) => ({ label: `place ${guide.slots.find((s) => s.id === id)?.name ?? id}`, ok: !!useStudio.getState().placeSlot(id) }))
        say({ role: "assistant", text: ops.every((o) => o.ok) ? fill.reply : "Couldn't place that. Is the template still open?", ops })
        return
      }

      set({ status: "thinking" })
      try {
        if (isQuestion(text)) {
          say({ role: "assistant", text: await ask(text) })
          return
        }
        const ops = await editOps(text)
        if (!ops.length) {
          // Not an edit we can corroborate from the words: answer it as a question instead of guessing.
          say({ role: "assistant", text: await ask(text) })
          return
        }
        const lines = ops.map((op) => {
          const l = label(op)
          return { label: l, ok: applyOps([op], useStudio.getState, viewer) > 0 }
        })
        const done = lines.filter((l) => l.ok).length
        say({
          role: "assistant",
          text: done === lines.length ? "Done." : done ? `Did ${done} of ${lines.length}.` : "Couldn't do that. Select an item first?",
          ops: lines,
        })
      } finally {
        set({ status: "idle" })
      }
    },

    startTalking: async () => {
      if (mic.held || get().status !== "idle") return
      Object.assign(mic, { held: true, t0: Date.now(), rec: undefined, viewer: undefined })
      set({ status: "listening" })
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const release = () => stream.getTracks().forEach((t) => t.stop()) // turns off the mic indicator
        if (!mic.held) return release(), set({ status: "idle" }) // let go before the mic opened
        const rec = new MediaRecorder(stream)
        const chunks: Blob[] = []
        rec.ondataavailable = (e) => void (e.data.size && chunks.push(e.data))
        rec.onstop = () => (release(), void transcribe(new Blob(chunks, { type: rec.mimeType }), Date.now() - mic.t0, mic.viewer))
        rec.start()
        mic.rec = rec
      } catch (e) {
        mic.held = false
        set({ status: "idle" })
        note((e as Error).name === "NotAllowedError" ? "Microphone blocked. Allow it for this site, then hold again." : "No microphone available here.")
      }
    },
    stopTalking: (viewer) => {
      mic.held = false
      mic.viewer = viewer
      mic.rec?.stop()
      mic.rec = undefined
    },
  }
})
