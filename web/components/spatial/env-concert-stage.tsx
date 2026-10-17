"use client"

import { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

type Props = { intensity?: number; tint?: string }

// Environment meshes never take pointer rays, so hands and rays reach the components.
const noRay = () => null

const TRUSS_Y = 6.2
const TRUSS_Z = -5.5
const HEAD_Y = TRUSS_Y - 0.45
const HEADS = [-6.25, -3.75, -1.25, 1.25, 3.75, 6.25]
const BEAM_LEN = 6.5
const BEAM_COLORS = ["#ff2e88", "#2e9bff", "#ffc93d"]

/** Writes a grey vertex colour per vertex (1 = full light, 0 = none) for cheap additive fades. */
function fade(g: THREE.BufferGeometry, f: (x: number, y: number, z: number) => number) {
  const p = g.attributes.position
  const col = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) col.fill(f(p.getX(i), p.getY(i), p.getZ(i)), i * 3, i * 3 + 3)
  g.setAttribute("color", new THREE.BufferAttribute(col, 3))
  return g
}

/** Goalpost truss (two towers + top beam) as straight box members, drawn in one instanced call. */
function trussMembers() {
  const out: THREE.Matrix4[] = []
  const up = new THREE.Vector3(0, 1, 0)
  const bar = (a: THREE.Vector3, b: THREE.Vector3, t: number) => {
    const d = b.clone().sub(a)
    const len = d.length()
    const q = new THREE.Quaternion().setFromUnitVectors(up, d.normalize())
    out.push(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(t, len, t)))
  }
  const truss = (p: THREE.Vector3, q: THREE.Vector3, s = 0.4) => {
    const dir = q.clone().sub(p)
    const len = dir.length()
    dir.normalize()
    const side = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : up
    const u = new THREE.Vector3().crossVectors(dir, side).normalize().multiplyScalar(s / 2)
    const v = new THREE.Vector3().crossVectors(dir, u).normalize().multiplyScalar(s / 2)
    const corners = [u.clone().add(v), u.clone().sub(v), u.clone().negate().sub(v), u.clone().negate().add(v)]
    corners.forEach((c) => bar(p.clone().add(c), q.clone().add(c), 0.05))
    const bays = Math.round(len / 0.5)
    for (let i = 0; i < bays; i++) {
      const a = p.clone().addScaledVector(dir, (len * i) / bays)
      const b = p.clone().addScaledVector(dir, (len * (i + 1)) / bays)
      for (let k = 0; k < 4; k++) {
        const [c1, c2] = i % 2 ? [corners[k], corners[(k + 1) % 4]] : [corners[(k + 1) % 4], corners[k]]
        bar(a.clone().add(c1), b.clone().add(c2), 0.025)
      }
    }
  }
  truss(new THREE.Vector3(-7.5, 0, TRUSS_Z), new THREE.Vector3(-7.5, TRUSS_Y, TRUSS_Z))
  truss(new THREE.Vector3(7.5, 0, TRUSS_Z), new THREE.Vector3(7.5, TRUSS_Y, TRUSS_Z))
  truss(new THREE.Vector3(-7.7, TRUSS_Y, TRUSS_Z), new THREE.Vector3(7.7, TRUSS_Y, TRUSS_Z))
  return out
}

function Truss() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const members = useMemo(trussMembers, [])
  useLayoutEffect(() => {
    const mesh = ref.current!
    members.forEach((m, i) => mesh.setMatrixAt(i, m))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [members])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, members.length]} raycast={noRay}>
      <boxGeometry />
      <meshLambertMaterial color="#8b8f98" />
    </instancedMesh>
  )
}

