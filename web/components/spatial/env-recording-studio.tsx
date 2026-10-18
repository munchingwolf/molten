"use client"

// Furniture models: Kenney Furniture Kit (CC0, https://kenney.nl/assets/furniture-kit). See public/models/kenney/README.md.
import { Suspense, useLayoutEffect, useMemo, useRef, type ReactNode } from "react"
import { useGLTF } from "@react-three/drei"
import * as THREE from "three"

type Props = { intensity?: number; tint?: string }

// Environment meshes never take pointer rays, so hands and rays reach the components.
const noRay = () => null

const DIR = "/models/kenney/furniture/"
const MODELS = [
  "desk", "chairDesk", "computerScreen", "computerKeyboard", "speaker", "speakerSmall", "loungeSofaLong", "loungeDesignSofa",
  "rugRound", "rugRectangle", "bookcaseOpen", "bookcaseOpenLow", "books", "lampRoundFloor", "lampSquareFloor", "pottedPlant",
  "plantSmall1", "tableCoffee", "loungeDesignChair", "radio", "sideTable", "lampSquareTable", "laptop",
] as const
type ModelName = (typeof MODELS)[number]
MODELS.forEach((n) => useGLTF.preload(DIR + n + ".glb"))

// Kenney furniture is ~half real size; x2 makes a 0.76 m desk.
const K = 2
// Room: x -4.5..4.5, z -6..3.5, ceiling 3.2 m. The user stands at the origin facing -Z; x ±1.5, z 0..-3.6 stays clear.
const RX = 4.5
const ZF = -6
const ZB = 3.5
const H = 3.2

const mat = (x: number, y: number, z: number, ry = 0, s = K) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, s, s))
const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz))

type Part = { geometry: THREE.BufferGeometry; material: THREE.Material; local: THREE.Matrix4 }

/** One instanced mesh per GLTF primitive, so N copies of a model cost one draw call per primitive.
 *  Each model is re-based: centred on x/z, standing on y = 0. */
function Model({ name, at }: { name: ModelName; at: THREE.Matrix4[] }) {
  const { scene } = useGLTF(DIR + name + ".glb")
  const parts = useMemo(() => {
    scene.updateMatrixWorld(true)
    const b = new THREE.Box3().setFromObject(scene)
    const base = new THREE.Matrix4().makeTranslation(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2)
    const out: Part[] = []
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      // Kenney GLBs ship metallic materials; with no env map those render black, so make them matte.
      const material = (m.material as THREE.MeshStandardMaterial).clone()
      material.metalness = 0
      material.roughness = 0.85
      out.push({ geometry: m.geometry, material, local: base.clone().multiply(m.matrixWorld) })
    })
    return out
  }, [scene])
  return (
    <>
      {parts.map((p, i) => (
        <PartInst key={i} part={p} at={at} />
      ))}
    </>
  )
}

function PartInst({ part, at }: { part: Part; at: THREE.Matrix4[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current!
    const t = new THREE.Matrix4()
    at.forEach((m, i) => mesh.setMatrixAt(i, t.multiplyMatrices(m, part.local)))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [part, at])
  return <instancedMesh ref={ref} args={[part.geometry, part.material, at.length]} raycast={noRay} />
}

/** Static procedural boxes (walls, panels, traps) with optional per-instance colour. */
function Boxes({ items, colors, children }: { items: THREE.Matrix4[]; colors?: string[]; children: ReactNode }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current!
    const c = new THREE.Color()
    items.forEach((m, i) => {
      mesh.setMatrixAt(i, m)
      if (colors) mesh.setColorAt(i, c.set(colors[i % colors.length]))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items, colors])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} raycast={noRay}>
      <boxGeometry />
      {children}
    </instancedMesh>
  )
}

