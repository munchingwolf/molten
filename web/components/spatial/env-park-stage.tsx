"use client"

// Trees, rocks, grass and flowers: Kenney Nature Kit (CC0, https://kenney.nl/assets/nature-kit). See public/models/kenney/README.md.
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react"
import { useGLTF } from "@react-three/drei"
import * as THREE from "three"

type Props = { intensity?: number; tint?: string }

// Environment meshes never take pointer rays, so hands and rays reach the components.
const noRay = () => null

const DIR = "/models/kenney/nature/"
const MODELS = [
  "tree_default", "tree_detailed", "tree_oak", "tree_fat", "tree_pineRoundA", "tree_cone", "plant_bushLarge", "plant_bush",
  "grass_large", "grass", "flower_redA", "flower_yellowA", "flower_purpleA", "rock_largeA", "rock_tallA", "log_large", "stump_round",
] as const
type ModelName = (typeof MODELS)[number]
MODELS.forEach((n) => useGLTF.preload(DIR + n + ".glb"))

const HORIZON = "#f3dcc0"
const SKY_TOP = "#4f86c6"
// Stage front edge sits 10 m in front of the user (who faces -Z from the origin).
const STAGE_Z = -10
const STAGE_D = 6
const STAGE_W = 11

const mat = (x: number, y: number, z: number, ry = 0, s = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, s, s))
const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz))

// Speaker cone: a flat cylinder turned to face the audience (+Z).
const disc = (x: number, y: number, z: number, d: number) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), new THREE.Vector3(d, 1, d))

type Part = { geometry: THREE.BufferGeometry; material: THREE.Material; local: THREE.Matrix4 }

