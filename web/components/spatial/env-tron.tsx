"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

type Props = { intensity?: number; tint?: string }

// Environment meshes never take pointer rays, so hands and rays reach the components.
const noRay = () => null

const BG = "#12052a"
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

const mat = (x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)),
    new THREE.Vector3(sx, sy, sz),
  )

// Sky: violet zenith to hot-pink horizon, a striped synthwave sun low in the -Z sky.
const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const SKY_FRAG = /* glsl */ `
uniform float uI; varying vec3 vDir;
void main() {
  float h = clamp(vDir.y, 0.0, 1.0);
  vec3 col = mix(vec3(1.0, 0.18, 0.55), vec3(0.32, 0.06, 0.55), smoothstep(0.0, 0.18, h));
  col = mix(col, vec3(0.03, 0.01, 0.1), smoothstep(0.12, 0.6, h));
  vec3 sd = normalize(vec3(0.0, 0.16, -1.0));
  float d = distance(vDir, sd);
  float r = 0.24;
  float y = (vDir.y - sd.y) / r;            // -1 bottom .. 1 top of the sun
  float band = step(0.5, fract((y + 1.0) * 6.0 * (1.0 - y * 0.35)));
  float cut = y < 0.15 ? band : 1.0;        // horizontal slits through the lower half
  vec3 sunCol = mix(vec3(1.0, 0.2, 0.55), vec3(1.0, 0.86, 0.3), clamp(y * 0.5 + 0.5, 0.0, 1.0));
  float disk = (1.0 - smoothstep(r - 0.004, r, d)) * cut * step(0.0, vDir.y);
  col += vec3(1.0, 0.25, 0.6) * exp(-d * 5.0) * 0.35;  // halo
  col = mix(col, sunCol, disk);
  gl_FragColor = vec4(col * uI, 1.0);
}`

// Floor: near-black plane with antialiased neon grid lines that fade into the haze.
const GRID_VERT = /* glsl */ `
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`
const GRID_FRAG = /* glsl */ `
uniform vec3 uLine; uniform vec3 uFar; uniform float uI; varying vec3 vW;
float grid(vec2 p, float w) { vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p); return 1.0 - min(min(g.x, g.y) / w, 1.0); }
void main() {
  float dist = length(vW.xz);
  float minor = grid(vW.xz, 1.0) * 0.35;
  float major = grid(vW.xz / 4.0, 1.4);
  float line = max(minor, major);
  vec3 lc = mix(uLine, uFar, smoothstep(6.0, 60.0, dist));
  vec3 base = vec3(0.02, 0.0, 0.05) + vec3(0.12, 0.02, 0.18) * smoothstep(20.0, 120.0, dist);
  float fade = 1.0 - smoothstep(40.0, 140.0, dist);
  vec3 col = base + lc * line * fade * 1.4;
  col += uLine * 0.05 * (1.0 - smoothstep(0.0, 4.0, dist));   // faint pool under the work area
  gl_FragColor = vec4(col * uI, 1.0);
}`

function build() {
  let s = 11
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
  const towers: Item[] = []
  const caps: Item[] = []
  const pyramids: Item[] = []
  const stars: number[] = []
  const pal = [new THREE.Color("#00e5ff"), new THREE.Color("#ff2bd6"), new THREE.Color("#8a5cff")]

  // Glowing obelisks scattered 14-45 m out, keeping the sun's line of sight clear.
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + r() * 0.15
    if (Math.abs(Math.atan2(Math.sin(a), -Math.cos(a))) < 0.32) continue
    const d = 14 + r() * 32
    const x = Math.sin(a) * d
    const z = Math.cos(a) * d
    const h = 3 + r() * 9
    const w = 0.5 + r() * 0.8
    towers.push({ m: mat(x, h / 2, z, w, h, w, r() * 3) })
    caps.push({ m: mat(x, h + 0.04, z, w * 1.02, 0.08, w * 1.02, 0), c: pal[i % 3] })
    caps.push({ m: mat(x, 0.04, z, w * 1.08, 0.08, w * 1.08, 0), c: pal[i % 3] })
    // neon strips down two vertical edges
    for (const k of [-1, 1]) caps.push({ m: mat(x + k * w * 0.5, h / 2, z + w * 0.5, 0.05, h, 0.05, 0), c: pal[i % 3] })
  }
  // A few neon wireframe pyramids, mid distance.
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2
    const d = 22 + r() * 25
    const k = 2 + r() * 4
    pyramids.push({ m: mat(Math.sin(a) * d, k * 0.5, Math.cos(a) * d, k, k, k, r() * 3), c: pal[(i + 1) % 3] })
  }
  // Starfield on the upper sky dome.
  for (let i = 0; i < 700; i++) {
    const y = 0.12 + r() * 0.88
    const a = r() * Math.PI * 2
    const q = Math.sqrt(1 - y * y)
    if (Math.hypot(Math.cos(a) * q, y - 0.16, Math.sin(a) * q + 1) < 0.34) continue // keep the sun clean
    stars.push(Math.cos(a) * q * 170, y * 170, Math.sin(a) * q * 170)
  }
  return { towers, caps, pyramids, stars: new Float32Array(stars) }
}

