"use client"

import { Canvas, useFrame } from "@react-three/fiber"
import { Bounds, useBounds } from "@react-three/drei"
import { XR, createXRStore } from "@react-three/xr"
import { Component as ReactComponent, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { components } from "@/lib/registry"

/** Live 3D render of a registry component. One WebGL context per preview. */
// shortcut: one Canvas per card, browsers cap ~16 live contexts; switch to drei <View> if a page shows more.
export function Preview({ name, interactive = false }: { name: string; interactive?: boolean }) {
  const Component = components[name]
  if (!Component) return <Placeholder />
  return (
    // A component that throws (or a lost WebGL context) must not take the whole page down with it.
    <SafeBoundary fallback={<Placeholder label="Preview unavailable" />}>
      <Canvas
        camera={{ position: [0, 0, 2.1], fov: 35 }}
        gl={{ antialias: true, localClippingEnabled: true, alpha: true }}
        style={{ pointerEvents: interactive ? "auto" : "none" }}
      >
        <StageLights />
        {/* Registry components are lazy-loaded; render nothing until the file arrives. */}
        <Suspense fallback={null}>
          {/* Zoom the camera to the component's size: a 4 cm button and a 70 cm panel both fill the card. */}
          <Bounds margin={1.25} maxDuration={0}>
            <Component />
            <AutoFit />
          </Bounds>
        </Suspense>
      </Canvas>
    </SafeBoundary>
  )
}

export class SafeBoundary extends ReactComponent<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** Soft studio lighting so mesh-based components (knobs, buttons, objects) aren't black; uikit panels ignore it. */
function StageLights() {
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[1.5, 2, 3]} intensity={2.2} />
      <directionalLight position={[-2, -1, -1]} intensity={0.6} color="#7FE3FF" />
    </>
  )
}

/** uikit lays out a frame or two after mount, so a fit at mount sees an empty box; re-fit a few times while it settles. */
function AutoFit() {
  const bounds = useBounds()
  const frames = useRef(0)
  useFrame(() => {
    if (frames.current > 60) return
    frames.current++
    if (frames.current % 12 === 0) bounds.refresh().clip().fit()
  })
  return null
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
      <SafeBoundary fallback={<Placeholder label="Preview unavailable" />}>
        <Canvas camera={{ position: [0, 0, 2.1], fov: 35 }} gl={{ antialias: true, localClippingEnabled: true, alpha: true }}>
          <XR store={store}>
            <StageLights />
            <Suspense fallback={null}>
              {inXR ? (
                // Headset: the component placed in the room at arm's length (the headset owns the camera).
                <group position={[0, 1.2, -0.6]} scale={0.6}>
                  <Component />
                </group>
              ) : (
                // Desktop: camera zooms to fit, whatever the component's size.
                <Bounds margin={1.3} maxDuration={0}>
                  <Component />
                  <AutoFit />
                </Bounds>
              )}
            </Suspense>
          </XR>
        </Canvas>
      </SafeBoundary>
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