/** One instanced mesh per GLTF primitive (one draw call per primitive for all copies), re-based to stand centred on y = 0. */
function Model({ name, at }: { name: ModelName; at: THREE.Matrix4[] }) {
  const { scene } = useGLTF(DIR + name + ".glb")
  const parts = useMemo(() => {
    scene.updateMatrixWorld(true)
    const b = new THREE.Box3().setFromObject(scene)
    const base = new THREE.Matrix4().makeTranslation(-(b.min.x + b.max.x) / 2, -b.min.y - 0.03, -(b.min.z + b.max.z) / 2)
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

function Boxes({ items, children }: { items: THREE.Matrix4[]; children: ReactNode }) {
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

function buildPark() {
  let seed = 11
  const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  const f: Record<ModelName, THREE.Matrix4[]> = Object.fromEntries(MODELS.map((n) => [n, []])) as never
  // Keep clear: the user's 3 m work area, the lawn between user and stage, and the stage itself.
  const blocked = (x: number, z: number, pad = 0) =>
    (Math.abs(x) < 2.5 + pad && z > -4 - pad && z < 2 + pad) || (Math.abs(x) < 8 + pad && z < -2 + pad && z > STAGE_Z - STAGE_D - 3 - pad)
  const scatter = (names: ModelName[], n: number, min: number, max: number, smin: number, smax: number, pad = 0) => {
    for (let i = 0, tries = 0; i < n && tries < n * 20; tries++) {
      const a = r() * Math.PI * 2
      const d = min + Math.sqrt(r()) * (max - min)
      const x = Math.sin(a) * d
      const z = Math.cos(a) * d
      if (blocked(x, z, pad)) continue
      f[names[Math.floor(r() * names.length)]].push(mat(x, 0, z, r() * 6.28, smin + r() * (smax - smin)))
      i++
    }
  }
  scatter(["tree_default", "tree_detailed", "tree_oak", "tree_fat", "tree_pineRoundA", "tree_cone"], 70, 14, 42, 3.6, 5.6, 4)
  scatter(["tree_default", "tree_oak", "tree_detailed"], 10, 9, 14, 3.4, 4.6, 3)
  scatter(["plant_bushLarge", "plant_bush"], 40, 6, 22, 2.5, 4, 1)
  scatter(["grass_large", "grass"], 160, 3, 24, 1.8, 3)
  scatter(["flower_redA", "flower_yellowA", "flower_purpleA"], 110, 3, 18, 1.6, 2.4)
  scatter(["rock_largeA", "rock_tallA"], 12, 8, 28, 1.2, 2.4, 2)
  // Log benches on the lawn, angled at the stage.
  for (const [x, z] of [[-5, 2.5], [5, 2.5], [-6.5, -1], [6.5, -1]]) f.log_large.push(mat(x, 0, z, Math.atan2(x, z - STAGE_Z) + Math.PI / 2, 1.8))
  f.stump_round.push(mat(-3.4, 0, 4, 0, 2), mat(3.6, 0, 4.4, 1, 2))
  // Shrubs flanking the stage.
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) f.plant_bushLarge.push(mat(sx * (STAGE_W / 2 + 0.8 + i * 0.9), 0, STAGE_Z - 0.5 - i * 1.6, i, 3.4))

  const hills: THREE.Matrix4[] = []
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + r() * 0.3
    const d = 70 + r() * 15
    const w = 22 + r() * 12
    const h = 10 + r() * 12
    hills.push(new THREE.Matrix4().compose(new THREE.Vector3(Math.sin(a) * d, h / 2 - 1, Math.cos(a) * d), new THREE.Quaternion(), new THREE.Vector3(w, h, w)))
  }
  const clouds: THREE.Matrix4[] = []
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2
    const d = 60 + r() * 30
    const y = 28 + r() * 12
    for (let k = 0; k < 3; k++) {
      const sc = 3 + r() * 3
      clouds.push(new THREE.Matrix4().compose(new THREE.Vector3(Math.sin(a) * d + (k - 1) * 4.5, y + r() * 1.5, Math.cos(a) * d + r() * 2), new THREE.Quaternion(), new THREE.Vector3(sc * 1.5, sc * 0.8, sc)))
    }
  }
  return { f, hills, clouds }
}

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const SKY_FRAG = /* glsl */ `
uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSunDir; varying vec3 vDir;
void main() {
  vec3 c = mix(uHorizon, uTop, pow(clamp(vDir.y, 0.0, 1.0), 0.55));
  c += vec3(1.0, 0.85, 0.6) * pow(max(dot(normalize(vDir), uSunDir), 0.0), 64.0) * 0.8;
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

const SUN = new THREE.Vector3(10, 14, 12)

/** Outdoor park concert: band shell and stage 10 m ahead, PA stacks, light truss, Kenney trees and flowers, gradient sky. */
export default function EnvParkStage({ intensity = 1, tint = "#fff1d6" }: Props) {
  const p = useMemo(buildPark, [])
  const sky = useMemo(() => ({ uTop: { value: new THREE.Color(SKY_TOP) }, uHorizon: { value: new THREE.Color(HORIZON) }, uSunDir: { value: SUN.clone().normalize() } }), [])
  const L = intensity

  const ground = useMemo(() => {
    const g = new THREE.CircleGeometry(95, 64, 0, Math.PI * 2)
    const pos = g.attributes.position
    const light = new THREE.Color("#7fb35a")
    const dark = new THREE.Color("#4e8a3e")
    const c = new THREE.Color()
    const col = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      c.lerpColors(light, dark, THREE.MathUtils.smoothstep(Math.hypot(pos.getX(i), pos.getY(i)), 8, 40))
      c.toArray(col, i * 3)
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3))
    return g
  }, [])
  useEffect(() => () => ground.dispose(), [ground])

  const sz = STAGE_Z - STAGE_D / 2
  const back = STAGE_Z - STAGE_D
  return (
    <group>
      <color attach="background" args={[HORIZON]} />
      <fog attach="fog" args={[HORIZON, 30, 110]} />
      <hemisphereLight args={["#cfe6ff", "#5b7a3a", 1.4 * L]} />
      <directionalLight position={SUN.toArray()} color={tint} intensity={2.6 * L} />
      {/* Stage wash so the shell reads warm even with the sun behind the viewer. */}
      <pointLight position={[0, 5.5, STAGE_Z - 1]} color="#ffc98a" intensity={30 * L} distance={14} decay={2} />

      <mesh scale={150} renderOrder={-1} raycast={noRay}>
        <sphereGeometry args={[1, 32, 16]} />
        <shaderMaterial uniforms={sky} vertexShader={SKY_VERT} fragmentShader={SKY_FRAG} side={THREE.BackSide} depthWrite={false} fog={false} />
      </mesh>
      <mesh geometry={ground} rotation-x={-Math.PI / 2} raycast={noRay}>
        <meshLambertMaterial vertexColors />
      </mesh>
      {/* Gravel apron in front of the stage. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, STAGE_Z + 2]} raycast={noRay}>
        <circleGeometry args={[5.5, 40, Math.PI, Math.PI]} />
        <meshLambertMaterial color="#a9b77f" />
      </mesh>

      {/* Stage deck, skirt and front steps. */}
      <mesh position={[0, 0.5, sz]} raycast={noRay}>
        <boxGeometry args={[STAGE_W, 1, STAGE_D]} />
        <meshStandardMaterial color="#5d3f2b" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.005, sz]} raycast={noRay}>
        <boxGeometry args={[STAGE_W - 0.2, 0.02, STAGE_D - 0.2]} />
        <meshStandardMaterial color="#8a6544" roughness={0.7} />
      </mesh>
      <Boxes items={[box(0, 0.17, STAGE_Z + 0.45, 2.6, 0.34, 0.9), box(0, 0.5, STAGE_Z + 0.15, 2.6, 0.34, 0.3)]}>
        <boxGeometry />
        <meshStandardMaterial color="#7a5638" />
      </Boxes>

      {/* Band shell: half dome with stepped ribs, opening toward the audience. */}
      <mesh position={[0, 1, back + 0.3]} raycast={noRay}>
        <sphereGeometry args={[5.6, 32, 12, Math.PI, Math.PI, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#f4ecdf" roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      {[6.0, 6.5, 7.0].map((rad, i) => (
        <mesh key={rad} position={[0, 1, back + 0.3 + 0.9 + i * 0.7]} raycast={noRay}>
          <torusGeometry args={[rad, 0.22, 6, 40, Math.PI]} />
          <meshStandardMaterial color={i === 2 ? "#c2442f" : "#ece2d2"} roughness={0.6} />
        </mesh>
      ))}

      {/* Drum riser and backline. */}
      <Boxes items={[box(0, 1.2, back + 1.7, 3, 0.4, 2), box(-3.2, 1.45, back + 1.9, 1, 0.9, 0.5), box(3.2, 1.45, back + 1.9, 1, 0.9, 0.5), box(-1.3, 1.3, back + 3.8, 0.6, 0.6, 0.4)]}>
        <boxGeometry />
        <meshStandardMaterial color="#26221f" roughness={0.6} />
      </Boxes>
      {/* PA stacks either side of the stage. */}
      <Boxes items={[-1, 1].flatMap((sx) => [box(sx * 6.6, 0.75, STAGE_Z - 0.6, 1.3, 1.5, 1.1), box(sx * 6.6, 2.15, STAGE_Z - 0.6, 1.2, 1.3, 1.0), box(sx * 6.6, 3.25, STAGE_Z - 0.6, 1.0, 0.9, 0.9)])}>
        <boxGeometry />
        <meshStandardMaterial color="#1b1a19" roughness={0.5} />
      </Boxes>
      <Boxes items={[-1, 1].flatMap((sx) => [disc(sx * 6.6, 0.75, STAGE_Z - 0.04, 0.9), disc(sx * 6.6, 2.15, STAGE_Z - 0.09, 0.8), disc(sx * 6.6, 3.25, STAGE_Z - 0.14, 0.55)])}>
        <cylinderGeometry args={[0.5, 0.5, 0.02, 20]} />
        <meshStandardMaterial color="#3a3836" roughness={0.4} />
      </Boxes>

      {/* Light truss on two towers, with warm and tinted cans. */}
      <Boxes items={[box(-5.9, 3.5, STAGE_Z - 0.3, 0.25, 7, 0.25), box(5.9, 3.5, STAGE_Z - 0.3, 0.25, 7, 0.25), box(0, 6.9, STAGE_Z - 0.3, 12, 0.3, 0.3)]}>
        <boxGeometry />
        <meshStandardMaterial color="#9aa0a6" metalness={0.6} roughness={0.4} />
      </Boxes>
      {[-4.5, -2.7, -0.9, 0.9, 2.7, 4.5].map((x, i) => (
        <mesh key={x} position={[x, 6.6, STAGE_Z - 0.3]} rotation-x={0.5} raycast={noRay}>
          <cylinderGeometry args={[0.18, 0.24, 0.45, 12]} />
          <meshBasicMaterial color={["#ffcf80", "#ff6f91", "#7fd8ff"][i % 3]} toneMapped={false} />
        </mesh>
      ))}

      <Boxes items={p.hills}>
        <coneGeometry args={[1, 1, 7]} />
        <meshLambertMaterial color="#6f9a7a" flatShading />
      </Boxes>
      <Boxes items={p.clouds}>
        <icosahedronGeometry args={[1, 1]} />
        <meshLambertMaterial color="#ffffff" emissive="#c9d6e6" emissiveIntensity={0.45} flatShading fog={false} />
      </Boxes>

      <Suspense fallback={null}>
        {MODELS.filter((n) => p.f[n].length).map((n) => (
          <Model key={n} name={n} at={p.f[n]} />
        ))}
      </Suspense>
    </group>
  )
}
