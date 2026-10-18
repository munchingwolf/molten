"use client"

// Orchestra chairs, music speakers and plants: Kenney Furniture Kit (CC0, https://kenney.nl/assets/furniture-kit). See public/models/kenney/README.md.
import { Suspense, useLayoutEffect, useMemo, useRef, type ReactNode } from "react"
import { useGLTF } from "@react-three/drei"
import * as THREE from "three"

type Props = { intensity?: number; tint?: string }

// Environment meshes never take pointer rays, so hands and rays reach the components.
const noRay = () => null

const DIR = "/models/kenney/furniture/"
const MODELS = ["chairCushion", "pottedPlant", "speaker", "stoolBar"] as const
type ModelName = (typeof MODELS)[number]
MODELS.forEach((n) => useGLTF.preload(DIR + n + ".glb"))

// Hall: x ±11, z -17 (stage back) .. +14, ceiling 10 m. User at the origin faces the stage (-Z); x ±1.5, z 0..-3.6 stays clear.
const W = 11
const ZF = -17
const ZB = 14
const H = 10
const STAGE_Z = -8 // stage front edge
const STAGE_H = 1.1

const mat = (x: number, y: number, z: number, ry = 0, s = 2) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, s, s))
const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz))

type Part = { geometry: THREE.BufferGeometry; material: THREE.Material; local: THREE.Matrix4 }

/** One instanced mesh per GLTF primitive (one draw call per primitive for all copies), re-based to stand centred on y = 0. */
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

function Inst({ items, children }: { items: THREE.Matrix4[]; children: ReactNode }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current!
    items.forEach((m, i) => mesh.setMatrixAt(i, m))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} raycast={noRay}>
      {children}
    </instancedMesh>
  )
}

function buildHall() {
  const seats: THREE.Matrix4[] = []
  const backs: THREE.Matrix4[] = []
  const risers: THREE.Matrix4[] = []
  const row = (y: number, z: number, xs: number[], ry = 0) => {
    for (const x of xs) {
      seats.push(box(x, y + 0.45, z, 0.52, 0.12, 0.5, ry))
      backs.push(box(x + Math.sin(ry) * 0.24, y + 0.75, z + Math.cos(ry) * 0.24, 0.52, 0.65, 0.1, ry))
    }
  }
  const span = (a: number, b: number) => Array.from({ length: Math.round((b - a) / 0.6) + 1 }, (_, i) => a + i * 0.6)
  // Stalls behind the user, raked 15 cm per row, centre aisle.
  for (let i = 0; i < 10; i++) {
    const z = 2.4 + i * 1.0
    const y = i * 0.15
    if (i > 0) risers.push(box(0, y / 2, z, W * 2 - 1, y, 1.0))
    row(y, z, [...span(-9.6, -1.2), ...span(1.2, 9.6)])
  }
  // Front side blocks, angled toward the stage, leaving the user's work area open.
  for (let i = 0; i < 5; i++) {
    const z = -1 - i * 1.0
    row(0, z, span(-9.6, -4.8), 0.18)
    row(0, z, span(4.8, 9.6), -0.18)
  }
  // Balcony rows.
  for (let i = 0; i < 3; i++) row(4.6 + i * 0.3, 10.2 + i * 1.0, [...span(-9.6, -1.2), ...span(1.2, 9.6)])

  const columns: THREE.Matrix4[] = []
  const capitals: THREE.Matrix4[] = []
  for (let z = -6; z <= 12; z += 4.5)
    for (const sx of [-1, 1]) {
      columns.push(box(sx * (W - 0.5), H / 2, z, 0.7, H, 0.7))
      capitals.push(box(sx * (W - 0.5), H - 0.6, z, 1.0, 0.3, 1.0), box(sx * (W - 0.5), 0.15, z, 1.0, 0.3, 1.0))
    }
  // Coffered ceiling beams.
  const beams: THREE.Matrix4[] = []
  for (let z = ZF + 9; z < ZB; z += 3) beams.push(box(0, H - 0.25, z, W * 2, 0.5, 0.35))
  for (let x = -W + 3.7; x < W; x += 3.7) beams.push(box(x, H - 0.25, (ZF + 9 + ZB) / 2, 0.35, 0.5, ZB - ZF - 9))
  // Wall sconces between the columns.
  const sconces: THREE.Matrix4[] = []
  for (let z = -3.75; z <= 12; z += 4.5) for (const sx of [-1, 1]) sconces.push(box(sx * (W - 0.08), 3.2, z, 0.12, 0.45, 0.25))

  // Orchestra chairs in arcs on stage, facing the audience.
  const chairs: THREE.Matrix4[] = []
  for (const [rad, n] of [[3.4, 7], [4.8, 9], [6.2, 11]] as const)
    for (let i = 0; i < n; i++) {
      const a = (i / (n - 1) - 0.5) * 2.0
      chairs.push(mat(Math.sin(a) * rad, STAGE_H, STAGE_Z - 7.4 + Math.cos(a) * rad, a))
    }
  return { seats, backs, risers, columns, capitals, beams, sconces, chairs }
}

