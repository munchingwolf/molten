"use client"

import { useEffect, useRef, type ComponentType } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Box3, Plane, Raycaster, Vector2, Vector3, type Camera, type Mesh, type Object3D, type Scene } from "three"
import type { Vec3 } from "@/lib/layout"
import { IfInSessionMode, NotInXR, PointerEvents, XR, noEvents } from "@react-three/xr"
import { OrbitHandles } from "@react-three/handle"
import { createScreenCameraStore } from "@pmndrs/handle"
import { components } from "@/lib/registry"
import { useStudio } from "@/lib/studio-store"
import { LayoutRenderer } from "./layout-renderer"
import { VRShelf } from "./vr-shelf"
import { VRWorkspace } from "./vr-workspace"
import { VRWheel } from "./vr-wheel"
import { XRayOverlay } from "./xray"
import { VRAssistant } from "./vr-assistant"
import Mascot from "@/components/spatial/mascot"
import { useAssistantMood } from "./mascot-2d"
import { xrStore } from "./xr-store"
import { MeasureGrid } from "./measure-grid"
import { SlotGuides } from "./slot-guides"
import { VRGuide } from "./vr-guide"

// Laptop camera orbits the area where components are placed (eye height, ~1.2 m ahead).
const cameraStore = createScreenCameraStore({ origin: [0, 1.25, -1.2], distance: 2.6, pitch: 0.12, yaw: 0 })

export function StudioScene() {
  const { items, values, selectedId, setValue, select, update, environment, viewMode, showGrid, snap, playMode } = useStudio()
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
        {showGrid && !playMode && <MeasureGrid xray={xray} />}
        <LayoutRenderer
          items={items}
          values={values}
          setValue={setValue}
          editable={!playMode}
          selectedId={selectedId}
          onSelect={(id) => select(id)}
          onTransform={(id, patch) => (update(id, patch), useStudio.getState().claimSlot(id))}
          snap={snap}
        />
        {xray && !playMode && <XRayOverlay items={items} selectedId={selectedId} />}
        <SlotGuides />
        <DropProbe />
        <VRShelf />
        <VRWorkspace />
        <VRGuide />
        <VRWheel />
        <VRAssistant mascot={<VRPix />} />
      </XR>
    </Canvas>
  )
}

/** Pix, the voxel guide, perched on the VR assistant; mood follows the assistant (listening/thinking/talking/happy). */
function VRPix() {
  return <Mascot mood={useAssistantMood()} size={1} />
}

/* ---------- Drag from the library: where does a screen point land in the world? ---------- */

const probe: { camera?: Camera; scene?: Scene; canvas?: HTMLCanvasElement; marker?: Mesh; pending?: { id: string; frames: number } } = {}
const ray = new Raycaster()
const ndc = new Vector2()
const FLOOR = new Plane(new Vector3(0, 1, 0), 0)
const WORK = new Plane(new Vector3(0, 1, 0), -1.25) // y = 1.25 m: panels float at a comfortable working height
const hitPoint = new Vector3()

/** `hit`: the exact ray hit on a component or guide slot (drop-target.ts tests it against slot/item bounds). */
export type Drop = { position: Vec3; yaw: number; onItem: boolean; hit?: Vec3 }

/**
 * World spot under a screen point: in front of a placed component if you point at one, else on the working plane
 * (UI) or the floor (`floor`, furniture), clamped to 0.6–5 m from the camera. Null when the point isn't over the canvas.
 */
export function dropAt(clientX: number, clientY: number, floor = false): Drop | null {
  const { camera, scene, canvas } = probe
  if (!camera || !scene || !canvas || document.elementFromPoint(clientX, clientY) !== canvas) return null
  const r = canvas.getBoundingClientRect()
  ray.setFromCamera(ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera)
  const cam = camera.getWorldPosition(new Vector3())
  const yawTo = (p: Vector3) => Math.atan2(cam.x - p.x, cam.z - p.z) // face the camera
  const hit = ray.intersectObjects(scene.children, true).find((h) => h.face && h.object !== probe.marker && h.distance < 12)
  if (hit) {
    const n = hit.face!.normal.clone().transformDirection(hit.object.matrixWorld)
    const p = hit.point.clone().addScaledVector(n, 0.06)
    return { position: [p.x, p.y, p.z], yaw: yawTo(p), onItem: true, hit: hit.point.toArray() as Vec3 }
  }
  const p = ray.ray.intersectPlane(floor ? FLOOR : WORK, hitPoint) ?? ray.ray.at(2, hitPoint)
  const d = Math.hypot(p.x - cam.x, p.z - cam.z)
  if (d > 5 || d < 0.6) {
    const k = Math.min(5, Math.max(0.6, d)) / (d || 1)
    p.set(cam.x + (p.x - cam.x) * k, p.y, cam.z + (p.z - cam.z) * k)
  }
  return { position: [p.x, p.y, p.z], yaw: yawTo(p), onItem: false }
}

/** Show (or hide with null) the landing ring while a library row is dragged over the canvas. Returns whether it's over. */
export function previewDrop(clientX: number | null, clientY = 0, floor = false): boolean {
  const m = probe.marker
  const d = clientX === null ? null : dropAt(clientX, clientY, floor)
  if (m) {
    m.visible = !!d
    if (d) m.position.set(d.position[0], d.onItem ? d.position[1] : floor ? 0.004 : d.position[1], d.position[2])
    m.rotation.set(d && !floor && !d.onItem ? 0 : -Math.PI / 2, d && !floor && !d.onItem ? d.yaw : 0, 0)
  }
  return !!d
}

/** After a furniture drop, lift the new item so its bottom rests on the floor once it has rendered (needs userData.itemId). */
export function seatOnFloor(id: string) {
  probe.pending = { id, frames: 45 }
}

function DropProbe() {
  const camera = useThree((st) => st.camera)
  const scene = useThree((st) => st.scene)
  const gl = useThree((st) => st.gl)
  const marker = useRef<Mesh>(null)
  useEffect(() => {
    Object.assign(probe, { camera, scene, canvas: gl.domElement, marker: marker.current ?? undefined })
    return () => void Object.assign(probe, { camera: undefined, scene: undefined, canvas: undefined, marker: undefined })
  }, [camera, scene, gl])
  useFrame(() => {
    const job = probe.pending
    if (!job || job.frames-- <= 0) return void (probe.pending = undefined)
    let target: Object3D | undefined
    scene.traverse((o) => void (o.userData.itemId === job.id && (target = o)))
    if (!target) return
    try {
      const minY = new Box3().setFromObject(target).min.y
      if (!Number.isFinite(minY) || Math.abs(minY) < 0.005) return void (probe.pending = undefined)
      const s = useStudio.getState()
      const it = s.items.find((i) => i.id === job.id)
      if (it) s.update(job.id, { position: [it.position[0], it.position[1] - minY, it.position[2]] })
    } catch {}
    probe.pending = undefined
  })
  return (
    <mesh ref={marker} visible={false} raycast={() => {}} renderOrder={10}>
      <ringGeometry args={[0.1, 0.13, 48]} />
      <meshBasicMaterial color="#4fbfa0" transparent opacity={0.9} depthTest={false} />
    </mesh>
  )
}
