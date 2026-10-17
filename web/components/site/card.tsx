import Link from "next/link"
import type { Entry } from "@/lib/registry"
import { Placeholder, Preview } from "./preview"

export function ComponentCard({ entry }: { entry: Entry }) {
  const ready = entry.status === "ready"
  const body = (
    <>
      <div className="stage-bg relative aspect-[4/3] overflow-hidden rounded-[14px] border border-border transition-colors group-hover:border-border-2">
        {ready ? <Preview name={entry.name} /> : <Placeholder />}
        {ready && (
          <span className="absolute left-2.5 top-2.5 rounded-md border border-border bg-bg/70 px-1.5 font-mono text-[11px] text-muted">
            LIVE 3D
          </span>
        )}
      </div>
      <div className="flex items-baseline justify-between gap-2.5">
        <b className="truncate text-[15px] font-semibold">{entry.displayName}</b>
        {entry.xrOnly ? (
          <span className="shrink-0 rounded-[5px] border border-accent/35 px-1.5 font-mono text-[11px] text-accent">XR</span>
        ) : (
          <span className="shrink-0 text-[13px] text-faint">{ready ? "Free" : "Soon"}</span>
        )}
      </div>
      <p className="-mt-2 truncate text-[13px] text-muted">
        {entry.description || `${entry.category} · ${entry.style}`}
      </p>
    </>
  )
  if (!ready) return <div className="grid gap-3 opacity-70">{body}</div>
  return (
    <Link href={`/components/${entry.name}`} className="group grid gap-3 rounded-[14px]">
      {body}
    </Link>
  )
}
