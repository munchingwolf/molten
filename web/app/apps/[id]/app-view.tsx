"use client"

import { unlockAudio } from "@/lib/unlock-audio"

import { useEffect, useState } from "react"
import { Canvas } from "@react-three/fiber"
import { IfInSessionMode, NotInXR, PointerEvents, XR, noEvents } from "@react-three/xr"
import type { ComponentType } from "react"
import { components } from "@/lib/registry"
import { OrbitHandles, createScreenCameraStore } from "@react-three/handle"
import { LayoutRenderer } from "@/components/studio/layout-renderer"
import { xrStore } from "@/components/studio/xr-store"
import type { Layout } from "@/lib/layout"
import { GO_EVENT, resolveScene } from "@/lib/scene-nav"
import { useSceneFade } from "@/components/studio/scene-bar"
import { Message } from "./app-loader"

// Same framing as the Studio camera, so the launched app looks like what was built.
const cameraStore = createScreenCameraStore({ origin: [0, 1.25, -1.2], distance: 2.6, pitch: 0.12, yaw: 0 })

export default function AppView({ id }: { id: string }) {
  // First tap anywhere (laptop) unlocks audio so the app's instruments play on their first press.
  useEffect(() => {
    window.addEventListener("pointerdown", unlockAudio, { capture: true })
    return () => window.removeEventListener("pointerdown", unlockAudio, { capture: true })
  }, [])
  const [layout, setLayout] = useState<Layout | "loading" | "missing" | "error">("loading")
  const [values, setValues] = useState<Record<string, unknown>>({})
  // Multi-scene apps: portals and nav buttons fire "spatial:go"; move to that scene behind a fade.
  const [sceneId, setSceneId] = useState<string | null>(null)
  const { fade, overlay } = useSceneFade()
  const scenes = typeof layout === "object" ? layout.scenes ?? [] : []
  const current = scenes.find((s) => s.id === sceneId) ?? scenes[0]
  useEffect(() => {
    if (scenes.length < 2) return
    const onGo = (e: Event) => {
      const to = String((e as CustomEvent<{ to?: string }>).detail?.to ?? "next")
      const id = resolveScene(scenes, to, current?.id ?? scenes[0].id)
      if (id && id !== current?.id) fade(() => setSceneId(id))
    }
    window.addEventListener(GO_EVENT, onGo)
    return () => window.removeEventListener(GO_EVENT, onGo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, current?.id])

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
  const items = current?.items ?? layout.items
  const environment = current ? current.environment : layout.environment
  if (!items.length && !scenes.length) return <Message>This app is empty. Add components in the Studio, then Launch again.</Message>
  const Env = environment ? (components[environment] as ComponentType | undefined) : undefined

  return (
    <div className="fixed inset-0 z-50 bg-stage">
      <Canvas events={noEvents} camera={{ position: [0, 1.5, 1.2], fov: 50 }} gl={{ localClippingEnabled: true }}>
        <PointerEvents />
        <XR store={xrStore}>
          <NotInXR>
            <OrbitHandles store={cameraStore} />
          </NotInXR>
          {/* Same world as in the Studio: the layout's environment (not in AR passthrough), else the dark stage. */}
          {Env ? (
            <IfInSessionMode deny="immersive-ar">
              <Env />
            </IfInSessionMode>
          ) : (
            <>
              <IfInSessionMode deny="immersive-ar">
                <color attach="background" args={["#111214"]} />
              </IfInSessionMode>
              <ambientLight intensity={1.2} />
              <directionalLight position={[2, 4, 3]} intensity={2} />
            </>
          )}
          <LayoutRenderer
            items={items}
            values={values}
            setValue={(name, v) => setValues((s) => ({ ...s, [name]: v }))}
            editable={false}
          />
        </XR>
      </Canvas>
      {overlay}
      <h1 className="absolute left-4 top-4 font-display text-xl font-extrabold text-stage-text">
        {layout.name}
        {current && scenes.length > 1 && <span className="ml-2 text-sm font-medium text-stage-text/60">{current.name}</span>}
      </h1>
      <div className="absolute right-4 top-4 flex gap-2">
        <button
          type="button"
          onClick={() => (unlockAudio(), xrStore.enterAR())}
          className="rounded-md border border-stage-text/40 bg-accent px-4 py-2 text-sm font-semibold text-on-accent"
        >
          Enter AR
        </button>
        <button
          type="button"
          onClick={() => (unlockAudio(), xrStore.enterVR())}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-text"
        >
          Enter VR
        </button>
      </div>
    </div>
  )
}