/** Ring of jagged mountains on the horizon (heights from a seeded random walk). */
function mountainGeometry() {
  let s = 5
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
  const seg = 96
  const rows = 3
  const g = new THREE.CylinderGeometry(110, 110, 1, seg, rows, true)
  const p = g.attributes.position
  const peaks: number[] = []
  let h = 8
  for (let i = 0; i <= seg; i++) {
    h = Math.max(5, Math.min(28, h + (r() - 0.5) * 10))
    peaks.push(i === seg ? peaks[0] : h * (i % 2 ? 0.45 + r() * 0.2 : 1)) // alternate peaks and saddles
  }
  for (let i = 0; i < p.count; i++) {
    const col = i % (seg + 1)
    const row = Math.floor(i / (seg + 1)) // 0 = top
    const t = 1 - row / rows
    const a = Math.atan2(p.getX(i), p.getZ(i))
    // Lower the range behind the sun so it sits in a valley.
    const valley = 1 - 0.75 * Math.exp(-Math.pow(Math.atan2(Math.sin(a), -Math.cos(a)) / 0.4, 2))
    const jitter = row > 0 && row < rows ? (r() - 0.5) * 3 : 0
    p.setY(i, peaks[col] * valley * t * t + (row === rows ? -1 : 0))
    p.setX(i, p.getX(i) * (1 + jitter * 0.01))
    p.setZ(i, p.getZ(i) * (1 + jitter * 0.01))
  }
  g.computeVertexNormals()
  return g
}

/** Synthwave night: neon grid floor, striped sun on the horizon, wireframe mountains, glowing obelisks and stars. */
export default function EnvTron({ intensity = 1, tint = "#00e5ff" }: Props) {
  const f = useMemo(build, [])
  const mountains = useMemo(mountainGeometry, [])
  const starGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(f.stars, 3))
    return g
  }, [f])
  useEffect(() => () => (mountains.dispose(), starGeo.dispose()), [mountains, starGeo])

  const sky = useMemo(() => ({ uI: { value: 1 } }), [])
  const grid = useMemo(() => ({ uLine: { value: new THREE.Color() }, uFar: { value: new THREE.Color("#ff2bd6") }, uI: { value: 1 } }), [])
  sky.uI.value = 0.4 + 0.6 * intensity
  grid.uI.value = 0.4 + 0.6 * intensity
  grid.uLine.value.set(tint)

  const starMat = useRef<THREE.PointsMaterial>(null)
  useFrame(({ clock }) => {
    if (starMat.current) starMat.current.opacity = 0.75 + Math.sin(clock.elapsedTime * 1.3) * 0.15
  })

  // Fragment root (not a group) so background/fog attach to the scene.
  return (
    <>
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={["#2a0a40", 30, 115]} />
      <hemisphereLight args={["#b06cff", "#100320", 0.6 * SUN * intensity]} />
      <directionalLight position={[0, 6, -20]} color="#ff7ad9" intensity={0.8 * SUN * intensity} />

      <mesh scale={180} renderOrder={-1} raycast={noRay}>
        <sphereGeometry args={[1, 48, 24]} />
        <shaderMaterial uniforms={sky} vertexShader={SKY_VERT} fragmentShader={SKY_FRAG} side={THREE.BackSide} depthWrite={false} fog={false} toneMapped={false} />
      </mesh>
      <points geometry={starGeo} raycast={noRay}>
        <pointsMaterial ref={starMat} color="#ffffff" size={0.9} sizeAttenuation transparent depthWrite={false} fog={false} toneMapped={false} />
      </points>

      <mesh rotation-x={-Math.PI / 2} raycast={noRay}>
        <planeGeometry args={[300, 300]} />
        <shaderMaterial uniforms={grid} vertexShader={GRID_VERT} fragmentShader={GRID_FRAG} toneMapped={false} />
      </mesh>

      {/* horizon mountains: dark fill + neon wireframe of the same mesh */}
      <mesh geometry={mountains} raycast={noRay}>
        <meshBasicMaterial color="#0b0218" side={THREE.DoubleSide} fog={false} />
      </mesh>
      <mesh geometry={mountains} scale={0.998} raycast={noRay}>
        <meshBasicMaterial color="#ff2bd6" wireframe side={THREE.DoubleSide} transparent opacity={0.55 * Math.min(1, intensity)} fog={false} toneMapped={false} />
      </mesh>

      <Inst items={f.towers}>
        <boxGeometry />
        <meshStandardMaterial color="#2a1250" roughness={0.45} metalness={0.2} />
      </Inst>
      <Inst items={f.caps}>
        <boxGeometry />
        <meshBasicMaterial toneMapped={false} />
      </Inst>
      <Inst items={f.pyramids}>
        <coneGeometry args={[0.7, 1, 4]} />
        <meshBasicMaterial wireframe toneMapped={false} />
      </Inst>
    </>
  )
}
