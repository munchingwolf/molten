"use client"

import { useState } from "react"

/** The Night Set mockup (public/demo/night-set.html), live. A cover keeps the page scrolling until you click in. */
export function DawDemo() {
  const [live, setLive] = useState(false)
  return (
    <div className="relative aspect-video overflow-hidden rounded-[18px] border border-border bg-stage">
      <iframe
        src="/demo/night-set.html"
        title="Night Set: a DAW built in Spatial"
        loading="lazy"
        className={`h-full w-full ${live ? "" : "pointer-events-none"}`}
      />
      {!live && (
        <button type="button" onClick={() => setLive(true)} className="absolute inset-0 flex items-start justify-end p-5">
          <span className="rounded-[9px] border border-border-2 bg-surface/90 px-3.5 py-2 text-sm font-semibold">Click to explore in 3D</span>
        </button>
      )}
    </div>
  )
}
