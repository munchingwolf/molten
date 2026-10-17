"use client"

import dynamic from "next/dynamic"

// three/WebXR only run in the browser.
export const StudioLoader = dynamic(() => import("./studio-app").then((m) => m.StudioApp), {
  ssr: false,
  loading: () => <div className="grid h-dvh place-items-center bg-stage font-mono text-sm text-stage-text/60">Loading Studio…</div>,
})
