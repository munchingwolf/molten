"use client"

import type { ComponentType } from "react"
import { Canvas } from "@react-three/fiber"
import { IfInSessionMode, NotInXR, PointerEvents, XR, noEvents } from "@react-three/xr"
import { OrbitHandles } from "@react-three/handle"
import { createScreenCameraStore } from "@pmndrs/handle"
import { components } from "@/lib/registry"
import { useStudio } from "@/lib/studio-store"
import { LayoutRenderer } from "./layout-renderer"
import { VRShelf } from "./vr-shelf"
import { VRWorkspace } from "./vr-workspace"
import { XRayOverlay } from "./xray"
import { VRAssistant } from "./vr-assistant"
import { xrStore } from "./xr-store"

// Laptop camera orbits the area where components are placed (eye height, ~1.2 m ahead).
const cameraStore = createScreenCameraStore({ origin: [0, 1.25, -1.2], distance: 2.6, pitch: 0.12, yaw: 0 })

export function StudioScene() {
  const { items, values, selectedId, setValue, select, update, environment, viewMode, showGrid, snap } = useStudio()
  const xray = viewMode === "xray"
  const Env = environment ? (components[environment] as ComponentType | undefined) : undefined
  return (
    <Canvas events={noEvents} gl={{ localClippingEnabled: true }} camera={{ fov: 45 }}>
      <PointerEvents />
      <XR store={xrStore}>
        <NotInXR>
          <OrbitHandles store={cameraStore} />
        </NotInXR>
        {/* An environment brings its own sky/lights; X-ray strips it back to the bare stage. Without one: dark studio on
            the laptop, your real room (passthrough) in AR. */}
        {Env && !xray ? (
          <IfInSessionMode deny="immersive-ar">
            <Env />
          </IfInSessionMode>
        ) : (
          <IfInSessionMode deny="immersive-ar">
            <color attach="background" args={[xray ? "#07080B" : "#111214"]} />
          </IfInSessionMode>
        )}
        {(!Env || xray) && (
          <>
            <ambientLight intensity={1.2} />
            <directionalLight position={[2, 4, 3]} intensity={2} />
          </>
        )}
        {showGrid && <gridHelper args={[8, 32, xray ? "#3b4252" : "#2a2b2e", xray ? "#232733" : "#1c1d20"]} />}
        <LayoutRenderer
          items={items}
          values={values}
          setValue={setValue}
          editable
          selectedId={selectedId}
          onSelect={(id) => select(id)}
          onTransform={(id, patch) => update(id, patch)}
          snap={snap}
        />
        {xray && <XRayOverlay items={items} selectedId={selectedId} />}
        <VRShelf />
        <VRWorkspace />
        <VRAssistant />
      </XR>
    </Canvas>
  )
}
