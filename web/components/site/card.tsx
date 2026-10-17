import Link from "next/link"
import type { Entry } from "@/lib/registry"
import { Placeholder, Preview } from "./preview"

/** `live={false}` keeps the card but skips its WebGL canvas (browsers cap live contexts at ~16 per page). */
export function ComponentCard({ entry, live = true }: { entry: Entry; live?: boolean }) {
  const ready = entry.status === "ready"
  const body = (
    <>
      <div className="stage-bg relative aspect-[4/3] overflow-hidden rounded-[14px] border border-border transition-colors group-hover:border-border-2">
        {ready ? live ? <Preview name={entry.name} /> : <Placeholder label="Open to preview in 3D" /> : <Placeholder />}
        {ready && live && (
          <span className="absolute left-2.5 top-2.5 rounded-md border border-border bg-bg/70 px-1.5 font-mono text-[11px] text-muted">
            LIVE 3D
          </span>
        )}
      </div>
      <div className="flex items-baseline justify-between gap-2.5">
        <b className="truncate text-[15px] font-semibold">{entry.displayName}</b>
        <span className="flex shrink-0 gap-1.5">
          {entry.xrOnly && <span className="rounded-[5px] border border-border-2 px-1.5 font-mono text-[11px] text-muted">XR</span>}
          <span className="rounded-[5px] border border-accent/35 px-1.5 font-mono text-[11px] capitalize text-accent">
            {ready ? entry.price : "soon"}
          </span>
        </span>
      </div>
      <p className="-mt-2 flex items-center gap-1.5 truncate text-[13px] text-muted">
        <span className="grid size-4 shrink-0 place-items-center rounded-[4px] bg-border-2 text-[9px] font-bold text-text">{entry.author[0]}</span>
        {entry.author} · {entry.category}
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