const LED_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const LED_FRAG = /* glsl */ `
uniform float uTime; uniform float uI; uniform vec3 uA; uniform vec3 uB; varying vec2 vUv;
void main() {
  float w = 0.5 + 0.5 * sin(vUv.x * 8.0 - uTime * 1.2 + sin(vUv.y * 3.0 + uTime * 0.7) * 1.5);
  float bars = 0.75 + 0.25 * step(0.5, fract(vUv.y * 9.0 - uTime * 0.4));
  gl_FragColor = vec4(mix(uA, uB, w) * (0.2 + 0.8 * w * w) * bars * uI, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

/** Dark concert stage: truss, sweeping colored beams, LED wall, glossy floor and an audience glow. */
export default function EnvConcertStage({ intensity = 1, tint = "#b14dff" }: Props) {
  const heads = useRef<(THREE.Group | null)[]>([])
  const pools = useRef<(THREE.Mesh | null)[]>([])
  const spotTarget = useMemo(() => new THREE.Object3D(), [])
  const fohTarget = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(0, 1, -6)
    return o
  }, [])

  const { beamGeo, poolGeo, glowGeo, crowd } = useMemo(() => {
    const beamGeo = new THREE.ConeGeometry(0.9, BEAM_LEN, 20, 1, true).translate(0, -BEAM_LEN / 2, 0)
    fade(beamGeo, (_x, y) => 1 + (y / BEAM_LEN) * 0.92)
    const poolGeo = fade(new THREE.CircleGeometry(1, 24), (x, y) => 1 - Math.hypot(x, y))
    const glowGeo = fade(new THREE.CircleGeometry(9, 32), (x, y) => 1 - Math.hypot(x, y) / 9)
    // Phone lights / wristbands around and behind the viewer, never within 1.5 m.
    let s = 9
    const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
    const pts: number[] = []
    while (pts.length < 180 * 3) {
      const x = (r() - 0.5) * 18
      const z = -3.5 + r() * 16
      if (Math.hypot(x, z) < 2.5 || (Math.abs(x) < 3 && z < 1)) continue
      pts.push(x, 1.4 + r() * 0.9, z)
    }
    const crowd = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pts, 3))
    return { beamGeo, poolGeo, glowGeo, crowd }
  }, [])
  useEffect(() => () => [beamGeo, poolGeo, glowGeo, crowd].forEach((g) => g.dispose()), [beamGeo, poolGeo, glowGeo, crowd])

  const led = useMemo(
    () => ({ uTime: { value: 0 }, uI: { value: 1 }, uA: { value: new THREE.Color() }, uB: { value: new THREE.Color("#2e9bff") } }),
    [],
  )
  led.uA.value.set(tint)
  led.uI.value = intensity

  const beamColors = [tint, ...BEAM_COLORS]
  const dir = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    led.uTime.value = t
    HEADS.forEach((x, i) => {
      const g = heads.current[i]
      const p = pools.current[i]
      if (!g || !p) return
      // tilt range keeps every beam on the stage / front floor, away from the component area
      g.rotation.set(0.1 + Math.sin(t * 0.6 + i * 1.7) * 0.4, 0, Math.sin(t * 0.45 + i * 2.3) * 0.45)
      dir.set(0, -1, 0).applyEuler(g.rotation)
      let y = 0
      let d = HEAD_Y / -dir.y
      if (TRUSS_Z + dir.z * d < -6 && Math.abs(x + dir.x * d) < 7) {
        y = 1 // beam lands on the stage deck
        d = (HEAD_Y - 1) / -dir.y
      }
      p.position.set(x + dir.x * d, y + 0.012, TRUSS_Z + dir.z * d)
      p.scale.setScalar(d * 0.14)
    })
    spotTarget.position.set(Math.sin(t * 0.5) * 4, 0, -4.5 + Math.sin(t * 0.37) * 1.5)
  })

  return (
    <group>
      <color attach="background" args={["#050508"]} />
      <fog attach="fog" args={["#07060c", 8, 36]} />
      <ambientLight color="#3a3358" intensity={0.9 * intensity} />
      {/* moving wash from the truss + a static front-of-house light so components stay readable */}
      <spotLight position={[-3, HEAD_Y, TRUSS_Z]} target={spotTarget} color={tint} intensity={90 * intensity} angle={0.45} penumbra={0.7} distance={20} />
      <spotLight position={[0, 6, 8]} target={fohTarget} color="#ffe6cc" intensity={60 * intensity} angle={0.5} penumbra={0.8} distance={24} />
      <primitive object={spotTarget} />
      <primitive object={fohTarget} />

      {/* glossy floor: Phong specular catches the spotlights */}
      <mesh rotation-x={-Math.PI / 2} raycast={noRay}>
        <planeGeometry args={[34, 34]} />
        <meshPhongMaterial color="#0a0a0e" specular="#5a5a70" shininess={110} />
      </mesh>

      {/* stage deck, front LED strip, LED wall, speaker stacks */}
      <mesh position={[0, 0.5, -9]} raycast={noRay}>
        <boxGeometry args={[14, 1, 6]} />
        <meshPhongMaterial color="#121217" specular="#33333d" shininess={60} />
      </mesh>
      <mesh position={[0, 1.0, -5.99]} raycast={noRay}>
        <boxGeometry args={[14, 0.04, 0.04]} />
        <meshBasicMaterial color={tint} toneMapped={false} />
      </mesh>
      <mesh position={[0, 3.7, -11.9]} raycast={noRay}>
        <planeGeometry args={[12, 4.6]} />
        <shaderMaterial uniforms={led} vertexShader={LED_VERT} fragmentShader={LED_FRAG} />
      </mesh>
      {[-9.3, 9.3].map((x) => (
        <group key={x} position={[x, 0, -7]}>
          <mesh position={[0, 1.1, 0]} raycast={noRay}>
            <boxGeometry args={[1.3, 2.2, 1.1]} />
            <meshLambertMaterial color="#141418" />
          </mesh>
          <mesh position={[0, 2.75, 0]} raycast={noRay}>
            <boxGeometry args={[1.3, 1.1, 1.1]} />
            <meshLambertMaterial color="#18181d" />
          </mesh>
        </group>
      ))}

      <Truss />

      {/* moving heads: body + additive beam cone, and a fake light pool where the beam lands */}
      {HEADS.map((x, i) => {
        const c = beamColors[i % beamColors.length]
        return (
          <group key={x}>
            <mesh position={[x, HEAD_Y + 0.2, TRUSS_Z]} raycast={noRay}>
              <boxGeometry args={[0.26, 0.3, 0.26]} />
              <meshLambertMaterial color="#1c1c22" />
            </mesh>
            <group ref={(g) => { heads.current[i] = g }} position={[x, HEAD_Y, TRUSS_Z]}>
              <mesh geometry={beamGeo} raycast={noRay}>
                <meshBasicMaterial color={c} vertexColors transparent opacity={0.16 * intensity} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
              </mesh>
            </group>
            <mesh ref={(m) => { pools.current[i] = m }} geometry={poolGeo} rotation-x={-Math.PI / 2} raycast={noRay}>
              <meshBasicMaterial color={c} vertexColors transparent opacity={0.55 * intensity} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
          </group>
        )
      })}

      {/* audience area: floor glow around the viewer + scattered phone lights */}
      <mesh geometry={glowGeo} position={[0, 0.006, 2]} rotation-x={-Math.PI / 2} raycast={noRay}>
        <meshBasicMaterial color={tint} vertexColors transparent opacity={0.3 * intensity} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <points geometry={crowd} raycast={noRay}>
        <pointsMaterial color="#fff1d6" size={0.05} transparent opacity={0.85} toneMapped={false} />
      </points>
    </group>
  )
}
