"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

type Props = { intensity?: number; tint?: string }

// Environment meshes never take pointer rays, so hands and rays reach the components.
const noRay = () => null

const BG = "#1a0906"
// three r155+ lights are physical; these factors keep the legacy-light look.
const SUN = Math.PI
const POINT = Math.PI * 2
const PEAK: [number, number, number] = [-10, 34, -95]

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

const NOISE = /* glsl */ `
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }`

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
// Ash sky: ember-orange horizon, smoky brown bands, near-black zenith, a red glow behind the volcano.
const SKY_FRAG = /* glsl */ `
uniform float uI; uniform float uTime; uniform vec3 uPeak; varying vec3 vDir;
${NOISE}
void main() {
  float h = clamp(vDir.y, 0.0, 1.0);
  vec3 col = mix(vec3(0.75, 0.25, 0.08), vec3(0.28, 0.08, 0.05), smoothstep(0.0, 0.12, h));
  col = mix(col, vec3(0.05, 0.02, 0.02), smoothstep(0.1, 0.6, h));
  vec2 uv = vec2(atan(vDir.x, vDir.z) * 3.0, h * 8.0);
  float smoke = n2(uv + vec2(uTime * 0.02, 0.0)) * 0.6 + n2(uv * 2.3) * 0.4;
  col *= 0.75 + smoke * 0.5;
  float g = distance(vDir, uPeak);
  col += vec3(1.0, 0.3, 0.05) * exp(-g * 4.0) * 0.6;
  gl_FragColor = vec4(col * uI, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

// Basalt ground with glowing, slowly pulsing lava cracks (ridged noise), lit by a fixed key light.
const GROUND_VERT = /* glsl */ `
varying vec3 vW; varying vec3 vN;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`
const GROUND_FRAG = /* glsl */ `
uniform float uTime; uniform float uI; uniform vec3 uLava; uniform vec3 uFog; varying vec3 vW; varying vec3 vN;
${NOISE}
void main() {
  float dist = length(vW.xz);
  float n = n2(vW.xz * 0.35) * 0.65 + n2(vW.xz * 0.9) * 0.35;
  float crack = 1.0 - smoothstep(0.0, 0.018 + 0.012 * n2(vW.xz * 2.0), abs(n - 0.5));
  crack *= smoothstep(4.5, 7.0, dist);           // keep the work area solid rock
  float pulse = 0.75 + 0.25 * sin(uTime * 1.3 + vW.x * 0.2 + vW.z * 0.15);
  vec3 rock = mix(vec3(0.012, 0.01, 0.01), vec3(0.045, 0.035, 0.032), n2(vW.xz * 3.0) * 0.6 + n2(vW.xz * 11.0) * 0.4);
  float lit = 0.35 + 0.65 * max(dot(vN, normalize(vec3(-0.2, 0.6, -0.8))), 0.0);
  vec3 col = rock * lit * uI + uLava * crack * pulse * 1.6;
  col += uLava * 0.08 * smoothstep(0.25, 0.0, abs(n - 0.5)) * smoothstep(4.5, 7.0, dist); // heat bleed
  col = mix(col, uFog, smoothstep(25.0, 110.0, length(vW - cameraPosition)));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`

const EMBER_VERT = /* glsl */ `
uniform float uTime; attribute float aSeed; varying float vA;
void main() {
  vec3 p = position;
  float t = mod(uTime * (0.3 + aSeed * 0.5) + aSeed * 10.0, 9.0);
  p.y += t;
  p.x += sin(t * 1.5 + aSeed * 30.0) * 0.5;
  vA = smoothstep(0.0, 1.0, t) * (1.0 - smoothstep(6.0, 9.0, t));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (30.0 + aSeed * 30.0) / -mv.z;
  gl_Position = projectionMatrix * mv;
}`
const EMBER_FRAG = /* glsl */ `
uniform vec3 uLava; varying float vA;
void main() { float a = 1.0 - smoothstep(0.0, 0.5, length(gl_PointCoord - 0.5)); gl_FragColor = vec4(uLava * 1.5, a * vA); }`

/** Terrain: flat basalt pad around the viewer, broken ground rising outward. */
function terrain() {
  const g = new THREE.PlaneGeometry(240, 240, 120, 120)
  g.rotateX(-Math.PI / 2)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const z = p.getZ(i)
    const d = Math.hypot(x, z)
    const y = (Math.sin(x * 0.11) * Math.cos(z * 0.09) * 1.6 + Math.sin(x * 0.04 + z * 0.05) * 3 + Math.abs(Math.sin(x * 0.37 + z * 0.21)) * 0.5)
    p.setY(i, y * THREE.MathUtils.smoothstep(d, 6, 30) + THREE.MathUtils.smoothstep(d, 40, 110) * 6)
  }
  g.computeVertexNormals()
  return g
}

// Volcano silhouette as [radius, height] from base to crater lip and down into the crater.
const PROFILE: [number, number][] = [[62, -4], [50, 4], [38, 12], [27, 21], [18, 29], [12.5, 34], [10.5, 33.4], [8.5, 30.5]]
// Smooth wobble by angle (not per-vertex random) so the lathe seam stays closed.
const wobble = (a: number) => 1 + Math.sin(a * 5) * 0.05 + Math.sin(a * 11 + 1) * 0.03

/** The volcano: a lathed, wobbled cone with a crater lip. */
function volcano() {
  const g = new THREE.LatheGeometry(PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 48)
  const p = g.attributes.position
  const col = new Float32Array(p.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < p.count; i++) {
    const k = wobble(Math.atan2(p.getX(i), p.getZ(i)))
    p.setX(i, p.getX(i) * k)
    p.setZ(i, p.getZ(i) * k)
    // basalt with ember-lit upper slopes
    c.setRGB(0.05, 0.04, 0.04).lerp(new THREE.Color(0.3, 0.08, 0.03), THREE.MathUtils.smoothstep(p.getY(i), 22, 34))
    c.toArray(col, i * 3)
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

/** Lava rivulets: tubes that follow the volcano's surface from the lip down the front face. */
function lavaFlows() {
  const geos: THREE.BufferGeometry[] = []
  for (const [a0, len] of [[-0.35, 0.8], [-0.12, 1], [0.18, 0.65], [0.4, 0.9]] as const) {
    const pts: THREE.Vector3[] = []
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const f = t * (PROFILE.length - 4) * len
      const i = Math.min(Math.floor(f), PROFILE.length - 5)
      const [r0, y0] = PROFILE[5 - i]
      const [r1, y1] = PROFILE[Math.max(0, 4 - i)]
      const k = f - i
      const a = a0 + Math.sin(t * 6 + a0 * 10) * 0.04
      const rad = (r0 + (r1 - r0) * k) * wobble(a) + 0.5
      pts.push(new THREE.Vector3(Math.sin(a) * rad, y0 + (y1 - y0) * k + 0.3, Math.cos(a) * rad))
    }
    geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.9, 5))
  }
  return geos
}

function build() {
  let s = 19
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
  const columns: Item[] = []
  const rocks: Item[] = []
  const smoke: Item[] = []
  // Clusters of hexagonal basalt columns.
  for (let c = 0; c < 9; c++) {
    const a = (c / 9) * Math.PI * 2 + r() * 0.4
    const d = 9 + r() * 14
    const cx = Math.sin(a) * d
    const cz = Math.cos(a) * d
    const n = 5 + Math.floor(r() * 7)
    for (let i = 0; i < n; i++) {
      const h = 0.6 + r() * 3.2
      const ox = (r() - 0.5) * 3
      const oz = (r() - 0.5) * 3
      columns.push({ m: mat(cx + ox, h / 2 - 0.2, cz + oz, 0.55, h, 0.55, r()), c: new THREE.Color().setHSL(0.03, 0.1, 0.1 + r() * 0.07) })
    }
  }
  for (let i = 0; i < 50; i++) {
    const a = r() * Math.PI * 2
    const d = 5.5 + r() * 25
    const k = 0.15 + r() * r() * 0.9
    rocks.push({ m: mat(Math.sin(a) * d, k * 0.2, Math.cos(a) * d, k, k * 0.7, k, r() * 6, r()) })
  }
  // Ash plume: puffs widening as they rise from the crater.
  for (let i = 0; i < 22; i++) {
    const t = i / 22
    const k = 6 + t * 16 + r() * 4
    smoke.push({ m: mat(PEAK[0] + (r() - 0.5) * 12 * (1 + t) + t * t * 30, PEAK[1] + 2 + t * 60, PEAK[2] - 6 - r() * 12, k, k * 0.85, k, r() * 6, r() * 3), c: new THREE.Color().setHSL(0.03, 0.08, 0.08 + (1 - t) * 0.06) })
  }
  const pos: number[] = []
  const seeds: number[] = []
  for (let i = 0; i < 220; i++) {
    const a = r() * Math.PI * 2
    const d = 3 + r() * 25
    pos.push(Math.sin(a) * d, r() * 0.5, Math.cos(a) * d)
    seeds.push(r())
  }
  return { columns, rocks, smoke, embers: new Float32Array(pos), seeds: new Float32Array(seeds) }
}

/** Volcanic plain at night: erupting volcano, ash plume, lava rivulets, glowing cracks, basalt columns and rising embers. */
export default function EnvVolcano({ intensity = 1, tint = "#ff5a14" }: Props) {
  const f = useMemo(build, [])
  const { ground, cone, emberGeo, flows } = useMemo(() => {
    const eg = new THREE.BufferGeometry()
    eg.setAttribute("position", new THREE.BufferAttribute(f.embers, 3))
    eg.setAttribute("aSeed", new THREE.BufferAttribute(f.seeds, 1))
    eg.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 5, 0), 40)
    return { ground: terrain(), cone: volcano(), emberGeo: eg, flows: lavaFlows() }
  }, [f])
  useEffect(() => () => (ground.dispose(), cone.dispose(), emberGeo.dispose(), flows.forEach((g) => g.dispose())), [ground, cone, emberGeo, flows])

  const u = useMemo(
    () => ({
      sky: { uI: { value: 1 }, uTime: { value: 0 }, uPeak: { value: new THREE.Vector3(...PEAK).normalize() } },
      ground: { uI: { value: 1 }, uTime: { value: 0 }, uLava: { value: new THREE.Color() }, uFog: { value: new THREE.Color(BG) } },
      ember: { uTime: { value: 0 }, uLava: { value: new THREE.Color() } },
    }),
    [],
  )
  u.sky.uI.value = u.ground.uI.value = 0.4 + 0.6 * intensity
  u.ground.uLava.value.set(tint)
  u.ember.uLava.value.set(tint)

  const plume = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    u.sky.uTime.value = u.ground.uTime.value = u.ember.uTime.value = t
    if (plume.current) plume.current.position.y = Math.sin(t * 0.2) * 0.8
  })

  return (
    // Fragment root (not a group) so background/fog attach to the scene.
    <>
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 25, 140]} />
      <hemisphereLight args={["#7a3420", "#120808", 0.5 * SUN * intensity]} />
      <directionalLight position={[-10, 20, -60]} color="#ff7a3a" intensity={0.9 * SUN * intensity} />
      <pointLight position={[PEAK[0], PEAK[1] + 3, PEAK[2]]} color={tint} intensity={150 * POINT * intensity} distance={80} decay={1.5} />

      <mesh scale={190} renderOrder={-1} raycast={noRay}>
        <sphereGeometry args={[1, 32, 16]} />
        <shaderMaterial uniforms={u.sky} vertexShader={SKY_VERT} fragmentShader={SKY_FRAG} side={THREE.BackSide} depthWrite={false} />
      </mesh>

      <mesh geometry={ground} raycast={noRay}>
        <shaderMaterial uniforms={u.ground} vertexShader={GROUND_VERT} fragmentShader={GROUND_FRAG} />
      </mesh>

      <group position={PEAK} >
        <mesh geometry={cone} position={[0, -34, 0]} raycast={noRay}>
          <meshLambertMaterial vertexColors flatShading fog={false} />
        </mesh>
        {flows.map((g, i) => (
          <mesh key={i} geometry={g} position={[0, -34, 0]} raycast={noRay}>
            <meshBasicMaterial color={tint} toneMapped={false} fog={false} />
          </mesh>
        ))}
        {/* molten crater pool */}
        <mesh position={[0, -3.5, 0]} rotation-x={-Math.PI / 2} raycast={noRay}>
          <circleGeometry args={[9, 20]} />
          <meshBasicMaterial color={tint} toneMapped={false} fog={false} />
        </mesh>
      </group>
      <group ref={plume}>
        <Inst items={f.smoke}>
          <icosahedronGeometry args={[1, 1]} />
          <meshLambertMaterial flatShading emissive="#4a1406" emissiveIntensity={0.5} fog={false} />
        </Inst>
      </group>

      <Inst items={f.columns}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshLambertMaterial flatShading />
      </Inst>
      <Inst items={f.rocks}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshLambertMaterial color="#1e1614" flatShading />
      </Inst>

      <points geometry={emberGeo} raycast={noRay}>
        <shaderMaterial uniforms={u.ember} vertexShader={EMBER_VERT} fragmentShader={EMBER_FRAG} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </>
  )
}