/** Grand concert hall: proscenium stage with orchestra chairs, raked velvet seating, balcony, columns, coffered ceiling and warm stage light. */
export default function EnvMusicHall({ intensity = 1, tint = "#ffd29a" }: Props) {
  const h = useMemo(buildHall, [])
  const L = intensity
  const stageDepth = STAGE_Z - ZF
  const target = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(0, STAGE_H, STAGE_Z - 4)
    return o
  }, [])

  const models: Record<ModelName, THREE.Matrix4[]> = {
    chairCushion: h.chairs,
    pottedPlant: [mat(-7.4, STAGE_H, STAGE_Z - 0.6, 0, 3), mat(7.4, STAGE_H, STAGE_Z - 0.6, 0, 3)],
    speaker: [mat(-8.6, STAGE_H, STAGE_Z - 1.2, 0.3, 3), mat(8.6, STAGE_H, STAGE_Z - 1.2, -0.3, 3)],
    stoolBar: [mat(0, STAGE_H, STAGE_Z - 3.2, 0, 2.2)],
  }

  return (
    <group>
      <color attach="background" args={["#120a08"]} />
      <hemisphereLight args={["#ffdcb8", "#4a261c", 1.5 * L]} />
      <primitive object={target} />
      <spotLight position={[0, 8.5, -1]} target={target} color={tint} intensity={260 * L} angle={0.55} penumbra={0.6} distance={30} decay={2} />
      <pointLight position={[0, 6, STAGE_Z - 5]} color="#ffb877" intensity={40 * L} distance={18} decay={2} />
      <pointLight position={[0, 7.5, 6]} color="#ffd9a8" intensity={60 * L} distance={22} decay={1.8} />
      <pointLight position={[0, 7.5, -3]} color="#ffd9a8" intensity={45 * L} distance={18} decay={1.8} />

      {/* Floor, ceiling and the four walls. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, (ZF + ZB) / 2]} raycast={noRay}>
        <planeGeometry args={[W * 2, ZB - ZF]} />
        <meshStandardMaterial color="#5a3424" roughness={0.7} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, H, (ZF + ZB) / 2]} raycast={noRay}>
        <planeGeometry args={[W * 2, ZB - ZF]} />
        <meshStandardMaterial color="#8a6a50" roughness={0.9} />
      </mesh>
      {(
        [
          [[0, H / 2, ZF], 0, W * 2, "#2a1612"],
          [[0, H / 2, ZB], Math.PI, W * 2, "#6e2a24"],
          [[-W, H / 2, (ZF + ZB) / 2], Math.PI / 2, ZB - ZF, "#6e2a24"],
          [[W, H / 2, (ZF + ZB) / 2], -Math.PI / 2, ZB - ZF, "#6e2a24"],
        ] as [[number, number, number], number, number, string][]
      ).map(([p, ry, w, c], i) => (
        <mesh key={i} position={p} rotation-y={ry} raycast={noRay}>
          <planeGeometry args={[w, H]} />
          <meshStandardMaterial color={c} roughness={0.9} />
        </mesh>
      ))}
      {/* Wood wainscot band around the hall. */}
      <Inst items={[box(-W + 0.05, 1.1, (ZF + ZB) / 2, 0.1, 2.2, ZB - ZF), box(W - 0.05, 1.1, (ZF + ZB) / 2, 0.1, 2.2, ZB - ZF), box(0, 1.1, ZB - 0.05, W * 2, 2.2, 0.1)]}>
        <boxGeometry />
        <meshStandardMaterial color="#6b3f26" roughness={0.6} />
      </Inst>

      {/* Stage deck, apron lip and proscenium arch with curtains. */}
      <mesh position={[0, STAGE_H / 2, (STAGE_Z + ZF) / 2]} raycast={noRay}>
        <boxGeometry args={[W * 2, STAGE_H, stageDepth]} />
        <meshStandardMaterial color="#7a4a2a" roughness={0.55} />
      </mesh>
      <mesh position={[0, STAGE_H / 2, STAGE_Z + 0.02]} raycast={noRay}>
        <boxGeometry args={[W * 2, STAGE_H, 0.06]} />
        <meshStandardMaterial color="#2a1510" roughness={0.8} />
      </mesh>
      <Inst items={[box(-8.2, H / 2, STAGE_Z - 0.4, 2.2, H, 0.8), box(8.2, H / 2, STAGE_Z - 0.4, 2.2, H, 0.8), box(0, H - 1.2, STAGE_Z - 0.4, W * 2, 2.4, 0.8)]}>
        <boxGeometry />
        <meshStandardMaterial color="#7b5a3a" roughness={0.6} />
      </Inst>
      <Inst items={[box(-7.1, 7.2, STAGE_Z - 0.02, 0.15, 0.15, 0.1), box(0, 7.55, STAGE_Z - 0.02, 14.4, 0.12, 0.1), box(-7.1, 3.8, STAGE_Z - 0.02, 0.12, 7, 0.1), box(7.1, 3.8, STAGE_Z - 0.02, 0.12, 7, 0.1)]}>
        <boxGeometry />
        <meshStandardMaterial color="#d8a94a" metalness={0.7} roughness={0.35} />
      </Inst>
      <Inst items={[box(-6.4, 4.0, STAGE_Z - 1.0, 1.3, 6.4, 0.25, 0.1), box(6.4, 4.0, STAGE_Z - 1.0, 1.3, 6.4, 0.25, -0.1), box(0, 6.9, STAGE_Z - 1.1, 14, 1.1, 0.25)]}>
        <boxGeometry />
        <meshStandardMaterial color="#8e1c22" roughness={0.85} />
      </Inst>
      {/* Acoustic shell panels behind the orchestra. */}
      <Inst items={[-1, -0.5, 0, 0.5, 1].map((t) => box(Math.sin(t) * 7, 3.6, ZF + 2.4 - Math.cos(t) * 1.5 + 1.5, 3.4, 5, 0.2, -t))}>
        <boxGeometry />
        <meshStandardMaterial color="#b98a5e" roughness={0.5} />
      </Inst>

      {/* Velvet seating. */}
      <Inst items={h.seats}>
        <boxGeometry />
        <meshStandardMaterial color="#9c1f2a" roughness={0.9} />
      </Inst>
      <Inst items={h.backs}>
        <boxGeometry />
        <meshStandardMaterial color="#7d1822" roughness={0.9} />
      </Inst>
      <Inst items={h.risers}>
        <boxGeometry />
        <meshStandardMaterial color="#4a2a1e" roughness={0.8} />
      </Inst>

      {/* Balcony slab with a gilded rail. */}
      <mesh position={[0, 4.3, 11.6]} raycast={noRay}>
        <boxGeometry args={[W * 2, 0.5, 4.8]} />
        <meshStandardMaterial color="#5e2e22" roughness={0.8} />
      </mesh>
      <Inst items={[box(0, 4.95, 9.25, W * 2, 0.8, 0.12), box(0, 5.38, 9.25, W * 2, 0.08, 0.2)]}>
        <boxGeometry />
        <meshStandardMaterial color="#d8a94a" metalness={0.6} roughness={0.4} />
      </Inst>

      <Inst items={h.columns}>
        <cylinderGeometry args={[0.5, 0.5, 1, 14]} />
        <meshStandardMaterial color="#e6d6bc" roughness={0.6} />
      </Inst>
      <Inst items={h.capitals}>
        <boxGeometry />
        <meshStandardMaterial color="#d8a94a" metalness={0.5} roughness={0.4} />
      </Inst>
      <Inst items={h.beams}>
        <boxGeometry />
        <meshStandardMaterial color="#6e4a32" roughness={0.7} />
      </Inst>
      <Inst items={h.sconces}>
        <boxGeometry />
        <meshBasicMaterial color="#ffd49a" toneMapped={false} />
      </Inst>
      {/* Chandeliers. */}
      {[-3, 6].map((z) => (
        <group key={z} position={[0, 8.2, z]}>
          <mesh raycast={noRay}>
            <icosahedronGeometry args={[0.7, 1]} />
            <meshBasicMaterial color="#ffe2b0" toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.9, 0]} raycast={noRay}>
            <cylinderGeometry args={[0.03, 0.03, 1.6, 6]} />
            <meshStandardMaterial color="#d8a94a" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ))}

      <Suspense fallback={null}>
        {MODELS.map((n) => (
          <Model key={n} name={n} at={models[n]} />
        ))}
      </Suspense>
    </group>
  )
}
