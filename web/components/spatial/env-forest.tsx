"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react"
import * as THREE from "three"

type Props = { intensity?: number; tint?: string }

// Environment meshes never take pointer rays, so hands and rays reach the components.
const noRay = () => null

const HORIZON = "#cfdde0"
const SKY_TOP = "#5b8fca"

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

function buildForest() {
  let s = 7
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
  const trunks: Item[] = []
  const cones: Item[] = []
  const crowns: Item[] = []
  const rocks: Item[] = []
  const tufts: Item[] = []
  const hills: Item[] = []
  const clouds: Item[] = []
  const ring = (min: number, max: number) => {
    const a = r() * Math.PI * 2
    const d = min + r() * (max - min)
    return [Math.sin(a) * d, Math.cos(a) * d] as const
  }

  // Tree ring 7–22 m out: 70% two-tier pines, 30% round low-poly crowns.
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2 + r() * 0.08
    const d = 7 + r() * 15
    const x = Math.sin(a) * d
    const z = Math.cos(a) * d
    const h = 3 + r() * 3.5
    const green = new THREE.Color().setHSL(0.26 + r() * 0.08, 0.42 + r() * 0.2, 0.2 + r() * 0.12)
    trunks.push({ m: mat(x, h * 0.2, z, h / 4, h * 0.4, h / 4) })
    if (r() < 0.7) {
      cones.push({ m: mat(x, h * 0.55, z, h * 0.28, h * 0.55, h * 0.28, r() * 6), c: green })
      cones.push({ m: mat(x, h * 0.8, z, h * 0.2, h * 0.4, h * 0.2, r() * 6), c: green })
    } else {
      crowns.push({ m: mat(x, h * 0.65, z, h * 0.3, h * 0.3, h * 0.3, r() * 6), c: green })
    }
  }
  for (let i = 0; i < 14; i++) {
    const [x, z] = ring(3, 12)
    const k = 0.2 + r() * 0.5
    rocks.push({ m: mat(x, k * 0.3, z, k, k * 0.7, k, r() * 6), c: new THREE.Color().setHSL(0.1, 0.05, 0.38 + r() * 0.12) })
  }
  for (let i = 0; i < 180; i++) {
    const [x, z] = ring(2.2, 14)
    const k = 0.7 + r() * 0.6
    tufts.push({ m: mat(x, 0.15 * k, z, 0.06 * k, 0.3 * k, 0.06 * k) })
  }
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + r() * 0.3
    const d = 36 + r() * 8
    const w = 9 + r() * 6
    const h = 8 + r() * 8
    hills.push({ m: mat(Math.sin(a) * d, h / 2, Math.cos(a) * d, w, h, w, r() * 6) })
  }
  for (let i = 0; i < 6; i++) {
    const [x, z] = ring(45, 70)
    const y = 24 + r() * 10
    for (let k = 0; k < 3; k++) {
      const sc = 3 + r() * 3
      clouds.push({ m: mat(x + (k - 1) * 4 + r(), y + r() * 1.5, z + r() * 2, sc * 1.4, sc, sc, r() * 6) })
    }
  }
  return { trunks, cones, crowns, rocks, tufts, hills, clouds }
}

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const SKY_FRAG = /* glsl */ `
uniform vec3 uTop; uniform vec3 uHorizon; varying vec3 vDir;
void main() {
  gl_FragColor = vec4(mix(uHorizon, uTop, pow(clamp(vDir.y, 0.0, 1.0), 0.6)), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

/** Outdoor clearing: gradient sky, ring of stylised low-poly trees, grass, rocks and light fog. */
export default function EnvForest({ intensity = 1, tint = "#fff0d6" }: Props) {
  const f = useMemo(buildForest, [])
  const sky = useMemo(() => ({ uTop: { value: new THREE.Color(SKY_TOP) }, uHorizon: { value: new THREE.Color(HORIZON) } }), [])

  // Grass with a lighter clearing around the viewer, via per-vertex colour on concentric rings.
  const ground = useMemo(() => {
    const g = new THREE.RingGeometry(0, 40, 48, 10)
    const p = g.attributes.position
    const light = new THREE.Color("#86ad5c")
    const dark = new THREE.Color("#4f7a3b")
    const c = new THREE.Color()
    const col = new Float32Array(p.count * 3)
    for (let i = 0; i < p.count; i++) {
      c.lerpColors(light, dark, THREE.MathUtils.smoothstep(Math.hypot(p.getX(i), p.getY(i)), 4, 16))
      c.toArray(col, i * 3)
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3))
    return g
  }, [])
  useEffect(() => () => ground.dispose(), [ground])

  return (
    <group>
      <color attach="background" args={[HORIZON]} />
      <fog attach="fog" args={[HORIZON, 14, 60]} />
      <hemisphereLight args={["#d8ecff", "#56683a", 1.3 * intensity]} />
      <directionalLight position={[12, 16, 20]} color={tint} intensity={2.2 * intensity} />

      <mesh scale={90} renderOrder={-1} raycast={noRay}>
        <sphereGeometry args={[1, 24, 12]} />
        <shaderMaterial uniforms={sky} vertexShader={SKY_VERT} fragmentShader={SKY_FRAG} side={THREE.BackSide} depthWrite={false} />
      </mesh>

      <mesh geometry={ground} rotation-x={-Math.PI / 2} raycast={noRay}>
        <meshLambertMaterial vertexColors />
      </mesh>

      <Inst items={f.trunks}>
        <cylinderGeometry args={[0.1, 0.16, 1, 5]} />
        <meshLambertMaterial color="#6b4a32" flatShading />
      </Inst>
      <Inst items={f.cones}>
        <coneGeometry args={[1, 1, 7]} />
        <meshLambertMaterial flatShading />
      </Inst>
      <Inst items={f.crowns}>
        <icosahedronGeometry args={[1, 0]} />
        <meshLambertMaterial flatShading />
      </Inst>
      <Inst items={f.rocks}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshLambertMaterial flatShading />
      </Inst>
      <Inst items={f.tufts}>
        <coneGeometry args={[1, 1, 4]} />
        <meshLambertMaterial color="#3f6b2c" />
      </Inst>
      <Inst items={f.hills}>
        <coneGeometry args={[1, 1, 6]} />
        <meshLambertMaterial color="#5d7d68" flatShading />
      </Inst>
      <Inst items={f.clouds}>
        <icosahedronGeometry args={[1, 0]} />
        <meshLambertMaterial color="#ffffff" emissive="#9fb4c8" emissiveIntensity={0.35} flatShading fog={false} />
      </Inst>
    </group>
  )
}
