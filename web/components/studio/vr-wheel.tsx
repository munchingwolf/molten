"use client"

import { Suspense, useMemo, useRef, useState } from "react"
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { Text as Label3D } from "@react-three/drei"
import { IfInSessionMode } from "@react-three/xr"
import { Container, Text } from "@react-three/uikit"
import { Box3, Vector3, type Group } from "three"
import { create } from "zustand"
import { components, registry, type Entry } from "@/lib/registry"
import { useStudio } from "@/lib/studio-store"
import { useFavorites } from "@/lib/favorites"
import { SafeBoundary } from "@/components/site/preview"
import { xr } from "./xr-theme"
import { aimDrop, dropOnto } from "./drop-target"

/** Wheel open/closed + which page it shows; the toolbar's wheel button toggles it. */
export const useWheel = create<{ open: boolean; page: string; toggle: () => void; setPage: (p: string) => void }>((set) => ({
  open: true,
  page: "Favorites",
  toggle: () => set((s) => ({ open: !s.open })),
  setPage: (page) => set({ page }),
}))

const PAGES: Record<string, string[] | null> = {
  Favorites: null,
  Music: ["music", "hardware"],
  Controls: ["controls", "buttons", "buttons with effects", "inputs", "settings", "ui kit"],
  Room: ["room", "objects"],
  Visuals: ["visuals", "motion"],
  Worlds: ["environments"],
}
// Worlds page: the music backgrounds first (the demo), then the rest.
const WORLD_FIRST = ["env-music-hall", "env-park-music-stage", "env-creative-studio", "env-concert-stage", "env-studio-loft"]
const ON_FLOOR = new Set(["objects", "room", "hardware", "spaces"])
const MAX = 14
const RADIUS = 0.62 // m from your body: inside arm's reach
const ARC = (150 * Math.PI) / 180 // slots span ±150°, leaving a gap behind you
const MINI = 0.15 // every mini fits a 15 cm box, whatever its real size

const head = new Vector3()

/**
 * Component wheel: live miniatures on a ring around you at chest height. It follows where you stand (not where you
 * look), so you turn to browse. Poke a mini to drop it just outside the ring; pinch and drag it out to place it where
 * you let go.
 */
export function VRWheel() {
  const open = useWheel((s) => s.open)
  const playMode = useStudio((s) => s.playMode)
  if (!open || playMode) return null
  return (
    <IfInSessionMode allow={["immersive-ar", "immersive-vr"]}>
      <Ring />
    </IfInSessionMode>
  )
}

function Ring() {
  const ring = useRef<Group>(null)
  const camera = useThree((s) => s.camera)
  const page = useWheel((s) => s.page)
  const favorites = useFavorites()
  const entries = useMemo(() => {
    const ready = registry.filter((e) => e.status === "ready" && components[e.name])
    const cats = PAGES[page]
    const list = cats
      ? ready.filter((e) => cats.includes(e.category))
      : favorites.map((n) => ready.find((e) => e.name === n)).filter((e): e is Entry => !!e)
    if (page === "Worlds") {
      const rank = (e: Entry) => (WORLD_FIRST.includes(e.name) ? WORLD_FIRST.indexOf(e.name) : 99)
      return [...list].sort((a, b) => rank(a) - rank(b)).slice(0, 18)
    }
    return list.slice(0, MAX)
  }, [page, favorites])

  // Follow the body: glide to stay centred under the head, at chest height. First frame snaps.
  const placed = useRef(false)
  useFrame((_, dt) => {
    const g = ring.current
    if (!g) return
    camera.getWorldPosition(head)
    const tx = head.x
    const ty = head.y - 0.45
    const tz = head.z
    const k = placed.current ? 1 - Math.exp(-dt * 4) : 1
    g.position.x += (tx - g.position.x) * k
    g.position.y += (ty - g.position.y) * k
    g.position.z += (tz - g.position.z) * k
    placed.current = true
  })

  const n = entries.length
  return (
    <group ref={ring}>
      {entries.map((e, i) => {
        const a = n === 1 ? 0 : -ARC + (2 * ARC * i) / (n - 1)
        return <Slot key={e.name} entry={e} angle={a} ring={ring} />
      })}
      {/* Page chips, low and straight ahead, tilted up toward you. */}
      <group position={[0, -0.22, -RADIUS * 0.8]} rotation={[-0.6, 0, 0]}>
        <Tabs count={n} />
      </group>
    </group>
  )
}

function Tabs({ count }: { count: number }) {
  const page = useWheel((s) => s.page)
  const setPage = useWheel((s) => s.setPage)
  return (
    <Container pixelSize={0.0012} flexDirection="row" gap={6} padding={6} backgroundColor={xr.panel} borderRadius={xr.radius.lg} borderWidth={1.5} borderColor={xr.border}>
      {Object.keys(PAGES).map((p) => (
        <Container
          key={p}
          height={xr.hit}
          paddingX={14}
          alignItems="center"
          borderRadius={xr.radius.md}
          backgroundColor={p === page ? xr.accent : xr.row}
          hover={{ backgroundColor: p === page ? xr.accent : xr.rowHover }}
          onClick={() => setPage(p)}
        >
          <Text fontSize={15} fontWeight="semi-bold" color={p === page ? xr.onAccent : xr.text}>
            {p}
          </Text>
        </Container>
      ))}
      {count === 0 && (
        <Container height={xr.hit} paddingX={10} alignItems="center">
          <Text fontSize={13} color={xr.muted}>Star components in the laptop library</Text>
        </Container>
      )}
    </Container>
  )
}

