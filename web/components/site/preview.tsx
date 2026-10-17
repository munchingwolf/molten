"use client"

import { Canvas } from "@react-three/fiber"
import { XR, createXRStore } from "@react-three/xr"
import { useEffect, useMemo, useState } from "react"
import { components } from "@/lib/registry"

/** Live 3D render of a registry component. One WebGL context per preview. */
// shortcut: one Canvas per card, browsers cap ~16 live contexts; switch to drei <View> if a page shows more.
export function Preview({ name, interactive = false }: { name: string; interactive?: boolean }) {
  const Component = components[name]
  if (!Component) return <Placeholder />
  return (
    <Canvas
      camera={{ position: [0, 0, 2.1], fov: 35 }}
      gl={{ antialias: true, localClippingEnabled: true, alpha: true }}
      style={{ pointerEvents: interactive ? "auto" : "none" }}
      frameloop={interactive ? "always" : "demand"}
    >
      <Component />
    </Canvas>
  )
}

/**
 * Same component, but the canvas can also enter an immersive session.
 * In a desktop browser it is a normal live preview; in the Quest browser "View in headset"
 * puts the component at arm's length (1.2 m up, 0.6 m away) and hands/controllers can use it.
 */
export function XRPreview({ name }: { name: string }) {
  const Component = components[name]
  const store = useMemo(() => createXRStore({ emulate: false }), [])
  const vrSupported = useImmersiveSupport()
  const [inXR, setInXR] = useState(false)
  useEffect(() => store.subscribe((s) => setInXR(s.session != null)), [store])
  if (!Component) return <Placeholder />

  return (
    <div className="relative h-full w-full">
      <Canvas camera={{ position: [0, 0, 2.1], fov: 35 }} gl={{ antialias: true, localClippingEnabled: true, alpha: true }}>
        <XR store={store}>
          {/* Desktop: component at the origin facing the camera. Headset: same component placed in the room. */}
          <group position={inXR ? [0, 1.2, -0.6] : [0, 0, 0]} scale={inXR ? 0.6 : 1}>
            <Component />
          </group>
        </XR>
      </Canvas>
      {vrSupported && (
        <button
          onClick={() => store.enterVR()}
          className="absolute bottom-3 right-3 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent"
        >
          View in headset
        </button>
      )}
    </div>
  )
}

function useImmersiveSupport() {
  const [ok, setOk] = useState(false)
  useEffect(() => {
    navigator.xr?.isSessionSupported("immersive-vr").then(setOk).catch(() => setOk(false))
  }, [])
  return ok
}

export function Placeholder({ label = "Coming soon" }: { label?: string }) {
  return <div className="grid h-full w-full place-items-center font-mono text-xs text-faint">{label}</div>
}
