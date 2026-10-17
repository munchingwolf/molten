"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { generateCode } from "@/lib/codegen"
import { registry, matches, type Entry } from "@/lib/registry"
import { useStudio } from "@/lib/studio-store"
import { bindablesOf } from "@/components/studio/layout-renderer"
import { StudioScene } from "@/components/studio/scene"
import { EnterXRButtons } from "@/components/studio/xr-controls"

export function StudioApp() {
  const { selectedId, remove, select } = useStudio()

  // Delete/Backspace removes the selected item, Escape deselects (ignored while typing in an input).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select")) return
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) remove(selectedId)
      if (e.key === "Escape") select(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selectedId, remove, select])

  return (
    // fixed + z-50: the Studio is a full-screen tool and covers the site header from the root layout.
    <div className="fixed inset-0 z-50 grid grid-cols-[260px_1fr_300px] grid-rows-[56px_1fr_220px] bg-bg text-text">
      <TopBar />
      <Library />
      <main className="relative min-h-0 bg-stage">
        <StudioScene />
      </main>
      <Inspector />
      <CodePanel />
    </div>
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
      <span className="ml-auto font-mono text-xs text-muted" aria-live="polite">{status}</span>
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

function Library() {
  const [query, setQuery] = useState("")
  const add = useStudio((s) => s.add)
  const groups = useMemo(() => {
    const g = new Map<string, Entry[]>()
    for (const e of registry.filter((e) => matches(e, query)))
      g.set(e.category, [...(g.get(e.category) ?? []), e])
    // Ready components first within the list; categories with something ready first.
    return [...g].sort(([, a], [, b]) => +b.some((e) => e.status === "ready") - +a.some((e) => e.status === "ready"))
  }, [query])
  return (
    <aside className="min-h-0 overflow-y-auto border-r border-border bg-surface row-span-2">
      <div className="sticky top-0 bg-surface p-3">
        <input
          aria-label="Search components"
          placeholder="Search components…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
        />
      </div>
      {groups.map(([category, entries]) => (
        <section key={category} className="px-3 pb-3">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{category}</h3>
          <ul>
            {entries.map((e) => (
              <li key={e.name}>
                <button
                  disabled={e.status !== "ready"}
                  onClick={() => add(e.name)}
                  title={e.status === "ready" ? `Add ${e.displayName}` : "Coming soon"}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span>{e.displayName}</span>
                  {e.status === "ready" ? <span aria-hidden className="text-muted">+</span> : <span className="text-xs">soon</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </aside>
  )
}

function Inspector() {
  const { items, selectedId, values, update, remove, bind } = useStudio()
  const item = items.find((i) => i.id === selectedId)
  const names = [...new Set(items.flatMap((i) => Object.values(i.bind)))]
  if (!item)
    return (
      <aside className="row-span-2 border-l border-border bg-surface p-4 text-sm text-muted">
        Add a component from the library, then click it (or grab its bar) to select. Drag the bar under a component to move it.
      </aside>
    )
  const num = (v: string) => (Number.isFinite(+v) ? +v : 0)
  const axis = ["x", "y", "z"] as const
  return (
    <aside className="row-span-2 min-h-0 space-y-5 overflow-y-auto border-l border-border bg-surface p-4 text-sm">
      <div>
        <p className="font-display text-lg font-extrabold">{item.component}</p>
        <p className="font-mono text-xs text-muted">id {item.id}</p>
      </div>
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
              onChange={(e) => update(item.id, { rotation: [0, (num(e.target.value) * Math.PI) / 180, 0] })}
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
      <button onClick={() => remove(item.id)} className="w-full rounded-md border border-border px-3 py-1.5 font-medium hover:bg-bg">
        Delete
      </button>
    </aside>
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
