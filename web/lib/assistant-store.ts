import { create } from "zustand"
import { applyOps, extractOps, type Op, type RegEntry, type Viewer } from "./assist-ops"
import { registry } from "./registry"
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
}

const QUESTION = /\?\s*$|^(how|what|why|where|when|which|who|can i|could i|do i|does|is there|is it|are there|help|explain|tell me)\b/i
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
    default: return `${o.op} ${name}`
  }
}

// Same payload as voice.tsx: every entry, so "the lamp" is recognised; assist-ops never adds a "soon" one.
const REGISTRY: RegEntry[] = registry.map((e) => ({
  name: e.name, displayName: e.displayName, aliases: e.aliases, category: e.category, style: e.style, status: e.status,
  props: (e as { props?: RegEntry["props"] }).props,
}))

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

  return {
    messages: [{ role: "assistant", text: "Hi! Ask me to change the scene (“add a knob”, “make it bigger and blue”) or ask how something works.", at: 0 }],
    status: "idle",
    setStatus: (status) => set({ status }),

    send: async (raw, viewer) => {
      const text = raw.trim().slice(0, 500)
      if (!text || get().status === "thinking") return
      say({ role: "user", text })

      // Undo/redo are store actions, not model ops (the op grammar deliberately ignores "undo").
      const h = HISTORY.exec(text)?.[1].toLowerCase() as "undo" | "redo" | undefined
      if (h) {
        const { past, future } = useStudio.getState()
        const ok = (h === "undo" ? past : future).length > 0
        useStudio.getState()[h]()
        say({ role: "assistant", text: ok ? "Done." : `Nothing to ${h}.`, ops: [{ label: h, ok }] })
        return
      }

      set({ status: "thinking" })
      try {
        if (QUESTION.test(text)) {
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
  }
})
