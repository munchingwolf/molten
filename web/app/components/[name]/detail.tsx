"use client"

import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import type { Entry } from "@/lib/registry"
import { Placeholder, XRPreview } from "@/components/site/preview"

const MCP_INSTALL = "claude mcp add spatial -- node /path/to/molten/mcp/server.mjs"

export function Detail({ entry, code, styles }: { entry: Entry; code: string | null; styles: Entry[] }) {
  const [tab, setTab] = useState<"preview" | "code">("preview")
  const [previewKey, setPreviewKey] = useState(0)
  const ready = entry.status === "ready"
  const npmLine = entry.deps.length ? `npm i ${entry.deps.join(" ")}` : null
  const prompt = `Add the Spatial component "${entry.name}" (${entry.displayName}) to this project. Use the Spatial MCP: call get_component("${entry.name}"), then add_component("${entry.name}") to copy it into components/spatial/, and render it in my scene.`
  // "Copy for Claude Code": the file itself plus what to install, for people without the MCP.
  const forClaude = code
    ? `Add this React Three Fiber component to my project as components/spatial/${entry.name}.tsx${npmLine ? ` (first run: ${npmLine})` : ""}, then render it in my scene.\n\n\`\`\`tsx\n${code}\`\`\``
    : null

  return (
    <main className="mx-auto max-w-[1040px] px-5 py-10">
      <Link href={`/components?c=${encodeURIComponent(entry.category)}`} className="text-sm text-muted hover:text-text">
        ← {entry.category}
      </Link>
      <h1 className="mt-3 font-display text-[clamp(2rem,4vw,2.8rem)] font-bold leading-[1.05] tracking-[-0.03em]">{entry.displayName}</h1>
      <p className="mt-2 max-w-[60ch] text-muted">{entry.description || "Description coming soon."}</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
        <span className="flex items-center gap-1.5">
          <span className="grid size-5 place-items-center rounded-[5px] bg-border-2 text-[10px] font-bold text-text">{entry.author[0]}</span>
          {entry.author}
        </span>
        <span>{entry.license}</span>
        <span className="rounded-[5px] border border-accent/35 px-1.5 font-mono text-xs capitalize text-accent">{entry.price}</span>
        {entry.xrOnly && <span className="rounded-[5px] border border-border-2 px-1.5 font-mono text-xs">XR-native</span>}
        {entry.tags.map((t) => (
          <span key={t} className="rounded-[5px] bg-surface px-1.5 text-xs ring-1 ring-border">{t}</span>
        ))}
      </div>

      {ready && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <CopyButton text={prompt} label="Copy prompt" primary />
          {forClaude && <CopyButton text={forClaude} label="Copy for Claude Code" />}
          {code && <CopyButton text={code} label="Copy code" />}
          <Link href={`/studio?add=${entry.name}`} className="inline-flex h-10 items-center rounded-[9px] border border-border-2 bg-surface px-3.5 text-sm font-semibold hover:border-faint">
            Open in Studio
          </Link>
        </div>
      )}

      {styles.length > 1 && (
        <div role="group" aria-label="Style" className="mt-6 inline-flex rounded-[9px] bg-surface p-1 ring-1 ring-border">
          {styles.map((s) => (
            <Link
              key={s.name}
              href={`/components/${s.name}`}
              aria-current={s.name === entry.name ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm capitalize ${s.name === entry.name ? "bg-accent font-semibold text-on-accent" : "text-muted hover:text-text"}`}
            >
              {s.style}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-[14px] border border-border bg-bg-2">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div role="tablist" className="flex gap-1">
            {(["preview", "code"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                disabled={t === "code" && !code}
                className={`rounded-md px-3 py-1 text-sm capitalize disabled:opacity-40 ${tab === t ? "bg-surface font-semibold" : "text-muted hover:text-text"}`}
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
          <div className="stage-bg aspect-[16/10]">
            {ready ? <XRPreview key={previewKey} name={entry.name} /> : <Placeholder />}
          </div>
        ) : (
          <pre className="max-h-[600px] overflow-auto bg-bg p-5 font-mono text-[13px] leading-relaxed text-muted">{code}</pre>
        )}
      </div>

      <div className="mt-10 grid gap-10 md:grid-cols-[1.3fr_1fr]">
        <section>
          <h2 className="font-display text-xl font-bold tracking-[-0.01em]">Props</h2>
          {entry.bindable?.length ? (
            <div className="mt-3 overflow-x-auto rounded-[14px] border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-bg-2 text-muted">
                  <tr>
                    {["Prop", "Type", "Range", "Default", "Event"].map((h) => (
                      <th key={h} className="px-3.5 py-2.5 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-mono text-[13px]">
                  {entry.bindable.map((b) => (
                    <tr key={b.prop} className="border-t border-border">
                      <td className="px-3.5 py-2.5 text-text">{b.prop}</td>
                      <td className="px-3.5 py-2.5 text-muted">{b.type}</td>
                      <td className="px-3.5 py-2.5 text-muted">{b.min !== undefined ? `${b.min}–${b.max}` : "—"}</td>
                      <td className="px-3.5 py-2.5 text-muted">{b.default === undefined ? "—" : String(b.default)}</td>
                      <td className="px-3.5 py-2.5 text-muted">{b.event ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">Renders with no props. Nothing for the Studio to wire yet.</p>
          )}
        </section>

        <section>
          <h2 className="font-display text-xl font-bold tracking-[-0.01em]">Install</h2>
          <p className="mt-2 text-sm text-muted">Add the Spatial MCP once, then paste the prompt into Claude Code.</p>
          <pre className="mt-3 overflow-x-auto rounded-[9px] border border-border bg-bg px-3.5 py-3 font-mono text-[12.5px] text-muted">
            <span className="text-accent">$</span> {MCP_INSTALL}
            {npmLine && (
              <>
                {"\n"}
                <span className="text-accent">$</span> {npmLine}
              </>
            )}
          </pre>
        </section>
      </div>
    </main>
  )
}

function CopyButton({ text, label, primary }: { text: string; label: string; primary?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }}
      className={`relative inline-flex h-10 items-center overflow-hidden rounded-[9px] px-3.5 text-sm font-semibold ${
        primary ? "bg-accent text-on-accent hover:brightness-105" : "border border-border-2 bg-surface hover:border-faint"
      }`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={copied ? "done" : "idle"}
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -14, opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {copied ? "Copied ✓" : label}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}
