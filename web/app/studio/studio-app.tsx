"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { generateCode } from "@/lib/codegen"
import { registry, matches, type Entry } from "@/lib/registry"
import { useStudio } from "@/lib/studio-store"
import { bindablesOf } from "@/components/studio/layout-renderer"
import { StudioScene, dropAt, previewDrop, seatOnFloor } from "@/components/studio/scene"
import { propsOf } from "@/components/studio/prop-controls"
import type { Item } from "@/lib/layout"
import { EnterXRButtons } from "@/components/studio/xr-controls"
import { AssistantPanel } from "@/components/studio/assistant-panel"
import { VoiceButton } from "@/components/studio/voice"
import { useGestureKeys } from "@/components/studio/use-gesture-keys"
import { ImportModelButton } from "@/components/studio/import-model"

export function StudioApp() {
  useGestureKeys()

  // /studio?layout=latest (or an id): open a saved layout, e.g. on the Quest after building on the laptop.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("layout")
    if (!id) return
    fetch(`/api/layout/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((l) => l && useStudio.getState().load(l))
      .catch(() => {})
  }, [])

  // Figma-style keys. Typing in a field is left alone; Escape leaves the field so the keys work again.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest("input, textarea, select, [contenteditable=true]")) {
        if (e.key === "Escape") el.blur()
        return
      }
      const s = useStudio.getState()
      const mod = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      if (mod && k === "z") (e.shiftKey ? s.redo() : s.undo())
      else if (mod && k === "y") s.redo()
      else if (mod && k === "d") s.duplicate()
      else if (mod && k === "c" && s.selectedIds.length && !window.getSelection()?.toString()) s.copy()
      else if (mod && k === "v") s.paste()
      else if (!mod && (e.key === "Delete" || e.key === "Backspace")) s.removeSelected()
      else if (!mod && e.key === "Escape") s.select(null)
      else return
      e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    // fixed + z-50: the Studio is a full-screen tool and covers the site header from the root layout.
    <div className="fixed inset-0 z-50 grid grid-cols-[260px_1fr_300px] grid-rows-[56px_1fr_220px] bg-bg text-text">
      <TopBar />
      <Library />
      <main className="relative min-h-0 bg-stage">
        <StudioScene />
        <EmptyHint />
        <div className="absolute right-3 top-3 bottom-3 w-[340px] overflow-hidden rounded-lg border border-border">
          <AssistantPanel />
        </div>
      </main>
      <Inspector />
      <CodePanel />
    </div>
  )
}

type Template = { id: string; name: string; environment?: string; items: import("@/lib/layout").Item[] }

/** Start from a template: inserted next to your work as one undo step (never wipes the scene). */
function TemplatePicker() {
  const [templates, setTemplates] = useState<Template[]>([])
  useEffect(() => {
    fetch("/api/templates").then((r) => r.json()).then(setTemplates).catch(() => {})
  }, [])
  if (!templates.length) return null
  return (
    <select
      aria-label="Templates"
      value=""
      onChange={(e) => {
        const t = templates.find((x) => x.id === e.target.value)
        if (!t) return
        const s = useStudio.getState()
        s.insert(t.items)
        if (t.environment && !s.environment) s.setEnvironment(t.environment)
      }}
      className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
    >
      <option value="">Templates…</option>
      {templates.map((t) => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>
  )
}

/** Pick the world you build in; "None" = dark studio on the laptop / your real room in AR. */
function EnvironmentPicker() {
  const environment = useStudio((s) => s.environment)
  const setEnvironment = useStudio((s) => s.setEnvironment)
  const envs = registry.filter((e) => e.category === "environments" && e.status === "ready")
  return (
    <select
      aria-label="Environment"
      value={environment ?? ""}
      onChange={(e) => setEnvironment(e.target.value || null)}
      className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
    >
      <option value="">No landscape</option>
      {envs.map((e) => (
        <option key={e.name} value={e.name}>{e.displayName}</option>
      ))}
    </select>
  )
}

function TopBar() {
  const [status, setStatus] = useState("")
  const save = async (launch: boolean) => {
    // Open the tab synchronously so the popup blocker allows it, then point it at the saved app.
    const tab = launch ? window.open("about:blank", "_blank") : null
    setStatus("Saving…")
    try {
      const res = await fetch("/api/layout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(useStudio.getState().layout()),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const { id } = (await res.json()) as { id: string }
      setStatus(`Saved · ${id}`)
      if (tab) tab.location.href = `/apps/${id}`
    } catch (e) {
      tab?.close()
      setStatus(`Save failed (${(e as Error).message})`)
    }
  }
  const name = useStudio((s) => s.name)
  const setName = useStudio((s) => s.setName)
  const empty = useStudio((s) => s.items.length === 0)
  return (
    <header className="col-span-3 flex items-center gap-4 border-b border-border bg-surface px-4">
      <Link href="/" className="font-display text-lg font-extrabold tracking-tight">Spatial</Link>
      <span className="text-sm text-muted">Studio</span>
      <input
        aria-label="Scene name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-48 rounded-md border border-border bg-bg px-2 py-1 text-sm"
      />
      <History />
      <span className="ml-auto font-mono text-xs text-muted" aria-live="polite">{status}</span>
      <TemplatePicker />
      <EnvironmentPicker />
      <ImportModelButton />
      <VoiceButton />
      <PlayToggle />
      <EnterXRButtons />
      <button onClick={() => save(false)} className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium">
        Save
      </button>
      <button
        onClick={() => save(true)}
        disabled={empty}
        title={empty ? "Add a component first" : "Open the finished app"}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-on-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        Launch
      </button>
    </header>
  )
}

// Furniture and room pieces land on the floor; UI floats at working height.
const ON_FLOOR = new Set(["objects", "room", "hardware", "spaces"])

function Library() {
  const [query, setQuery] = useState("")
  const add = useStudio((s) => s.add)
  const [ghost, setGhost] = useState<{ label: string; x: number; y: number; over: boolean } | null>(null)
  const dragged = useRef(false)
  const groups = useMemo(() => {
    const g = new Map<string, Entry[]>()
    for (const e of registry.filter((e) => e.category !== "environments" && matches(e, query)))
      g.set(e.category, [...(g.get(e.category) ?? []), e])
    // Ready components first within the list; categories with something ready first.
    return [...g].sort(([, a], [, b]) => +b.some((e) => e.status === "ready") - +a.some((e) => e.status === "ready"))
  }, [query])

  // Press a row and drag it onto the canvas: a label follows the cursor, a ring shows where it lands, release places it
  // facing you. A plain click still adds it at the next free spot.
  const startDrag = (ev: React.PointerEvent, entry: Entry) => {
    if (ev.button !== 0 || entry.status !== "ready") return
    dragged.current = false
    const x0 = ev.clientX
    const y0 = ev.clientY
    const floor = ON_FLOOR.has(entry.category)
    const move = (e: PointerEvent) => {
      if (!dragged.current && Math.hypot(e.clientX - x0, e.clientY - y0) < 6) return
      dragged.current = true
      setGhost({ label: entry.displayName, x: e.clientX, y: e.clientY, over: previewDrop(e.clientX, e.clientY, floor) })
    }
    const up = (e: PointerEvent) => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      previewDrop(null)
      setGhost(null)
      if (!dragged.current) return
      const at = dropAt(e.clientX, e.clientY, floor)
      if (!at) return
      add(entry.name, at.position, { rotation: [0, at.yaw, 0] })
      const id = useStudio.getState().selectedId
      if (floor && id && !at.onItem) seatOnFloor(id)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  return (
    <aside className="min-h-0 overflow-y-auto border-r border-border bg-surface row-span-2">
      <div className="sticky top-0 z-10 bg-surface p-3">
        <input
          aria-label="Search components"
          placeholder="Search components…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
        />
        <p className="mt-1.5 text-[11px] text-faint">Click to add · drag onto the canvas to place</p>
      </div>
      {groups.map(([category, entries]) => (
        <section key={category} className="px-3 pb-3">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{category}</h3>
          <ul>
            {entries.map((e) => (
              <li key={e.name}>
                <button
                  disabled={e.status !== "ready"}
                  onPointerDown={(ev) => startDrag(ev, e)}
                  onClick={() => (dragged.current ? (dragged.current = false) : add(e.name))}
                  title={e.status === "ready" ? `Add ${e.displayName} (or drag it onto the canvas)` : "Coming soon"}
                  className="flex w-full cursor-grab select-none items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-bg active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span>{e.displayName}</span>
                  {e.status === "ready" ? <span aria-hidden className="text-muted">+</span> : <span className="text-xs">soon</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {ghost && (
        <div
          className={`pointer-events-none fixed z-[60] -translate-x-1/2 -translate-y-[130%] rounded-full border px-3 py-1 text-xs font-semibold shadow-lg transition-colors ${
            ghost.over ? "border-accent bg-accent text-on-accent" : "border-border bg-surface text-text"
          }`}
          style={{ left: ghost.x, top: ghost.y }}
        >
          {ghost.over ? `Drop ${ghost.label}` : ghost.label}
        </div>
      )}
    </aside>
  )
}

/** Undo / redo in the top bar (⌘Z / ⇧⌘Z). */
function History() {
  const canUndo = useStudio((s) => s.past.length > 0)
  const canRedo = useStudio((s) => s.future.length > 0)
  const btn = "rounded-md border border-border px-2 py-1 text-sm disabled:opacity-35"
  return (
    <div className="flex gap-1">
      <button className={btn} disabled={!canUndo} onClick={() => useStudio.getState().undo()} title="Undo (⌘Z)" aria-label="Undo">↶</button>
      <button className={btn} disabled={!canRedo} onClick={() => useStudio.getState().redo()} title="Redo (⇧⌘Z)" aria-label="Redo">↷</button>
    </div>
  )
}

/** Play locks the scene: components work, nothing can be grabbed or moved, the grid hides. */
function PlayToggle() {
  const playMode = useStudio((s) => s.playMode)
  return (
    <button
      onClick={() => useStudio.getState().togglePlay()}
      aria-pressed={playMode}
      title={playMode ? "Back to editing" : "Lock the scene and use it"}
      className="rounded-md border border-border px-3 py-1.5 text-sm font-medium aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent"
    >
      {playMode ? "Playing · Edit" : "Play"}
    </button>
  )
}

/** First-run card over an empty canvas. */
function EmptyHint() {
  const empty = useStudio((s) => s.items.length === 0)
  if (!empty) return null
  return (
    <div className="pointer-events-none absolute left-6 top-6 max-w-[300px] rounded-xl border border-border bg-surface/90 p-4 text-sm backdrop-blur">
      <p className="font-display text-base font-bold">Build your space</p>
      <ul className="mt-2 space-y-1 text-muted">
        <li>Drag a component from the left onto the floor</li>
        <li>Or pick a template in the top bar</li>
        <li>Or drop your app&apos;s .glb anywhere</li>
      </ul>
    </div>
  )
}

function Inspector() {
  const { items, selectedId, values, update, remove, bind, duplicate } = useStudio()
  const item = items.find((i) => i.id === selectedId)
  const names = [...new Set(items.flatMap((i) => Object.values(i.bind)))]
  if (!item)
    return (
      <aside className="row-span-2 border-l border-border bg-surface p-4 text-sm text-muted">
        Drag a component from the library onto the canvas, then click it (or grab its bar) to select and edit it. Drag the bar under a component to move it.
      </aside>
    )
  const num = (v: string) => (Number.isFinite(+v) ? +v : 0)
  const axis = ["x", "y", "z"] as const
  return (
    <aside className="row-span-2 min-h-0 space-y-5 overflow-y-auto border-l border-border bg-surface p-4 text-sm">
      <div>
        <input
          key={`${item.id}-${item.name ?? ""}`}
          aria-label="Layer name"
          defaultValue={item.name ?? registry.find((e) => e.name === item.component)?.displayName ?? item.component}
          onBlur={(e) => {
            const v = e.target.value.trim()
            if (v !== (item.name ?? "")) update(item.id, { name: v || undefined })
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="w-full rounded-md bg-transparent font-display text-lg font-extrabold outline-none focus:bg-bg"
        />
        <p className="font-mono text-xs text-muted">{item.component} · id {item.id}</p>
      </div>
      <PropsSection item={item} />
      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Position (m)</legend>
        <div className="grid grid-cols-3 gap-2">
          {axis.map((a, i) => (
            <label key={a} className="flex items-center gap-1">
              <span className="text-muted">{a}</span>
              <input
                type="number"
                step={0.05}
                value={+item.position[i].toFixed(3)}
                onChange={(e) => {
                  const p = [...item.position] as typeof item.position
                  p[i] = num(e.target.value)
                  update(item.id, { position: p })
                }}
                className="w-full rounded-md border border-border bg-bg px-1.5 py-1"
              />
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-1">
            <span className="text-muted">turn°</span>
            <input
              type="number"
              step={15}
              value={Math.round((item.rotation[1] * 180) / Math.PI)}
              onChange={(e) => update(item.id, { rotation: [item.rotation[0], (num(e.target.value) * Math.PI) / 180, item.rotation[2]] })}
              className="w-full rounded-md border border-border bg-bg px-1.5 py-1"
            />
          </label>
          <label className="flex items-center gap-1">
            <span className="text-muted">scale</span>
            <input
              type="number"
              step={0.1}
              min={0.1}
              value={item.scale}
              onChange={(e) => update(item.id, { scale: Math.max(0.1, num(e.target.value)) })}
              className="w-full rounded-md border border-border bg-bg px-1.5 py-1"
            />
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Controls</legend>
        {bindablesOf(item.component).length === 0 ? (
          <p className="text-muted">This component has no wireable values yet.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted">Give a value a name. Components sharing a name stay in sync, and the code panel wires them up.</p>
            {bindablesOf(item.component).map((b) => {
              const bound = item.bind[b.prop]
              return (
                <label key={b.prop} className="block">
                  <span className="font-mono text-xs">{b.prop}</span>
                  <input
                    key={`${item.id}-${b.prop}-${bound ?? ""}`}
                    list="binding-names"
                    defaultValue={bound ?? ""}
                    placeholder="e.g. volume"
                    onBlur={(e) => bind(item.id, b.prop, e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    className="mt-0.5 w-full rounded-md border border-border bg-bg px-2 py-1"
                  />
                  {bound && (
                    <span className="font-mono text-xs text-muted">
                      {bound} = {JSON.stringify(bound in values ? values[bound] : b.default)}
                    </span>
                  )}
                </label>
              )
            })}
            <datalist id="binding-names">
              {names.map((n) => <option key={n} value={n} />)}
            </datalist>
          </div>
        )}
      </fieldset>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => duplicate()} title="⌘D" className="rounded-md border border-border px-3 py-1.5 font-medium hover:bg-bg">
          Duplicate
        </button>
        <button onClick={() => remove(item.id)} title="Delete" className="rounded-md border border-border px-3 py-1.5 font-medium hover:bg-bg">
          Delete
        </button>
      </div>
    </aside>
  )
}

type PropMeta = ReturnType<typeof propsOf>[number]

/** Live properties from the registry (colour, text, size, style…): every change re-renders the component at once. */
function PropsSection({ item }: { item: Item }) {
  const metas = propsOf(item.component)
  if (!metas.length) return null
  return (
    <fieldset className="space-y-2.5">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Properties</legend>
      {metas.map((m) => (
        <PropField key={`${item.id}-${m.name}`} item={item} meta={m} />
      ))}
    </fieldset>
  )
}

function PropField({ item, meta: m }: { item: Item; meta: PropMeta }) {
  const value = item.props?.[m.name] ?? m.default
  const set = (v: unknown) => useStudio.getState().update(item.id, { props: { ...item.props, [m.name]: v } })
  const label = <span className="font-mono text-xs">{m.name}</span>
  const field = "w-full rounded-md border border-border bg-bg px-2 py-1"
  if (m.type === "boolean")
    return (
      <label className="flex items-center justify-between gap-2">
        {label}
        <input type="checkbox" checked={value === true} onChange={(e) => set(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
      </label>
    )
  if (Array.isArray(m.options) && m.options.length)
    return (
      <label className="block space-y-1">
        {label}
        <select value={String(value ?? "")} onChange={(e) => set(m.options!.find((o) => String(o) === e.target.value) ?? e.target.value)} className={field}>
          {m.options.map((o) => (
            <option key={String(o)} value={String(o)}>{String(o)}</option>
          ))}
        </select>
      </label>
    )
  if (m.type === "color") {
    const hex = /^#[0-9a-f]{6}$/i.test(String(value)) ? String(value) : "#ffffff"
    return (
      <label className="flex items-center justify-between gap-2">
        {label}
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted">{hex}</span>
          <input type="color" value={hex} onChange={(e) => set(e.target.value)} className="h-7 w-10 cursor-pointer rounded border border-border bg-bg" />
        </span>
      </label>
    )
  }
  if (m.type === "number") {
    const v = typeof value === "number" ? value : 0
    const ranged = m.min !== undefined && m.max !== undefined
    return (
      <label className="block space-y-1">
        <span className="flex justify-between">{label}<span className="font-mono text-xs text-muted">{+v.toFixed(2)}</span></span>
        {ranged ? (
          <input type="range" min={m.min} max={m.max} step={m.step ?? (m.max! - m.min!) / 100} value={v} onChange={(e) => set(+e.target.value)} className="w-full accent-[var(--color-accent)]" />
        ) : (
          <input type="number" step={m.step ?? "any"} value={v} onChange={(e) => set(Number.isFinite(+e.target.value) ? +e.target.value : 0)} className={field} />
        )}
      </label>
    )
  }
  return (
    <label className="block space-y-1">
      {label}
      <input
        key={String(value ?? "")}
        defaultValue={String(value ?? "")}
        onBlur={(e) => e.target.value !== String(value ?? "") && set(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className={field}
      />
    </label>
  )
}

function CodePanel() {
  const items = useStudio((s) => s.items)
  const name = useStudio((s) => s.name)
  const code = useMemo(() => generateCode({ name, items }, bindablesOf), [name, items])
  const [copied, setCopied] = useState(false)
  const file = `${name.trim().replace(/\W+/g, "-").toLowerCase() || "scene"}.tsx`
  return (
    <section className="flex min-h-0 flex-col border-t border-border bg-stage text-stage-text">
      <div className="flex items-center gap-3 px-3 py-1.5 text-xs">
        <span className="font-mono text-stage-text/60">{file}</span>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(code)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="ml-auto rounded-md bg-stage-text px-2 py-1 font-medium text-stage"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <a
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(code)}`}
          download={file}
          className="rounded-md border border-stage-text/30 px-2 py-1 font-medium"
        >
          Download
        </a>
      </div>
      <pre className="min-h-0 flex-1 overflow-auto px-3 pb-3 font-mono text-xs leading-relaxed">{code}</pre>
    </section>
  )
}
