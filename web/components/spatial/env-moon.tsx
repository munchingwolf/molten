"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

type Props = { intensity?: number; tint?: string }

// Environment meshes never take pointer rays, so hands and rays reach the components.
const noRay = () => null

// three r155+ lights are physical; this factor keeps the legacy-light look.
const SUN = Math.PI
const SUN_DIR = new THREE.Vector3(-0.8, 0.35, -0.5).normalize()

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

const mat = (x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rx = 0) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0)),
    new THREE.Vector3(sx, sy, sz),
  )

const STAR_VERT = /* glsl */ `
attribute float aSize; varying float vB;
void main() { vB = aSize; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * 2.6; gl_Position = projectionMatrix * mv; }`
const STAR_FRAG = /* glsl */ `
uniform float uI; varying float vB;
void main() { float a = 1.0 - smoothstep(0.1, 0.5, length(gl_PointCoord - 0.5)); gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * uI, a * min(1.0, vB * 0.6)); }`

// Earth: procedural continents, clouds, day/night terminator and an atmosphere rim.
const EARTH_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vP; varying vec3 vV;
void main() { vP = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`
const EARTH_FRAG = /* glsl */ `
uniform vec3 uSun; uniform float uTime; varying vec3 vN; varying vec3 vP; varying vec3 vV;
float h(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float n(vec3 p) { vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p) { float s = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { s += a * n(p); p *= 2.03; a *= 0.5; } return s; }
void main() {
  vec3 p = normalize(vP);
  float land = smoothstep(0.52, 0.56, fbm(p * 2.2 + 3.0));
  float ice = smoothstep(0.78, 0.86, abs(p.y));
  vec3 col = mix(vec3(0.03, 0.12, 0.38), mix(vec3(0.18, 0.36, 0.14), vec3(0.55, 0.45, 0.28), fbm(p * 6.0)), land);
  col = mix(col, vec3(0.92), ice);
  float cl = smoothstep(0.5, 0.72, fbm(p * 3.5 + vec3(uTime * 0.01, 0.0, 0.0)));
  col = mix(col, vec3(1.0), cl * 0.85);
  float lit = clamp(dot(vN, uSun) * 1.2 + 0.1, 0.0, 1.0);
  float rim = pow(1.0 - max(dot(vN, vV), 0.0), 3.0);
  col = col * lit + vec3(0.35, 0.6, 1.0) * rim * (0.25 + lit);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`

/** Cratered regolith: flat around the viewer, craters and swells further out, shaded grey by height. */
function terrain() {
  let s = 41
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
  const craters: [number, number, number][] = [[-9, -16, 5], [13, -11, 3.2], [6, 15, 4.5], [-16, 7, 3.5]]
  for (let i = 0; i < 110; i++) {
    const a = r() * Math.PI * 2
    const d = 9 + r() * 100
    craters.push([Math.sin(a) * d, Math.cos(a) * d, 0.8 + r() * r() * r() * 18])
  }
  const g = new THREE.PlaneGeometry(260, 260, 180, 180)
  g.rotateX(-Math.PI / 2)
  const p = g.attributes.position
  const col = new Float32Array(p.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const z = p.getZ(i)
    const dist = Math.hypot(x, z)
    let shade = 0
    let y = (Math.sin(x * 0.045 + Math.sin(z * 0.03) * 2) + Math.cos(z * 0.05 + x * 0.02)) * 1.6 * THREE.MathUtils.smoothstep(dist, 20, 70)
    for (const [cx, cz, R] of craters) {
      const d = Math.hypot(x - cx, z - cz) / R
      if (d > 2) continue
      y += d < 1 ? -R * 0.3 * (1 - d * d) : 0
      const rim = Math.exp(-Math.pow((d - 1) / (d < 1 ? 0.12 : 0.35), 2))
      y += R * 0.12 * rim
      shade += (d < 0.95 ? -0.06 : 0) + rim * 0.07 + (d > 1 && d < 1.8 ? 0.03 : 0) // dark floor, bright rim + ejecta
    }
    y *= THREE.MathUtils.smoothstep(dist, 4.5, 9)
    y += Math.sin(x * 1.7) * Math.cos(z * 1.3) * 0.03 * THREE.MathUtils.smoothstep(dist, 4, 6)
    p.setY(i, y)
    const fade = THREE.MathUtils.smoothstep(dist, 4.5, 9)
    c.setScalar(0.42 + shade * fade + (Math.sin(x * 0.31) * Math.cos(z * 0.27)) * 0.04)
    c.toArray(col, i * 3)
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

function build() {
  let s = 77
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
  const rocks: Item[] = []
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2
    const d = 5 + r() * 30
    const k = 0.1 + r() * r() * 1.1
    rocks.push({ m: mat(Math.sin(a) * d, k * 0.15, Math.cos(a) * d, k, k * 0.6, k * 1.2, r() * 6, r()), c: new THREE.Color().setScalar(0.35 + r() * 0.2) })
  }
  const pos: number[] = []
  const size: number[] = []
  for (let i = 0; i < 1800; i++) {
    const y = r() * 2 - 1
    const a = r() * Math.PI * 2
    const q = Math.sqrt(1 - y * y)
    pos.push(Math.cos(a) * q * 180, y * 180, Math.sin(a) * q * 180)
    size.push(0.6 + Math.pow(r(), 6) * 3)
  }
  return { rocks, stars: new Float32Array(pos), sizes: new Float32Array(size) }
}

/** Lunar surface: grey cratered plain, harsh low sun, a dense starfield and the Earth hanging in a black sky. */
export default function EnvMoon({ intensity = 1, tint = "#fff4e6" }: Props) {
  const f = useMemo(build, [])
  const { ground, starGeo } = useMemo(() => {
    const sg = new THREE.BufferGeometry()
    sg.setAttribute("position", new THREE.BufferAttribute(f.stars, 3))
    sg.setAttribute("aSize", new THREE.BufferAttribute(f.sizes, 1))
    return { ground: terrain(), starGeo: sg }
  }, [f])
  useEffect(() => () => (ground.dispose(), starGeo.dispose()), [ground, starGeo])
  const star = useMemo(() => ({ uI: { value: 1 } }), [])
  star.uI.value = 0.5 + 0.5 * intensity
  const earth = useMemo(() => ({ uSun: { value: SUN_DIR.clone() }, uTime: { value: 0 } }), [])
  const earthRef = useRef<THREE.Mesh>(null)
  useFrame(({ clock }, dt) => {
    earth.uTime.value = clock.elapsedTime
    if (earthRef.current) earthRef.current.rotation.y += dt * 0.01
  })

  // Fragment root (not a group) so background/fog attach to the scene.
  return (
    <>
      <color attach="background" args={["#000000"]} />
      <hemisphereLight args={["#5a6680", "#303030", 0.45 * SUN * intensity]} />
      <directionalLight position={SUN_DIR.clone().multiplyScalar(50)} color={tint} intensity={1.5 * SUN * intensity} />

      <points geometry={starGeo} raycast={noRay}>
        <shaderMaterial uniforms={star} vertexShader={STAR_VERT} fragmentShader={STAR_FRAG} transparent depthWrite={false} />
      </points>
      <mesh ref={earthRef} position={[38, 52, -130]} raycast={noRay}>
        <sphereGeometry args={[13, 48, 32]} />
        <shaderMaterial uniforms={earth} vertexShader={EARTH_VERT} fragmentShader={EARTH_FRAG} />
      </mesh>

      <mesh geometry={ground} raycast={noRay}>
        <meshLambertMaterial vertexColors />
      </mesh>
      <Inst items={f.rocks}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshLambertMaterial flatShading />
      </Inst>

      {/* a small lander resting in the distance: gold-foil descent stage, grey ascent stage, four legs */}
      <group position={[11, 0, -14]} rotation-y={0.6}>
        <mesh position={[0, 1.1, 0]} raycast={noRay}>
          <cylinderGeometry args={[1.1, 1.1, 0.9, 8]} />
          <meshStandardMaterial color="#c9a13a" metalness={0.8} roughness={0.35} />
        </mesh>
        <mesh position={[0, 1.95, 0]} raycast={noRay}>
          <dodecahedronGeometry args={[0.8, 0]} />
          <meshStandardMaterial color="#b9bcc2" metalness={0.4} roughness={0.5} flatShading />
        </mesh>
        {[0, 1, 2, 3].map((k) => {
          const a = (k * Math.PI) / 2 + Math.PI / 4
          return (
            <mesh key={k} position={[Math.sin(a) * 1.35, 0.55, Math.cos(a) * 1.35]} rotation={[Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5]} raycast={noRay}>
              <cylinderGeometry args={[0.04, 0.04, 1.3, 5]} />
              <meshStandardMaterial color="#8d8f94" metalness={0.6} roughness={0.4} />
            </mesh>
          )
        })}
      </group>
    </>
  )
}