function layout() {
  const PI = Math.PI
  const deskTop = 0.38 * K
  const f: Partial<Record<ModelName, THREE.Matrix4[]>> = {
    // Mixing console on the front wall: two desks, three screens, nearfield monitors, mains on stands.
    desk: [mat(-0.74, 0, -5.55), mat(0.74, 0, -5.55)],
    chairDesk: [mat(0.1, 0, -4.55, PI + 0.25)],
    computerScreen: [mat(-0.8, deskTop, -5.75, 0.2), mat(0, deskTop, -5.8), mat(0.8, deskTop, -5.75, -0.2)],
    computerKeyboard: [mat(0, deskTop, -5.4)],
    laptop: [mat(-1.2, deskTop, -5.45, 0.4)],
    speakerSmall: [mat(-1.35, deskTop, -5.75, 0.3), mat(1.35, deskTop, -5.75, -0.3)],
    speaker: [mat(-2.3, 0, -5.5, 0.35), mat(2.3, 0, -5.5, -0.35), mat(-4.0, 0, 3.0, 2.4), mat(4.0, 0, 3.0, -2.4)],
    // Lounge on the right wall, facing into the room.
    loungeDesignSofa: [mat(4.05, 0, -1.4, -PI / 2)],
    loungeDesignChair: [mat(2.7, 0, -3.6, -2.3)],
    tableCoffee: [mat(3.2, 0, -1.4, PI / 2)],
    rugRectangle: [mat(3.3, 0, -1.4, PI / 2)],
    radio: [mat(3.15, 0.23 * K, -1.2, -PI / 2)],
    sideTable: [mat(4.15, 0, 0.2, -PI / 2)],
    lampSquareTable: [mat(4.15, 0.38 * K, 0.2)],
    // Back wall couch behind the user.
    loungeSofaLong: [mat(0, 0, 3.0, PI)],
    rugRound: [mat(0, 0, -1.6, 0, 2.6)],
    // Left wall: record shelves.
    bookcaseOpen: [mat(-4.2, 0, -2.6, PI / 2), mat(-4.2, 0, -1.7, PI / 2), mat(-4.2, 0, 1.4, PI / 2)],
    bookcaseOpenLow: [mat(-4.2, 0, -0.8, PI / 2), mat(-4.2, 0, 0.1, PI / 2)],
    books: [
      mat(-4.2, 0.4 * K, -0.8, PI / 2), mat(-4.2, 0.4 * K, 0.15, PI / 2 + 0.2),
      ...[-2.6, -1.7, 1.4].flatMap((z) => [0.02, 0.3, 0.58].flatMap((y) => [mat(-4.2, y * K, z - 0.18, PI / 2), mat(-4.2, y * K, z + 0.16, PI / 2)])),
    ],
    lampRoundFloor: [mat(-4.0, 0, -4.6), mat(3.9, 0, -2.9)],
    lampSquareFloor: [mat(-1.3, 0, 3.1), mat(1.4, 0, 3.1)],
    pottedPlant: [mat(-4.0, 0, -5.5), mat(4.0, 0, -5.5), mat(-4.0, 0, 2.8, 1), mat(3.9, 0, 1.4, 2)],
    plantSmall1: [mat(1.9, deskTop, -5.75), mat(-4.2, 0.88 * K, -2.6)],
  }
  return f
}

function shell() {
  // Acoustic panels: 1.2 x 0.6 m tiles, 4 cm proud of the walls, two rows.
  const panels: THREE.Matrix4[] = []
  for (let i = 0; i < 6; i++) {
    const z = -5 + i * 1.45
    for (const y of [1.35, 2.15]) {
      panels.push(box(-RX + 0.03, y, z, 0.06, 0.7, 1.25))
      panels.push(box(RX - 0.03, y, z, 0.06, 0.7, 1.25))
    }
  }
  for (let i = 0; i < 6; i++) for (const y of [1.55, 2.35]) panels.push(box(-3.75 + i * 1.5, y, ZB - 0.03, 1.3, 0.7, 0.06))
  // Front wall: slatted diffuser over the console, panels either side.
  for (let i = 0; i < 15; i++) panels.push(box(-2.1 + i * 0.3, 2.15, ZF + 0.06, 0.18, 1.3, 0.12 + (i % 3) * 0.06))
  for (const x of [-3.5, 3.5]) for (const y of [1.2, 2.1]) panels.push(box(x, y, ZF + 0.03, 1.3, 0.75, 0.06))
  // Corner bass traps and ceiling clouds.
  const traps = [box(-RX + 0.3, H / 2, ZF + 0.3, 0.6, H, 0.6), box(RX - 0.3, H / 2, ZF + 0.3, 0.6, H, 0.6), box(-RX + 0.3, H / 2, ZB - 0.3, 0.6, H, 0.6), box(RX - 0.3, H / 2, ZB - 0.3, 0.6, H, 0.6)]
  const clouds = [box(0, H - 0.25, -3, 2.6, 0.1, 2.2), box(0, H - 0.25, 0.6, 2.6, 0.1, 2.2), box(-2.8, H - 0.25, -1.2, 1.6, 0.1, 3.6), box(2.8, H - 0.25, -1.2, 1.6, 0.1, 3.6)]
  // Warm light strips along the ceiling edges.
  const strips = [box(-RX + 0.1, H - 0.08, -1.25, 0.05, 0.05, 8.5), box(RX - 0.1, H - 0.08, -1.25, 0.05, 0.05, 8.5), box(0, H - 0.08, ZF + 0.1, 8.6, 0.05, 0.05), box(0, 0.06, ZF + 0.6, 2.9, 0.03, 0.03)]
  return { panels, traps, clouds, strips }
}

