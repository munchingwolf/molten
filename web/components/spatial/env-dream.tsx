"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

type Props = { intensity?: number; tint?: string }

// Environment meshes never take pointer rays, so hands and rays reach the components.
const noRay = () => null

const HAZE = "#f6d6e4"
// three r155+ lights are physical; this factor keeps the legacy-light look.
const SUN = Math.PI
const PASTELS = ["#ffb3c7", "#b8a6ff", "#9fe7d2", "#ffd59e", "#a6d8ff", "#ffc4f0", "#c7f59e"]

type Item = { m: THREE.Matrix4; c?: THREE.Color }

/** Static instanced mesh: matrices (and optional colours) are written once. */
function Inst({ items, children }: { items: Item[]; children: ReactNode }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current!
    items.forEach((it, i) => {
      mesh.setMatrixAt(i, it.m)
      if (it.c) mesh.setColorAt(i, it.c)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} raycast={noRay}>
      {children}
    </instancedMesh>
  )
}

const mat = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0)),
    new THREE.Vector3(sx, sy, sz),
  )

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
// Cotton-candy sky: peach horizon, pink, lavender, then soft periwinkle overhead.
const SKY_FRAG = /* glsl */ `
uniform float uI; varying vec3 vDir;
void main() {
  float h = clamp(vDir.y, 0.0, 1.0);
  vec3 col = mix(vec3(1.0, 0.86, 0.76), vec3(1.0, 0.72, 0.84), smoothstep(0.0, 0.12, h));
  col = mix(col, vec3(0.78, 0.7, 1.0), smoothstep(0.1, 0.4, h));
  col = mix(col, vec3(0.6, 0.72, 1.0), smoothstep(0.4, 1.0, h));
  gl_FragColor = vec4(col * uI, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

type Floater = Item & { kind: number }

function build() {
  let s = 31
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
  const pal = PASTELS.map((c) => new THREE.Color(c))
  const near: Floater[] = []
  const far: Floater[] = []
  const hills: Item[] = []
  const clouds: Item[] = []
  // Floating shapes in two shells; each shell turns slowly as a whole.
  for (let i = 0; i < 70; i++) {
    const shell = i < 30 ? near : far
    const a = r() * Math.PI * 2
    const d = shell === near ? 9 + r() * 8 : 20 + r() * 25
    const y = shell === near ? 3 + r() * 6 : 5 + r() * 22
    const k = (shell === near ? 0.3 + r() * 0.6 : 0.8 + r() * 2.4) * (1 + r() * 0.3)
    shell.push({ m: mat(Math.sin(a) * d, y, Math.cos(a) * d, k, k, k, r() * 6, r() * 6), c: pal[Math.floor(r() * pal.length)], kind: Math.floor(r() * 4) })
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + r() * 0.2
    const d = 46 + r() * 20
    const w = 9 + r() * 6
    hills.push({ m: mat(Math.sin(a) * d, -w * 0.6, Math.cos(a) * d, w * 1.5, w, w * 1.5), c: pal[(i * 3) % pal.length].clone().lerp(new THREE.Color("#ffffff"), 0.35) })
  }
  for (let i = 0; i < 12; i++) {
    const a = r() * Math.PI * 2
    const d = 25 + r() * 40
    const y = 6 + r() * 26
    for (let k = 0; k < 4; k++) {
      const sc = 2 + r() * 2.5
      clouds.push({ m: mat(Math.sin(a) * d + (k - 1.5) * 2.6, y + r() * 1.2, Math.cos(a) * d + r() * 2, sc * 1.3, sc, sc) })
    }
  }
  return { near, far, hills, clouds }
}

/** Shapes split by kind so each kind is one instanced draw. */
function Shapes({ list }: { list: Floater[] }) {
  const by = useMemo(() => [0, 1, 2, 3].map((k) => list.filter((f) => f.kind === k)), [list])
  return (
    <>
      <Inst items={by[0]}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshLambertMaterial emissive="#ffffff" emissiveIntensity={0.06} />
      </Inst>
      <Inst items={by[1]}>
        <torusGeometry args={[0.8, 0.3, 12, 32]} />
        <meshLambertMaterial emissive="#ffffff" emissiveIntensity={0.06} />
      </Inst>
      <Inst items={by[2]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshLambertMaterial flatShading emissive="#ffffff" emissiveIntensity={0.06} />
      </Inst>
      <Inst items={by[3]}>
        <octahedronGeometry args={[1, 0]} />
        <meshLambertMaterial flatShading emissive="#ffffff" emissiveIntensity={0.06} />
      </Inst>
    </>
  )
}

/** Pastel dreamscape: cotton-candy sky, soft hills, a ringed planet and slow-turning floating shapes. */
export default function EnvDream({ intensity = 1, tint = "#fff3e8" }: Props) {
  const f = useMemo(build, [])
  const sky = useMemo(() => ({ uI: { value: 1 } }), [])
  sky.uI.value = 0.55 + 0.45 * intensity

  // Mint-to-lilac floor, lighter where the user stands.
  const ground = useMemo(() => {
    const g = new THREE.RingGeometry(0, 70, 64, 12)
    const p = g.attributes.position
    const centre = new THREE.Color("#f7d9ec")
    const mid = new THREE.Color("#a8e8d2")
    const edge = new THREE.Color("#c4b0ff")
    const c = new THREE.Color()
    const col = new Float32Array(p.count * 3)
    for (let i = 0; i < p.count; i++) {
      const d = Math.hypot(p.getX(i), p.getY(i))
      c.lerpColors(centre, mid, THREE.MathUtils.smoothstep(d, 3.5, 9)).lerp(edge, THREE.MathUtils.smoothstep(d, 14, 40))
      c.toArray(col, i * 3)
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3))
    return g
  }, [])
  useEffect(() => () => ground.dispose(), [ground])

  const nearRef = useRef<THREE.Group>(null)
  const farRef = useRef<THREE.Group>(null)
  const planet = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (nearRef.current) (nearRef.current.rotation.y = t * 0.02), (nearRef.current.position.y = Math.sin(t * 0.5) * 0.25)
    if (farRef.current) (farRef.current.rotation.y = -t * 0.008), (farRef.current.position.y = Math.sin(t * 0.3 + 1) * 0.6)
    if (planet.current) planet.current.rotation.y = t * 0.03
  })

  return (
    // Fragment root (not a group) so background/fog attach to the scene.
    <>
      <color attach="background" args={[HAZE]} />
      <fog attach="fog" args={[HAZE, 35, 120]} />
      <hemisphereLight args={["#fff0fb", "#a894e0", 0.7 * SUN * intensity]} />
      <directionalLight position={[10, 20, 8]} color={tint} intensity={0.9 * SUN * intensity} />

      <mesh scale={170} renderOrder={-1} raycast={noRay}>
        <sphereGeometry args={[1, 32, 16]} />
        <shaderMaterial uniforms={sky} vertexShader={SKY_VERT} fragmentShader={SKY_FRAG} side={THREE.BackSide} depthWrite={false} />
      </mesh>

      {/* ringed planet hanging over the horizon */}
      <group position={[-40, 42, -110]} rotation={[0.35, 0, 0.3]}>
        <group ref={planet}>
          <mesh raycast={noRay}>
            <sphereGeometry args={[14, 40, 24]} />
            <meshLambertMaterial color="#ffc9a8" emissive="#ff9fbf" emissiveIntensity={0.35} fog={false} />
          </mesh>
        </group>
        <mesh rotation-x={Math.PI / 2} raycast={noRay}>
          <ringGeometry args={[19, 27, 64]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.55} side={THREE.DoubleSide} fog={false} />
        </mesh>
      </group>

      <mesh geometry={ground} rotation-x={-Math.PI / 2} raycast={noRay}>
        <meshLambertMaterial vertexColors />
      </mesh>
      <Inst items={f.hills}>
        <sphereGeometry args={[1, 20, 12]} />
        <meshLambertMaterial />
      </Inst>
      <Inst items={f.clouds}>
        <sphereGeometry args={[1, 16, 10]} />
        <meshLambertMaterial color="#ffffff" emissive="#ffe6f2" emissiveIntensity={0.45} />
      </Inst>

      <group ref={nearRef}>
        <Shapes list={f.near} />
      </group>
      <group ref={farRef}>
        <Shapes list={f.far} />
      </group>
    </>
  )
}
