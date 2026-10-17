"use client"

import { useEffect, useState } from "react"
import { Canvas } from "@react-three/fiber"
import { NotInXR, PointerEvents, XR, noEvents } from "@react-three/xr"
import { OrbitHandles, createScreenCameraStore } from "@react-three/handle"
import { LayoutRenderer } from "@/components/studio/layout-renderer"
import { xrStore } from "@/components/studio/xr-store"
import type { Layout } from "@/lib/layout"
import { Message } from "./app-loader"

// Same framing as the Studio camera, so the launched app looks like what was built.
const cameraStore = createScreenCameraStore({ origin: [0, 1.25, -1.2], distance: 2.6, pitch: 0.12, yaw: 0 })

export default function AppView({ id }: { id: string }) {
  const [layout, setLayout] = useState<Layout | "loading" | "missing" | "error">("loading")
  const [values, setValues] = useState<Record<string, unknown>>({})

  useEffect(() => {
    let live = true
    fetch(`/api/layout/${encodeURIComponent(id)}`)
      .then(async (r) => (r.ok ? ((await r.json()) as Layout) : r.status === 404 || r.status === 400 ? "missing" : "error"))
      .catch(() => "error" as const)
      .then((l) => live && setLayout(l))
    return () => {
      live = false
    }
  }, [id])

  if (layout === "loading") return <Message>Loading app…</Message>
  if (layout === "missing") return <Message>No app with id “{id}”. Launch it again from the Studio.</Message>
  if (layout === "error") return <Message>Couldn’t load this app. Check your connection and reload.</Message>
  if (!layout.items.length) return <Message>This app is empty. Add components in the Studio, then Launch again.</Message>

  return (
    <div className="fixed inset-0 z-50 bg-stage">
      <Canvas events={noEvents} camera={{ position: [0, 1.5, 1.2], fov: 50 }} gl={{ localClippingEnabled: true }}>
        <PointerEvents />
        <XR store={xrStore}>
          <NotInXR>
            <color attach="background" args={["#111214"]} />
            <OrbitHandles store={cameraStore} />
          </NotInXR>
          <ambientLight intensity={1.2} />
          <directionalLight position={[2, 4, 3]} intensity={2} />
          <LayoutRenderer
            items={layout.items}
            values={values}
            setValue={(name, v) => setValues((s) => ({ ...s, [name]: v }))}
            editable={false}
          />
        </XR>
      </Canvas>
      <h1 className="absolute left-4 top-4 font-display text-xl font-extrabold text-stage-text">{layout.name}</h1>
      <div className="absolute right-4 top-4 flex gap-2">
        <button
          type="button"
          onClick={() => xrStore.enterAR()}
          className="rounded-md border border-stage-text/40 bg-accent px-4 py-2 text-sm font-semibold text-on-accent"
        >
          Enter AR
        </button>
        <button
          type="button"
          onClick={() => xrStore.enterVR()}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-text"
        >
          Enter VR
        </button>
      </div>
    </div>
  )
}
