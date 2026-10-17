"use client"

import Link from "next/link"
import { useState } from "react"
import type { Entry } from "@/lib/registry"
import { Placeholder, Preview } from "@/components/site/preview"

export function Detail({ entry, code, styles }: { entry: Entry; code: string | null; styles: Entry[] }) {
  const [tab, setTab] = useState<"preview" | "code">("preview")
  const [previewKey, setPreviewKey] = useState(0)
  const ready = entry.status === "ready"
  const prompt = `Add the Spatial component "${entry.name}" (${entry.displayName}) to this project. Use the Spatial MCP: call get_component("${entry.name}"), then add_component("${entry.name}") to copy it into components/spatial/, and render it in my scene.`

  return (
    <main className="mx-auto max-w-[1000px] px-4 py-10 sm:px-6">
      <Link href={`/components?c=${encodeURIComponent(entry.category)}`} className="text-sm text-muted hover:text-text">
        ← {entry.category}
      </Link>
      <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight">{entry.displayName}</h1>
      <p className="mt-2 text-muted">{entry.description || "Description coming soon."}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {entry.xrOnly && <Tag>XR-native</Tag>}
        {entry.tags.map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
      </div>

      {ready && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <CopyButton text={prompt} label="Copy prompt" primary />
          {code && <CopyButton text={code} label="Copy code" />}
          <Link
            href={`/studio?add=${entry.name}`}
            className="rounded-md border border-border bg-surface px-3.5 py-2 text-sm font-medium"
          >
            Open in Studio
          </Link>
          <code className="ml-1 font-mono text-sm text-muted">npx spatial add {entry.name}</code>
        </div>
      )}

      {styles.length > 1 && (
        <div role="group" aria-label="Style" className="mt-6 inline-flex rounded-md bg-surface p-1 ring-1 ring-border">
          {styles.map((s) => (
            <Link
              key={s.name}
              href={`/components/${s.name}`}
              aria-current={s.name === entry.name ? "page" : undefined}
              className={`rounded px-3 py-1.5 text-sm capitalize ${
                s.name === entry.name ? "bg-accent text-on-accent" : "text-muted hover:text-text"
              }`}
            >
              {s.style}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div role="tablist" className="flex gap-1">
            {(["preview", "code"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                disabled={t === "code" && !code}
                className={`rounded px-3 py-1 text-sm capitalize disabled:opacity-40 ${tab === t ? "bg-bg font-medium" : "text-muted"}`}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "preview" && ready && (
            <button onClick={() => setPreviewKey((k) => k + 1)} className="text-sm text-muted hover:text-text">
              Reset
            </button>
          )}
        </div>
        {tab === "preview" ? (
          <div className="aspect-[16/10] bg-stage">
            {ready ? <Preview key={previewKey} name={entry.name} interactive /> : <Placeholder />}
          </div>
        ) : (
          <pre className="max-h-[600px] overflow-auto bg-stage p-5 font-mono text-[13px] leading-relaxed text-stage-text">
            {code}
          </pre>
        )}
      </div>
    </main>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-surface px-2 py-0.5 text-xs text-muted ring-1 ring-border">{children}</span>
}

function CopyButton({ text, label, primary }: { text: string; label: string; primary?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }}
      className={`rounded-md px-3.5 py-2 text-sm font-medium ${
        primary ? "bg-accent text-on-accent" : "border border-border bg-surface"
      }`}
    >
      {copied ? "Copied" : label}
    </button>
  )
}