function Slot({ entry, angle, ring }: { entry: Entry; angle: number; ring: React.RefObject<Group | null> }) {
  const add = useStudio((s) => s.add)
  const environment = useStudio((s) => s.environment)
  const world = entry.category === "environments"
  const camera = useThree((s) => s.camera)
  const slot = useRef<Group>(null)
  const [hover, setHover] = useState(false)
  const drag = useRef<{ start: Vector3; at: Vector3 } | null>(null)
  const home: [number, number, number] = [Math.sin(angle) * RADIUS, 0, -Math.cos(angle) * RADIUS]

  const place = (world: Vector3) => {
    camera.getWorldPosition(head)
    const floor = ON_FLOOR.has(entry.category)
    const yaw = Math.atan2(head.x - world.x, head.z - world.z) // face you
    add(entry.name, [world.x, floor ? 0 : world.y, world.z], { rotation: [0, yaw, 0] })
  }

  const down = (e: ThreeEvent<PointerEvent>) => {
    if (world) return void useStudio.getState().setEnvironment(environment === entry.name ? null : entry.name)
    ;(e.target as Element).setPointerCapture(e.pointerId)
    drag.current = { start: e.point.clone(), at: e.point.clone() }
  }
  const move = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    const g = slot.current
    if (!d || !g || !ring.current) return
    d.at.copy(e.point)
    // The mini follows your hand while you drag it out of the ring.
    g.position.copy(ring.current.worldToLocal(e.point.clone()))
    if (d.at.distanceTo(d.start) > 0.08) aimDrop(e.point.toArray()) // guide slot / item under your hand glows
  }
  const up = () => {
    const d = drag.current
    drag.current = null
    slot.current?.position.set(...home)
    if (!d || !ring.current) return
    aimDrop(null)
    if (d.at.distanceTo(d.start) > 0.08) return void (dropOnto(entry.name, d.at.toArray()) || place(d.at)) // fill a slot / replace an item, else place
    // A poke: drop it just outside the ring, in the same direction, at working height.
    const out = ring.current.localToWorld(new Vector3(Math.sin(angle) * (RADIUS + 0.45), 0.2, -Math.cos(angle) * (RADIUS + 0.45)))
    place(out)
  }

  return (
    <group ref={slot} position={home} rotation={[0, -angle, 0]}>
      {/* Hit pad in front of the mini takes the pointer, so the live component inside never fires (no drum hits). */}
      <mesh
        position={[0, 0, 0.05]}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <boxGeometry args={[0.2, 0.24, 0.12]} />
        <meshBasicMaterial color={xr.accent} transparent opacity={hover ? 0.12 : 0.02} depthWrite={false} />
      </mesh>
      <group scale={hover ? 1.15 : 1}>
        {world ? (
          // A whole environment can't be shrunk into a slot: a lit globe stands in, solid when it's the active world.
          <mesh>
            <sphereGeometry args={[0.055, 32, 16]} />
            <meshStandardMaterial color={environment === entry.name ? xr.accent : "#3A4256"} emissive={xr.accent} emissiveIntensity={environment === entry.name ? 0.5 : 0.05} roughness={0.4} />
          </mesh>
        ) : (
          <SafeBoundary fallback={null}>
            <Suspense fallback={null}>
              <Mini name={entry.name} />
            </Suspense>
          </SafeBoundary>
        )}
      </group>
      <Label3D position={[0, -0.135, 0.02]} fontSize={0.02} color={hover ? xr.accent : xr.text} anchorY="top" maxWidth={0.2} textAlign="center">
        {entry.displayName}
      </Label3D>
    </group>
  )
}

const box = new Box3()
const size = new Vector3()
const center = new Vector3()

/** The real component, shrunk to fit MINI and made deaf to rays (the slot's pad handles input). */
function Mini({ name }: { name: string }) {
  const Component = components[name]
  const outer = useRef<Group>(null)
  const inner = useRef<Group>(null)
  const frames = useRef(0)
  // uikit and lazy children lay out over the first frames: re-measure for ~1.5 s, then stop.
  useFrame(() => {
    if (frames.current > 90 || !outer.current || !inner.current) return
    frames.current++
    if (frames.current % 10) return
    inner.current.traverse((o) => void (o.raycast = () => {}))
    outer.current.scale.setScalar(1)
    outer.current.updateWorldMatrix(true, true)
    box.setFromObject(inner.current)
    if (box.isEmpty()) return
    box.getSize(size)
    const s = MINI / Math.max(size.x, size.y, size.z, 1e-3)
    // Measured in world space; the slot is unscaled, so world size ≈ local size.
    // Centre in the unscaled outer frame, then shift the component so its middle sits on the slot.
    outer.current.worldToLocal(box.getCenter(center))
    inner.current.position.sub(center)
    outer.current.scale.setScalar(s)
  })
  if (!Component) return null
  return (
    <group ref={outer}>
      <group ref={inner}>
        <Component />
      </group>
    </group>
  )
}
