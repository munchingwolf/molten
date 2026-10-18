"use client"

import { useEffect } from "react"
import { useStudio } from "@/lib/studio-store"
import { useAssistant } from "@/lib/assistant-store"
import { findEntry } from "@/lib/registry"
import { applyLiveOp, type LiveOp, type LiveResult } from "@/lib/live-ops"
import type { Template } from "@/lib/guides"
import type { Layout } from "@/lib/layout"

const POLL_MS = 400

/**
 * Claude Code drives this Studio through the Spatial MCP (like Claude in Blender): it polls queued edits from
 * /api/live, applies them to the same store the hands and the Ollama assistant use, logs them in the assistant
 * panel, and reports the scene back to /api/live/scene so Claude can see what changed.
 */
export function LiveLink() {
  useEffect(() => {
    let seq: number | null = null
    let stop = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let posting: ReturnType<typeof setTimeout> | undefined
    let results: ({ seq: number } & LiveResult)[] = []

    const report = () => {
      const s = useStudio.getState()
      const body = {
        name: s.name,
        environment: s.environment ?? null,
        selectedId: s.selectedId,
        playMode: s.playMode,
        values: s.values,
        items: s.items.map(({ id, component, name, position, rotation, scale, parentId, bind, props }) => ({ id, component, name, position, rotation, scale, parentId, bind, props })),
        guide: s.guide ? { name: s.guide.name, slots: s.guide.slots.length, filled: Object.keys(s.guide.filled).length } : null,
        lastSeq: seq,
        results: results.slice(-50),
      }
      void fetch("/api/live/scene", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => {})
    }
    const reportSoon = () => {
      clearTimeout(posting)
      posting = setTimeout(report, 500) // drags change the store every frame
    }

    const ctx = {
      isReady: (name: string) => findEntry(name)?.status === "ready",
      template: async (slug: string) => {
        const all = (await fetch("/api/templates").then((r) => r.json()).catch(() => [])) as Template[]
        return all.find((t) => t.slug === slug || t.id === slug) ?? null
      },
      startGuide: (t: Template) => useStudio.getState().startGuide(t),
      insertAll: (t: Template) => useStudio.getState().insertAll(t),
      layout: (id: string) => fetch(`/api/layout/${id}`).then((r) => (r.ok ? (r.json() as Promise<Layout>) : null)).catch(() => null),
    }

    const tick = async () => {
      try {
        const res = await fetch(seq === null ? "/api/live" : `/api/live?after=${seq}`)
        const data = (await res.json()) as { seq: number; ops: { seq: number; op: LiveOp }[] }
        if (seq === null) seq = data.seq // start from now; never replay old edits
        else if (data.ops.length) {
          const lines: { label: string; ok: boolean }[] = []
          for (const { seq: n, op } of data.ops) {
            const r = await applyLiveOp(op, () => useStudio.getState(), ctx)
            results.push({ seq: n, ...r })
            lines.push({ label: r.message, ok: r.ok })
            seq = n
          }
          results = results.slice(-200)
          useAssistant.setState((s) => ({ messages: [...s.messages, { role: "assistant" as const, text: "Claude Code:", ops: lines, at: Date.now() }] }))
          report()
        }
      } catch {
        // dev server busy or restarting: try again next tick
      }
      if (!stop) timer = setTimeout(tick, POLL_MS)
    }

    void tick()
    report()
    const unsub = useStudio.subscribe(reportSoon)
    return () => {
      stop = true
      clearTimeout(timer)
      clearTimeout(posting)
      unsub()
    }
  }, [])
  return null
}
