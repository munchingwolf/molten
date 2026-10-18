"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

type Props = { intensity?: number; tint?: string }

// Environment meshes never take pointer rays, so hands and rays reach the components.
const noRay = () => null

const NIGHT = "#070b1c"
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

const mat = (x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, rz, "YXZ")),
    new THREE.Vector3(sx, sy, sz),
  )

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
// Night sky: teal afterglow on the horizon, deep navy above, and a soft Milky Way band of noise.
const SKY_FRAG = /* glsl */ `
uniform float uI; varying vec3 vDir;
float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float n3(vec3 p) { vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
void main() {
  float h = clamp(vDir.y, 0.0, 1.0);
  vec3 col = mix(vec3(0.1, 0.2, 0.28), vec3(0.03, 0.05, 0.14), smoothstep(0.0, 0.25, h));
  col = mix(col, vec3(0.01, 0.015, 0.05), smoothstep(0.25, 0.9, h));
  vec3 axis = normalize(vec3(0.5, 0.3, 0.8));
  float band = exp(-pow(dot(vDir, axis) / 0.16, 2.0));
  float cloud = n3(vDir * 6.0) * 0.6 + n3(vDir * 14.0) * 0.3 + n3(vDir * 30.0) * 0.1;
  col += vec3(0.32, 0.3, 0.45) * band * smoothstep(0.35, 0.85, cloud) * smoothstep(0.0, 0.2, h) * 0.8;
  col -= vec3(0.03) * band * smoothstep(0.55, 0.75, n3(vDir * 20.0 + 5.0)); // dust lanes
  gl_FragColor = vec4(max(col, 0.0) * uI, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

// Twinkling stars: each point's brightness oscillates on its own phase.
const STAR_VERT = /* glsl */ `
uniform float uTime; attribute float aSeed; varying float vB;
void main() {
  vB = (0.55 + 0.45 * sin(uTime * (1.0 + aSeed * 3.0) + aSeed * 40.0)) * (0.4 + aSeed * 0.8);
  gl_PointSize = 1.5 + aSeed * aSeed * 3.5;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const STAR_FRAG = /* glsl */ `
uniform float uI; varying float vB;
void main() { float a = 1.0 - smoothstep(0.05, 0.5, length(gl_PointCoord - 0.5)); gl_FragColor = vec4(vec3(0.9, 0.93, 1.0) * uI, a * vB); }`

// Fireflies: wander on looping paths and pulse, all in the vertex shader.
const FLY_VERT = /* glsl */ `
uniform float uTime; attribute float aSeed; varying float vA;
void main() {
  vec3 p = position;
  float t = uTime * (0.2 + aSeed * 0.25) + aSeed * 50.0;
  p += vec3(sin(t) * 1.2, sin(t * 1.7) * 0.4, cos(t * 0.8) * 1.2);
  vA = pow(0.5 + 0.5 * sin(uTime * (1.5 + aSeed * 2.0) + aSeed * 30.0), 3.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = 110.0 / -mv.z;
  gl_Position = projectionMatrix * mv;
}`
const FLY_FRAG = /* glsl */ `
uniform vec3 uColor; varying float vA;
void main() { float d = length(gl_PointCoord - 0.5); float a = (1.0 - smoothstep(0.0, 0.5, d)); gl_FragColor = vec4(uColor * (1.0 + (1.0 - smoothstep(0.0, 0.12, d)) * 2.0), a * a * vA); }`

/** Meadow: flat around the viewer, rolling hills beyond, dark grass-green with moonlit tops. */
function meadow() {
  const g = new THREE.PlaneGeometry(260, 260, 120, 120)
  g.rotateX(-Math.PI / 2)
  const p = g.attributes.position
  const col = new Float32Array(p.count * 3)
  const c = new THREE.Color()
  const low = new THREE.Color("#0c1a14")
  const high = new THREE.Color("#2a4a3c")
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const z = p.getZ(i)
    const d = Math.hypot(x, z)
    const y = (Math.sin(x * 0.045) * Math.cos(z * 0.035) * 5 + Math.sin(x * 0.02 + z * 0.03) * 6 + 4) * THREE.MathUtils.smoothstep(d, 10, 60)
    p.setY(i, Math.max(y, 0))
    c.lerpColors(low, high, 0.35 + Math.sin(x * 0.7) * Math.cos(z * 0.6) * 0.15 + Math.min(y, 10) * 0.05)
    c.toArray(col, i * 3)
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

function build() {
  let s = 97
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
  const grass: Item[] = []
  const trees: Item[] = []
  const trunks: Item[] = []
  const flowers: Item[] = []
  for (let i = 0; i < 700; i++) {
    const a = r() * Math.PI * 2
    const d = 1.6 + Math.sqrt(r()) * 14
    const k = 0.6 + r() * 0.8
    grass.push({ m: mat(Math.sin(a) * d, 0.17 * k, Math.cos(a) * d, 0.035 * k, 0.34 * k, 0.035 * k, r() * 6, (r() - 0.5) * 0.4), c: new THREE.Color().setHSL(0.36 + r() * 0.06, 0.4, 0.12 + r() * 0.1) })
  }
  for (let i = 0; i < 60; i++) {
    const a = r() * Math.PI * 2
    const d = 3 + r() * 10
    flowers.push({ m: mat(Math.sin(a) * d, 0.2, Math.cos(a) * d, 0.028, 0.028, 0.028), c: new THREE.Color().setHSL(r() < 0.5 ? 0.6 : 0.8, 0.6, 0.6) })
  }
  // Lone trees on the slopes, silhouetted against the sky.
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + r() * 0.2
    const d = 16 + r() * 22
    const x = Math.sin(a) * d
    const z = Math.cos(a) * d
    const base = (Math.sin(x * 0.045) * Math.cos(z * 0.035) * 5 + Math.sin(x * 0.02 + z * 0.03) * 6 + 4) * THREE.MathUtils.smoothstep(d, 10, 60)
    const h = 3 + r() * 3
    trunks.push({ m: mat(x, Math.max(base, 0) + h * 0.3, z, 1, h * 0.6, 1) })
    trees.push({ m: mat(x, Math.max(base, 0) + h * 0.75, z, h * 0.35, h * 0.3, h * 0.35, r() * 6) })
  }
  const stars: number[] = []
  const starSeed: number[] = []
  for (let i = 0; i < 2200; i++) {
    const y = 0.04 + r() * 0.96
    const a = r() * Math.PI * 2
    const q = Math.sqrt(1 - y * y)
    stars.push(Math.cos(a) * q * 175, y * 175, Math.sin(a) * q * 175)
    starSeed.push(r())
  }
  const flies: number[] = []
  const flySeed: number[] = []
  for (let i = 0; i < 120; i++) {
    const a = r() * Math.PI * 2
    const d = 2.5 + r() * 14
    flies.push(Math.sin(a) * d, 0.4 + r() * 1.8, Math.cos(a) * d)
    flySeed.push(r())
  }
  return { grass, trees, trunks, flowers, stars: [new Float32Array(stars), new Float32Array(starSeed)], flies: [new Float32Array(flies), new Float32Array(flySeed)] }
}

const points = ([pos, seed]: Float32Array[], radius: number) => {
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1))
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius)
  return g
}

