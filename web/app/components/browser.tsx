"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef } from "react"
import { ComponentCard } from "@/components/site/card"
import { categories, matches, registry } from "@/lib/registry"

const label = (c: string) => c.charAt(0).toUpperCase() + c.slice(1)

export function Browser() {
  const params = useSearchParams()
  const router = useRouter()
  const category = params.get("c") ?? ""
  const query = params.get("q") ?? ""
  const search = useRef<HTMLInputElement>(null)

  // "/" focuses search, like most component catalogs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault()
        search.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    router.replace(`/components?${next}`, { scroll: false })
  }

  const shown = registry
    .filter((e) => !category || e.category === category)
    .filter((e) => matches(e, query))
    // ready components first, then by tier
    .sort((a, b) => Number(b.status === "ready") - Number(a.status === "ready") || (a.tier ?? 0) - (b.tier ?? 0))

  return (
    <div className="mx-auto grid max-w-[1440px] md:grid-cols-[240px_1fr]">
      <aside className="border-border px-3 py-4 md:sticky md:top-14 md:h-[calc(100vh-3.5rem)] md:overflow-y-auto md:border-r">
        <label className="flex items-center gap-2 rounded-md bg-surface px-3 py-2 text-sm ring-1 ring-border focus-within:ring-2 focus-within:ring-accent">
          <input
            ref={search}
            value={query}
            onChange={(e) => set("q", e.target.value)}
            placeholder="Search components"
            aria-label="Search components"
            className="w-full bg-transparent outline-none placeholder:text-muted"
          />
          <kbd className="font-mono text-xs text-muted">/</kbd>
        </label>
        <nav aria-label="Categories" className="mt-4 flex flex-row flex-wrap gap-1 md:flex-col">
          <SideItem active={!category} onClick={() => set("c", "")} label="All" count={registry.length} />
          {categories.map((c) => (
            <SideItem
              key={c}
              active={category === c}
              onClick={() => set("c", c)}
              label={label(c)}
              count={registry.filter((e) => e.category === c).length}
            />
          ))}
        </nav>
      </aside>

      <main className="px-4 py-6 sm:px-6">
        <h1 className="text-lg font-semibold">{category ? label(category) : "All components"}</h1>
        {shown.length === 0 ? (
          <p className="mt-10 text-muted">
            Nothing matches &ldquo;{query}&rdquo;. Try another word, or clear the category.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {shown.map((e) => (
              <ComponentCard key={e.name} entry={e} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function SideItem({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-sm ${
        active ? "bg-surface font-medium ring-1 ring-border" : "text-muted hover:text-text"
      }`}
    >
      {label}
      <span className="text-xs text-muted">{count}</span>
    </button>
  )
}
