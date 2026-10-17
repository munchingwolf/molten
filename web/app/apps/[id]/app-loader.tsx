"use client"

import dynamic from "next/dynamic"

export const Message = ({ children }: { children: React.ReactNode }) => (
  <div className="fixed inset-0 z-50 grid place-items-center bg-stage font-mono text-sm text-stage-text/60">{children}</div>
)

// three/WebXR only run in the browser.
export const AppLoader = dynamic(() => import("./app-view"), {
  ssr: false,
  loading: () => <Message>Loading app…</Message>,
})
