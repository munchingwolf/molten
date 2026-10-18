"use client"

import { Mascot2D, useAssistantMood } from "./mascot-2d"

import { useEffect, useRef, useState } from "react"
import { useAssistant } from "@/lib/assistant-store"
import { VoiceButton } from "./voice"

const STATUS = { idle: "ready", listening: "listening…", thinking: "thinking…" } as const

/** Laptop Assistant: a terminal-style chat that edits the scene ("add a knob") or answers "how do I…?". Fills its parent. */
export function AssistantPanel() {
  const messages = useAssistant((s) => s.messages)
  const status = useAssistant((s) => s.status)
  const send = useAssistant((s) => s.send)
  const [draft, setDraft] = useState("")
  const log = useRef<HTMLDivElement>(null)

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight })
  }, [messages, status])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.trim() || status === "thinking") return
    void send(draft)
    setDraft("")
  }

  return (
    <section aria-label="Stark, your assistant" className="flex h-full min-h-0 flex-col bg-bg font-mono text-sm text-text">
      <Mascot2D mood={useAssistantMood()} size={32} />
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="flex items-center gap-2 font-medium">
          <span aria-hidden className={`size-2 rounded-full ${status === "idle" ? "bg-faint" : "animate-pulse bg-accent"}`} />
          Stark
        </span>
        <span className="text-muted">{STATUS[status]}</span>
      </header>

      <div ref={log} role="log" aria-live="polite" className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 leading-relaxed">
        {messages.map((m, i) => (
          <div key={i}>
            {m.role === "user" ? (
              <p className="text-text"><span aria-hidden className="text-accent">&gt; </span>{m.text}</p>
            ) : (
              <>
                {m.ops?.map((o, k) => (
                  <p key={k} className="text-muted">
                    <span aria-hidden className={o.ok ? "text-accent" : "text-red-400"}>● </span>
                    {o.label} <span className={o.ok ? "text-accent" : "text-red-400"}>{o.ok ? "✓" : "✗"}</span>
                    <span className="sr-only">{o.ok ? "done" : "failed"}</span>
                  </p>
                ))}
                <p className="text-muted">{m.text}</p>
              </>
            )}
          </div>
        ))}
        {status === "thinking" && <p className="animate-pulse text-faint">● thinking…</p>}
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t border-border p-2">
        <input
          aria-label="Ask or tell the assistant"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Stark, add a drum pad · how do I tilt?"
          maxLength={500}
          className="h-11 min-w-0 flex-1 rounded-md border border-border-2 bg-surface px-3 text-sm placeholder:text-faint focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim() || status === "thinking"}
          className="h-11 rounded-md bg-accent px-4 text-sm font-medium text-on-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </form>
      {/* shortcut: voice.tsx runs its own pipeline, so spoken commands don't show in this log yet (see ASSISTANT.md). */}
      <div className="border-t border-border px-2 py-2">
        <VoiceButton />
      </div>
    </section>
  )
}