/** Starry night meadow: Milky Way, twinkling stars, a bright moon, silhouetted trees and drifting fireflies. */
export default function EnvStarry({ intensity = 1, tint = "#d8ff6a" }: Props) {
  const f = useMemo(build, [])
  const { ground, starGeo, flyGeo } = useMemo(() => ({ ground: meadow(), starGeo: points(f.stars, 200), flyGeo: points(f.flies, 30) }), [f])
  useEffect(() => () => (ground.dispose(), starGeo.dispose(), flyGeo.dispose()), [ground, starGeo, flyGeo])
  const u = useMemo(
    () => ({ sky: { uI: { value: 1 } }, star: { uI: { value: 1 }, uTime: { value: 0 } }, fly: { uTime: { value: 0 }, uColor: { value: new THREE.Color() } } }),
    [],
  )
  u.sky.uI.value = u.star.uI.value = 0.5 + 0.5 * intensity
  u.fly.uColor.value.set(tint)
  useFrame(({ clock }) => {
    u.star.uTime.value = u.fly.uTime.value = clock.elapsedTime
  })

  return (
    // Fragment root (not a group) so background/fog attach to the scene.
    <>
      <color attach="background" args={[NIGHT]} />
      <fog attach="fog" args={["#0b1424", 20, 110]} />
      <hemisphereLight args={["#5b72b0", "#0a120e", 0.55 * SUN * intensity]} />
      <directionalLight position={[-30, 40, -60]} color="#c8d6ff" intensity={0.7 * SUN * intensity} />

      <mesh scale={185} renderOrder={-1} raycast={noRay}>
        <sphereGeometry args={[1, 48, 24]} />
        <shaderMaterial uniforms={u.sky} vertexShader={SKY_VERT} fragmentShader={SKY_FRAG} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <points geometry={starGeo} raycast={noRay}>
        <shaderMaterial uniforms={u.star} vertexShader={STAR_VERT} fragmentShader={STAR_FRAG} transparent depthWrite={false} />
      </points>
      {/* moon with a soft halo */}
      <group position={[-55, 70, -120]}>
        <mesh raycast={noRay}>
          <sphereGeometry args={[6, 32, 16]} />
          <meshBasicMaterial color="#f4f1e2" fog={false} />
        </mesh>
        <mesh raycast={noRay}>
          <sphereGeometry args={[11, 32, 16]} />
          <meshBasicMaterial color="#9fb3ff" transparent opacity={0.12} depthWrite={false} fog={false} />
        </mesh>
      </group>

      <mesh geometry={ground} raycast={noRay}>
        <meshLambertMaterial vertexColors />
      </mesh>
      <Inst items={f.grass}>
        <coneGeometry args={[1, 1, 3]} />
        <meshLambertMaterial />
      </Inst>
      <Inst items={f.flowers}>
        <icosahedronGeometry args={[1, 0]} />
        <meshBasicMaterial />
      </Inst>
      <Inst items={f.trunks}>
        <cylinderGeometry args={[0.12, 0.2, 1, 5]} />
        <meshLambertMaterial color="#1a1512" />
      </Inst>
      <Inst items={f.trees}>
        <icosahedronGeometry args={[1, 1]} />
        <meshLambertMaterial color="#0f2219" flatShading />
      </Inst>

      <points geometry={flyGeo} raycast={noRay}>
        <shaderMaterial uniforms={u.fly} vertexShader={FLY_VERT} fragmentShader={FLY_FRAG} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </>
  )
}