const PANEL_COLORS = ["#6b4a3c", "#7a3a32", "#3f5250", "#6a5440"]

/** Warm music recording room: mixing desk with monitors, acoustic panels, shelves, lounge and ceiling clouds. */
export default function EnvRecordingStudio({ intensity = 1, tint = "#ffb974" }: Props) {
  const f = useMemo(layout, [])
  const s = useMemo(shell, [])
  const L = intensity

  return (
    <group>
      <color attach="background" args={["#16110e"]} />
      <hemisphereLight args={["#ffe2c4", "#4a3426", 1.4 * L]} />
      <ambientLight color="#ffd9b0" intensity={0.25 * L} />
      <pointLight position={[0, 2.3, -1.5]} color={tint} intensity={7 * L} distance={12} decay={1.6} />
      <pointLight position={[0, 2.6, -5]} color={tint} intensity={6 * L} distance={7} decay={2} />
      <pointLight position={[3.4, 2.4, -1.4]} color="#ff9f5a" intensity={5 * L} distance={6} decay={2} />
      <pointLight position={[-3.4, 2.4, -0.5]} color="#ffcf9a" intensity={5 * L} distance={6} decay={2} />

      {/* Floor, ceiling, walls (planes facing inward). */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, (ZF + ZB) / 2]} raycast={noRay}>
        <planeGeometry args={[RX * 2, ZB - ZF]} />
        <meshStandardMaterial color="#6b4a33" roughness={0.75} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, H, (ZF + ZB) / 2]} raycast={noRay}>
        <planeGeometry args={[RX * 2, ZB - ZF]} />
        <meshStandardMaterial color="#1d1a18" roughness={1} />
      </mesh>
      {(
        [
          [[0, H / 2, ZF], 0, RX * 2],
          [[0, H / 2, ZB], Math.PI, RX * 2],
          [[-RX, H / 2, (ZF + ZB) / 2], Math.PI / 2, ZB - ZF],
          [[RX, H / 2, (ZF + ZB) / 2], -Math.PI / 2, ZB - ZF],
        ] as [[number, number, number], number, number][]
      ).map(([p, ry, w], i) => (
        <mesh key={i} position={p} rotation-y={ry} raycast={noRay}>
          <planeGeometry args={[w, H]} />
          <meshStandardMaterial color="#7a6a5c" roughness={0.95} />
        </mesh>
      ))}
      {/* Skirting. */}
      <Boxes items={[box(0, 0.06, ZF + 0.01, RX * 2, 0.12, 0.03), box(0, 0.06, ZB - 0.01, RX * 2, 0.12, 0.03), box(-RX + 0.01, 0.06, -1.25, 0.03, 0.12, 9.5), box(RX - 0.01, 0.06, -1.25, 0.03, 0.12, 9.5)]}>
        <meshStandardMaterial color="#2a211c" />
      </Boxes>

      <Boxes items={s.panels} colors={PANEL_COLORS}>
        <meshStandardMaterial roughness={1} />
      </Boxes>
      <Boxes items={s.traps}>
        <meshStandardMaterial color="#2b2522" roughness={1} />
      </Boxes>
      <Boxes items={s.clouds}>
        <meshStandardMaterial color="#a8988a" roughness={1} />
      </Boxes>
      <Boxes items={s.strips}>
        <meshBasicMaterial color={tint} toneMapped={false} />
      </Boxes>

      <Suspense fallback={null}>
        {(Object.keys(f) as ModelName[]).map((n) => (
          <Model key={n} name={n} at={f[n]!} />
        ))}
      </Suspense>
    </group>
  )
}
