import Link from "next/link"
import type { Entry } from "@/lib/registry"
import { Placeholder, Preview } from "./preview"

export function ComponentCard({ entry }: { entry: Entry }) {
  const ready = entry.status === "ready"
  const body = (
    <>
      <div className="aspect-[4/3] overflow-hidden rounded-lg border border-border bg-stage">
        {ready ? <Preview name={entry.name} /> : <Placeholder />}
      </div>
      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        <span className="truncate font-medium">{entry.displayName}</span>
        <span className="shrink-0 text-xs text-muted">{ready ? entry.style : "soon"}</span>
      </div>
      <p className="truncate text-sm text-muted">{entry.xrOnly ? "XR-native · " : ""}{entry.category}</p>
    </>
  )
  if (!ready) return <div className="opacity-60">{body}</div>
  return (
    <Link href={`/components/${entry.name}`} className="group block rounded-lg">
      {body}
    </Link>
  )
}
