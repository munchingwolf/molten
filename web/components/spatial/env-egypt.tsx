"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react"
import * as THREE from "three"

type Props = { intensity?: number; tint?: string }

// Environment meshes never take pointer rays, so hands and rays reach the components.
const noRay = () => null

const HAZE = "#f4cf96"
// three r155+ lights are physical; this factor keeps the legacy-light look.
const SUN = Math.PI

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

const mat = (x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rx = 0, rz = 0) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, "YXZ")),
    new THREE.Vector3(sx, sy, sz),
  )

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
// Late-afternoon desert: golden haze at the horizon, clear blue overhead, a hot white sun.
const SKY_FRAG = /* glsl */ `
uniform float uI; uniform vec3 uSun; varying vec3 vDir;
void main() {
  float h = clamp(vDir.y, 0.0, 1.0);
  vec3 col = mix(vec3(1.0, 0.78, 0.5), vec3(0.42, 0.62, 0.88), smoothstep(0.0, 0.12, h));
  col = mix(col, vec3(0.1, 0.3, 0.72), smoothstep(0.12, 0.6, h));
  float d = distance(vDir, uSun);
  col += vec3(1.0, 0.85, 0.55) * exp(-d * 6.0) * 0.5 + (1.0 - smoothstep(0.035, 0.04, d)) * vec3(1.0, 0.95, 0.8);
  gl_FragColor = vec4(col * uI, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

const SUN_DIR = new THREE.Vector3(0.85, 0.38, 0.25).normalize()

/** Dunes: flat sand pad around the viewer, long wind-shaped ridges further out, ripples shaded into vertex colour. */
function dunes() {
  const g = new THREE.PlaneGeometry(300, 300, 160, 160)
  g.rotateX(-Math.PI / 2)
  const p = g.attributes.position
  const col = new Float32Array(p.count * 3)
  const lo = new THREE.Color("#c99a5e")
  const hi = new THREE.Color("#ecc98f")
  const c = new THREE.Color()
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const z = p.getZ(i)
    const d = Math.hypot(x, z)
    // Ridges: sharpened sines along a slowly turning wind direction.
    const u = x * 0.05 + z * 0.03 + Math.sin(z * 0.02) * 2
    const ridge = Math.pow(Math.abs(Math.sin(u)), 0.6) * 4 + Math.sin(x * 0.013 - z * 0.021) * 3
    const y = ridge * THREE.MathUtils.smoothstep(d, 7, 32) - (1 - THREE.MathUtils.smoothstep(d, 60, 120)) * 0 + THREE.MathUtils.smoothstep(d, 80, 150) * 4
    p.setY(i, y)
    c.lerpColors(lo, hi, 0.55 + Math.sin(x * 2.1 + z * 1.3) * 0.08 + y * 0.05)
    c.toArray(col, i * 3)
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

function build() {
  let s = 53
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
  const pyramids: Item[] = []
  const caps: Item[] = []
  const obelisks: Item[] = []
  const tips: Item[] = []
  const columns: Item[] = []
  const blocks: Item[] = []
  const trunks: Item[] = []
  const fronds: Item[] = []
  const sand = (l: number) => new THREE.Color().setHSL(0.1, 0.55, l)

  // Giza-style trio far ahead (4-sided cones rotated 45° so a face points at the viewer), plus small satellites.
  for (const [x, z, k] of [[-18, -95, 38], [24, -120, 34], [58, -150, 22], [-52, -80, 10], [-62, -86, 8], [38, -70, 7]] as const) {
    pyramids.push({ m: mat(x, k * 0.5 - 0.5, z, k, k, k, Math.PI / 4), c: sand(0.62 + r() * 0.06) })
    if (k > 30) caps.push({ m: mat(x, k * 0.94, z, k * 0.13, k * 0.12, k * 0.13, Math.PI / 4) })
  }
  // Avenue of obelisks leading toward the pyramids.
  for (const z of [-7, -13, -19]) {
    for (const x of [-3.2, 3.2]) {
      obelisks.push({ m: mat(x, 2.6, z, 0.55, 5.2, 0.55) })
      tips.push({ m: mat(x, 5.5, z, 0.55, 0.6, 0.55, Math.PI / 4) })
      blocks.push({ m: mat(x, 0.15, z, 1.1, 0.3, 1.1), c: sand(0.6) })
    }
  }
  // Temple ruin to the right: column stumps of varied height and fallen blocks.
  for (let i = 0; i < 12; i++) {
    const row = i % 2
    const x = 11 + row * 4
    const z = -2 - Math.floor(i / 2) * 3.2
    const h = r() < 0.4 ? 0.6 + r() * 1.5 : 4 + r() * 1.5
    columns.push({ m: mat(x, h / 2, z, 1, h, 1, r()), c: sand(0.6 + r() * 0.08) })
    if (h > 3) blocks.push({ m: mat(x, h + 0.2, z, 1.5, 0.4, 1.5), c: sand(0.58) })
  }
  for (let i = 0; i < 9; i++) blocks.push({ m: mat(9 + r() * 9, 0.3, -1 - r() * 18, 0.8 + r() * 1.2, 0.6, 0.6 + r(), r() * 3, 0, (r() - 0.5) * 0.3), c: sand(0.5 + r() * 0.12) })
  // Oasis palms to the left.
  for (let i = 0; i < 9; i++) {
    const x = -12 - r() * 8
    const z = 2 - r() * 14
    const h = 4 + r() * 3
    const lean = (r() - 0.5) * 0.4
    trunks.push({ m: mat(x, h / 2, z, 1, h, 1, 0, 0, lean) })
    const tx = x - Math.sin(lean) * h
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + r()
      fronds.push({ m: mat(tx + Math.sin(a) * 1, h - 0.1, z + Math.cos(a) * 1, 0.5, 0.06, 2.4, a, 0.35), c: new THREE.Color().setHSL(0.27, 0.45, 0.24 + r() * 0.1) })
    }
  }
  return { pyramids, caps, obelisks, tips, columns, blocks, trunks, fronds }
}

/** Egyptian desert: golden dunes, three great pyramids on the horizon, an avenue of obelisks, temple ruins and an oasis. */
export default function EnvEgypt({ intensity = 1, tint = "#fff1d6" }: Props) {
  const f = useMemo(build, [])
  const ground = useMemo(dunes, [])
  useEffect(() => () => ground.dispose(), [ground])
  const sky = useMemo(() => ({ uI: { value: 1 }, uSun: { value: SUN_DIR.clone() } }), [])
  sky.uI.value = 0.55 + 0.45 * intensity

  return (
    // Fragment root (not a group) so background/fog attach to the scene.
    <>
      <color attach="background" args={[HAZE]} />
      <fog attach="fog" args={[HAZE, 70, 280]} />
      <hemisphereLight args={["#bcd6f0", "#a2774a", 0.9 * SUN * intensity]} />
      <directionalLight position={SUN_DIR.clone().multiplyScalar(60)} color={tint} intensity={1.5 * SUN * intensity} />

      <mesh scale={195} renderOrder={-1} raycast={noRay}>
        <sphereGeometry args={[1, 32, 16]} />
        <shaderMaterial uniforms={sky} vertexShader={SKY_VERT} fragmentShader={SKY_FRAG} side={THREE.BackSide} depthWrite={false} />
      </mesh>

      <mesh geometry={ground} raycast={noRay}>
        <meshLambertMaterial vertexColors />
      </mesh>
      {/* oasis pool */}
      <mesh position={[-16, 0.02, -5]} rotation-x={-Math.PI / 2} raycast={noRay}>
        <circleGeometry args={[4, 24]} />
        <meshLambertMaterial color="#3f9fb0" emissive="#1d5e6e" emissiveIntensity={0.3} />
      </mesh>

      <Inst items={f.pyramids}>
        <coneGeometry args={[0.75, 1, 4]} />
        <meshLambertMaterial flatShading fog={false} />
      </Inst>
      <Inst items={f.caps}>
        <coneGeometry args={[0.75, 1, 4]} />
        <meshLambertMaterial color="#f5c84a" emissive="#8a5a10" emissiveIntensity={0.35} flatShading fog={false} />
      </Inst>
      <Inst items={f.obelisks}>
        <cylinderGeometry args={[0.36, 0.5, 1, 4]} />
        <meshLambertMaterial color="#e2bf86" flatShading />
      </Inst>
      <Inst items={f.tips}>
        <coneGeometry args={[0.37, 1, 4]} />
        <meshLambertMaterial color="#f5c84a" emissive="#8a5a10" emissiveIntensity={0.35} flatShading />
      </Inst>
      <Inst items={f.columns}>
        <cylinderGeometry args={[0.42, 0.48, 1, 10]} />
        <meshLambertMaterial flatShading />
      </Inst>
      <Inst items={f.blocks}>
        <boxGeometry />
        <meshLambertMaterial flatShading />
      </Inst>
      <Inst items={f.trunks}>
        <cylinderGeometry args={[0.12, 0.2, 1, 6]} />
        <meshLambertMaterial color="#7a5a3a" flatShading />
      </Inst>
      <Inst items={f.fronds}>
        <coneGeometry args={[1, 1, 3]} />
        <meshLambertMaterial flatShading side={THREE.DoubleSide} />
      </Inst>
    </>
  )
}
