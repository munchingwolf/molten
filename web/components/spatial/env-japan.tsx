"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

type Props = { intensity?: number; tint?: string }

// Environment meshes never take pointer rays, so hands and rays reach the components.
const noRay = () => null

const HORIZON = "#f4a37c"
// three r155+ lights are physical; these factors keep the legacy-light look.
const SUN = Math.PI
const POINT = Math.PI * 2

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

const mat = (x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, rz, "YXZ")),
    new THREE.Vector3(sx, sy, sz),
  )

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
// Dusk: peach horizon, rose band, indigo zenith, a soft low sun behind the gate.
const SKY_FRAG = /* glsl */ `
uniform float uI; varying vec3 vDir;
void main() {
  float h = clamp(vDir.y, 0.0, 1.0);
  vec3 col = mix(vec3(0.98, 0.66, 0.46), vec3(0.85, 0.45, 0.58), smoothstep(0.0, 0.15, h));
  col = mix(col, vec3(0.32, 0.27, 0.52), smoothstep(0.12, 0.45, h));
  col = mix(col, vec3(0.12, 0.12, 0.3), smoothstep(0.45, 1.0, h));
  float d = distance(vDir, normalize(vec3(0.25, 0.07, -1.0)));
  col += vec3(1.0, 0.75, 0.45) * (exp(-d * 9.0) * 0.6 + (1.0 - smoothstep(0.045, 0.05, d)) * 0.8);
  gl_FragColor = vec4(col * uI, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

// Falling petals: positions loop downward in the vertex shader, so no per-frame CPU work.
const PETAL_VERT = /* glsl */ `
uniform float uTime; attribute float aSeed; varying float vA;
void main() {
  vec3 p = position;
  p.y = mod(p.y - uTime * (0.35 + aSeed * 0.3), 7.0);
  p.x += sin(uTime * 0.8 + aSeed * 20.0) * 0.6;
  p.z += cos(uTime * 0.6 + aSeed * 13.0) * 0.4;
  vA = smoothstep(0.0, 0.6, p.y) * (1.0 - smoothstep(5.5, 7.0, p.y));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = 70.0 / -mv.z;
  gl_Position = projectionMatrix * mv;
}`
const PETAL_FRAG = /* glsl */ `
varying float vA;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float a = 1.0 - smoothstep(0.2, 0.5, length(q * vec2(1.0, 1.8)));
  gl_FragColor = vec4(1.0, 0.78, 0.86, a * vA);
}`

function build() {
  let s = 23
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
  const trunks: Item[] = []
  const blossoms: Item[] = []
  const slabs: Item[] = []
  const lanternStone: Item[] = []
  const lanternLight: Item[] = []
  const hills: Item[] = []
  const pines: Item[] = []

  // Cherry trees in a loose ring, leaving the path to the gate (-Z) open.
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + r() * 0.12
    if (Math.abs(Math.atan2(Math.sin(a), -Math.cos(a))) < 0.35) continue
    const d = 7.5 + r() * 9
    const x = Math.sin(a) * d
    const z = Math.cos(a) * d
    const h = 2.6 + r() * 1.6
    const lean = (r() - 0.5) * 0.3
    trunks.push({ m: mat(x, h * 0.4, z, 1, h * 0.8, 1, r() * 6, lean) })
    for (let k = 0; k < 6; k++) {
      const sc = 0.8 + r() * 0.9
      const pink = new THREE.Color().setHSL(0.95 + r() * 0.04, 0.55 + r() * 0.3, 0.72 + r() * 0.12)
      blossoms.push({
        m: mat(x + (r() - 0.5) * 2.4 + Math.sin(lean) * -h * 0.6, h * 0.85 + r() * 1.2, z + (r() - 0.5) * 2.4, sc * 1.2, sc * 0.85, sc * 1.2, r() * 6),
        c: pink,
      })
    }
  }
  // Stepping-stone path from just past the work area toward the torii.
  for (let i = 0; i < 12; i++) {
    const z = -4.6 - i * 0.95
    slabs.push({ m: mat((r() - 0.5) * 0.25, 0.03, z, 0.75 + r() * 0.2, 0.06, 0.55 + r() * 0.1, (r() - 0.5) * 0.3), c: new THREE.Color().setHSL(0.08, 0.06, 0.52 + r() * 0.1) })
  }
  // Stone lanterns (toro) along the path: base, post, light box, roof.
  for (const z of [-5.5, -9, -12.5]) {
    for (const x of [-1.5, 1.5]) {
      lanternStone.push({ m: mat(x, 0.08, z, 0.42, 0.16, 0.42) })
      lanternStone.push({ m: mat(x, 0.5, z, 0.16, 0.7, 0.16) })
      lanternStone.push({ m: mat(x, 0.92, z, 0.36, 0.08, 0.36) })
      lanternStone.push({ m: mat(x, 1.3, z, 0.52, 0.1, 0.52, Math.PI / 4) })
      lanternLight.push({ m: mat(x, 1.1, z, 0.26, 0.28, 0.26) })
    }
  }
  // Rolling foothills and dark pines on them, under the fog.
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + r() * 0.2
    const d = 34 + r() * 10
    const w = 12 + r() * 8
    hills.push({ m: mat(Math.sin(a) * d, -w * 0.55, Math.cos(a) * d, w * 1.4, w, w * 1.4) })
  }
  for (let i = 0; i < 60; i++) {
    const a = r() * Math.PI * 2
    const d = 20 + r() * 12
    const h = 3 + r() * 4
    pines.push({ m: mat(Math.sin(a) * d, h / 2, Math.cos(a) * d, h * 0.28, h, h * 0.28, r() * 6) })
  }
  const petals: number[] = []
  const seeds: number[] = []
  for (let i = 0; i < 260; i++) {
    const a = r() * Math.PI * 2
    const d = 1.5 + r() * 14
    petals.push(Math.sin(a) * d, r() * 7, Math.cos(a) * d)
    seeds.push(r())
  }
  return { trunks, blossoms, slabs, lanternStone, lanternLight, hills, pines, petals: new Float32Array(petals), seeds: new Float32Array(seeds) }
}

const TORII_RED = "#c8321e"

/** Torii gate: two leaning posts, a curved top lintel (kasagi), a straight tie beam (nuki) and a centre strut. */
function Torii({ z }: { z: number }) {
  const kasagi = useMemo(() => {
    // Lintel as a box bent upward at the ends.
    const g = new THREE.BoxGeometry(6.4, 0.32, 0.5, 16, 1, 1)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      p.setY(i, p.getY(i) + Math.pow(Math.abs(x) / 3.2, 3) * 0.45)
    }
    g.computeVertexNormals()
    return g
  }, [])
  useEffect(() => () => kasagi.dispose(), [kasagi])
  return (
    <group position={[0, 0, z]}>
      {[-1.9, 1.9].map((x) => (
        <group key={x}>
          <mesh position={[x, 2.3, 0]} rotation-z={x > 0 ? 0.03 : -0.03} raycast={noRay}>
            <cylinderGeometry args={[0.2, 0.25, 4.6, 12]} />
            <meshLambertMaterial color={TORII_RED} />
          </mesh>
          <mesh position={[x, 0.2, 0]} raycast={noRay}>
            <cylinderGeometry args={[0.3, 0.32, 0.4, 12]} />
            <meshLambertMaterial color="#1c1a1c" />
          </mesh>
        </group>
      ))}
      <mesh geometry={kasagi} position={[0, 4.75, 0]} raycast={noRay}>
        <meshLambertMaterial color="#1c1a1c" />
      </mesh>
      <mesh position={[0, 4.48, 0]} raycast={noRay}>
        <boxGeometry args={[5.8, 0.26, 0.42]} />
        <meshLambertMaterial color={TORII_RED} />
      </mesh>
      <mesh position={[0, 3.7, 0]} raycast={noRay}>
        <boxGeometry args={[5.0, 0.22, 0.3]} />
        <meshLambertMaterial color={TORII_RED} />
      </mesh>
      <mesh position={[0, 4.1, 0]} raycast={noRay}>
        <boxGeometry args={[0.24, 0.6, 0.28]} />
        <meshLambertMaterial color={TORII_RED} />
      </mesh>
    </group>
  )
}

/** Japanese garden at dusk: torii gate at the end of a stone path, glowing lanterns, cherry trees, drifting petals and Mt Fuji. */
export default function EnvJapan({ intensity = 1, tint = "#ffb46b" }: Props) {
  const f = useMemo(build, [])
  const sky = useMemo(() => ({ uI: { value: 1 } }), [])
  sky.uI.value = 0.5 + 0.5 * intensity
  const petal = useMemo(() => ({ uTime: { value: 0 } }), [])

  const { ground, petalGeo } = useMemo(() => {
    // Moss with a raked-gravel clearing around the viewer (vertex colours on rings).
    const g = new THREE.RingGeometry(0, 60, 64, 14)
    const p = g.attributes.position
    const gravel = new THREE.Color("#a99c88")
    const moss = new THREE.Color("#4d6a3a")
    const c = new THREE.Color()
    const col = new Float32Array(p.count * 3)
    for (let i = 0; i < p.count; i++) {
      const d = Math.hypot(p.getX(i), p.getY(i))
      c.lerpColors(gravel, moss, THREE.MathUtils.smoothstep(d, 4.2, 5.5))
      c.toArray(col, i * 3)
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3))
    const pg = new THREE.BufferGeometry()
    pg.setAttribute("position", new THREE.BufferAttribute(f.petals, 3))
    pg.setAttribute("aSeed", new THREE.BufferAttribute(f.seeds, 1))
    pg.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 3, 0), 20)
    return { ground: g, petalGeo: pg }
  }, [f])
  useEffect(() => () => (ground.dispose(), petalGeo.dispose()), [ground, petalGeo])

  useFrame(({ clock }) => {
    petal.uTime.value = clock.elapsedTime
  })

  // Fragment root (not a group) so background/fog attach to the scene.
  return (
    <>
      <color attach="background" args={[HORIZON]} />
      <fog attach="fog" args={["#d88f86", 18, 75]} />
      <hemisphereLight args={["#ffc9b0", "#3a3550", 0.75 * SUN * intensity]} />
      <directionalLight position={[8, 5, -20]} color="#ffb98a" intensity={0.9 * SUN * intensity} />
      <pointLight position={[-1.5, 1.1, -5.5]} color={tint} intensity={0.8 * POINT * intensity} distance={6} decay={2} />
      <pointLight position={[1.5, 1.1, -5.5]} color={tint} intensity={0.8 * POINT * intensity} distance={6} decay={2} />

      <mesh scale={170} renderOrder={-1} raycast={noRay}>
        <sphereGeometry args={[1, 32, 16]} />
        <shaderMaterial uniforms={sky} vertexShader={SKY_VERT} fragmentShader={SKY_FRAG} side={THREE.BackSide} depthWrite={false} />
      </mesh>

      {/* Mt Fuji far behind the gate, snow cap as a second cone */}
      <group position={[-22, 0, -130]}>
        <mesh position={[0, 20, 0]} raycast={noRay}>
          <coneGeometry args={[62, 40, 24, 1, true]} />
          <meshBasicMaterial color="#7d6f9c" fog={false} />
        </mesh>
        <mesh position={[0, 33.5, 0.4]} raycast={noRay}>
          <coneGeometry args={[20, 13.1, 24, 1, true]} />
          <meshBasicMaterial color="#f3e3ea" fog={false} />
        </mesh>
      </group>

      <mesh geometry={ground} rotation-x={-Math.PI / 2} raycast={noRay}>
        <meshLambertMaterial vertexColors />
      </mesh>

      <Torii z={-16} />

      <Inst items={f.hills}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshLambertMaterial color="#56506e" flatShading />
      </Inst>
      <Inst items={f.pines}>
        <coneGeometry args={[1, 1, 6]} />
        <meshLambertMaterial color="#2e3a3a" flatShading />
      </Inst>
      <Inst items={f.trunks}>
        <cylinderGeometry args={[0.09, 0.16, 1, 6]} />
        <meshLambertMaterial color="#4a3330" />
      </Inst>
      <Inst items={f.blossoms}>
        <icosahedronGeometry args={[1, 1]} />
        <meshLambertMaterial flatShading emissive="#ff9fbf" emissiveIntensity={0.18} />
      </Inst>
      <Inst items={f.slabs}>
        <cylinderGeometry args={[0.5, 0.5, 1, 7]} />
        <meshLambertMaterial flatShading />
      </Inst>
      <Inst items={f.lanternStone}>
        <boxGeometry />
        <meshLambertMaterial color="#8e8a84" />
      </Inst>
      <Inst items={f.lanternLight}>
        <boxGeometry />
        <meshBasicMaterial color={tint} toneMapped={false} />
      </Inst>

      <points geometry={petalGeo} raycast={noRay}>
        <shaderMaterial uniforms={petal} vertexShader={PETAL_VERT} fragmentShader={PETAL_FRAG} transparent depthWrite={false} />
      </points>
    </>
  )
}
