"use client"

import { Canvas } from "@react-three/fiber"
import { NotInXR, PointerEvents, XR, noEvents } from "@react-three/xr"
import { OrbitHandles } from "@react-three/handle"
import { createScreenCameraStore } from "@pmndrs/handle"
import { useStudio } from "@/lib/studio-store"
import { LayoutRenderer } from "./layout-renderer"
import { VRShelf } from "./vr-shelf"
import { VRWorkspace } from "./vr-workspace"
import { xrStore } from "./xr-store"

// Laptop camera orbits the area where components are placed (eye height, ~1.2 m ahead).
const cameraStore = createScreenCameraStore({ origin: [0, 1.25, -1.2], distance: 2.6, pitch: 0.12, yaw: 0 })

export function StudioScene() {
  const { items, values, selectedId, setValue, select, update } = useStudio()
  return (
    <Canvas events={noEvents} gl={{ localClippingEnabled: true }} camera={{ fov: 45 }}>
      <PointerEvents />
      <XR store={xrStore}>
        <NotInXR>
          <color attach="background" args={["#111214"]} />
          <gridHelper args={[8, 32, "#2a2b2e", "#1c1d20"]} />
          <OrbitHandles store={cameraStore} />
        </NotInXR>
        <ambientLight intensity={1.2} />
        <directionalLight position={[2, 4, 3]} intensity={2} />
        <LayoutRenderer
          items={items}
          values={values}
          setValue={setValue}
          editable
          selectedId={selectedId}
          onSelect={select}
          onMove={(id, position) => update(id, { position })}
        />
        <VRShelf />
        <VRWorkspace />
      </XR>
    </Canvas>
  )
}
