"use client"

import { useMemo, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { AdditiveBlending, BufferAttribute, CylinderGeometry, LatheGeometry, Vector2, type Group, type MeshBasicMaterial, type PointLight } from "three"

type Props = {
  /** Cord length in metres, ceiling to shade. */
  cord?: number
  shade?: "dome" | "globe" | "cone"
  color?: string
  /** Light colour. */
  glow?: string
  value?: boolean
  onChange?: (on: boolean) => void
}

const G = 9.81
const DAMP = 0.6 // 1/s: a few seconds of swing, like a real fixture

let beamGeo: CylinderGeometry | undefined
/** Open cone whose vertex colours fade from the shade to nothing, so additive blending reads as a soft beam. */
function getBeam() {
  if (beamGeo) return beamGeo
  const g = new CylinderGeometry(0.19, 0.8, 1.3, 48, 8, true)
  const pos = g.attributes.position
  const col = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) + 0.65) / 1.3 // 0 at the floor end, 1 at the shade
    const v = t * t
    col.set([v, v, v], i * 3)
  }
  g.setAttribute("color", new BufferAttribute(col, 3))
  return (beamGeo = g)
}

function shadeProfile(kind: Props["shade"]) {
  // Lathe profiles (radius, height) from the top of the shade down; the shade opens downward.
  if (kind === "cone")
    return [new Vector2(0.025, 0), new Vector2(0.03, -0.01), new Vector2(0.15, -0.2), new Vector2(0.152, -0.205)]
  if (kind === "globe") return []
  const pts: Vector2[] = [new Vector2(0.025, 0)]
  for (let i = 0; i <= 16; i++) {
    const t = i / 16
    pts.push(new Vector2(0.03 + Math.sin((t * Math.PI) / 2) * 0.17, -Math.pow(t, 1.6) * 0.14 - 0.005))
  }
  pts.push(new Vector2(0.202, -0.148))
  return pts
}

/**
 * Ceiling pendant on a fabric cord. Its origin is the ceiling attach point, so hang it from the ceiling height.
 * Tap to switch it on or off (value/onChange; the light fades); touch or brush it and it swings like a real pendulum.
 */
export default function PendantLight({ cord = 0.9, shade = "dome", color = "#ECE7DF", glow = "#FFD9A8", value, onChange }: Props) {
  const [local, setLocal] = useState(true)
  const on = value ?? local
  const L = Math.max(0.2, cord)
  const swing = useRef<Group>(null)
  const light = useRef<PointLight>(null)
  const bulb = useRef<MeshBasicMaterial>(null)
  const inner = useRef<MeshBasicMaterial>(null)
  const beam = useRef<MeshBasicMaterial>(null)
  const lens = useRef<MeshBasicMaterial>(null)
  const s = useRef({ ax: 0, az: 0, vx: 0, vz: 0, lit: on ? 1 : 0 })
  const profile = useMemo(() => {
    const pts = shadeProfile(shade)
    return pts.length ? new LatheGeometry(pts, 64) : null
  }, [shade])

  useFrame((state, dt) => {
    const m = s.current
    const h = Math.min(dt, 1 / 30)
    // Small-angle pendulum with air damping, integrated per axis (semi-implicit Euler).
    const w2 = G / (L + 0.12)
    m.vx += (-w2 * m.ax - DAMP * m.vx) * h
    m.vz += (-w2 * m.az - DAMP * m.vz) * h
    m.ax += m.vx * h
    m.az += m.vz * h
    m.lit += ((on ? 1 : 0) - m.lit) * (1 - Math.exp(-h * 7))
    if (swing.current) swing.current.rotation.set(m.ax, 0, m.az)
    if (light.current) light.current.intensity = 2.6 * m.lit
    const warm = 0.25 + 0.75 * m.lit
    if (bulb.current) bulb.current.color.set(glow).multiplyScalar(warm)
    if (inner.current) inner.current.color.set(glow).multiplyScalar(0.15 + 0.85 * m.lit)
    if (beam.current) beam.current.opacity = 0.16 * m.lit
    if (lens.current) lens.current.color.set(glow).multiplyScalar(0.2 + 0.8 * m.lit)
    if (Math.abs(m.vx) + Math.abs(m.vz) + Math.abs(m.ax) + Math.abs(m.az) > 1e-4 || Math.abs((on ? 1 : 0) - m.lit) > 1e-3) state.invalidate()
  })

  // A brush from the pointer pushes the shade the way the pointer was moving.
  const push = (e: ThreeEvent<PointerEvent>) => {
    const m = s.current
    const d = e.ray?.direction
    if (!d) return
    m.vz += -d.x * 0.9
    m.vx += d.z * 0.9
  }
  const toggle = () => {
    const next = !on
    setLocal(next)
    onChange?.(next)
    s.current.vx += 0.25 // the switch tug sets it swaying a little
  }

  return (
    <group>
      {/* Ceiling canopy */}
      <mesh position={[0, -0.012, 0]}>
        <cylinderGeometry args={[0.055, 0.06, 0.024, 48]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.35} />
      </mesh>
      <group ref={swing}>
        {/* Fabric cord */}
        <mesh position={[0, -L / 2 - 0.02, 0]}>
          <cylinderGeometry args={[0.0035, 0.0035, L, 10]} />
          <meshStandardMaterial color="#15161A" roughness={0.9} />
        </mesh>
        <group position={[0, -L - 0.02, 0]} onPointerOver={push} onClick={toggle}>
          {/* Socket */}
          <mesh position={[0, -0.02, 0]}>
            <cylinderGeometry args={[0.022, 0.026, 0.05, 32]} />
            <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
          </mesh>
          {profile ? (
            <>
              <mesh geometry={profile}>
                <meshStandardMaterial color={color} metalness={0.25} roughness={0.45} side={2} />
              </mesh>
              {/* Lit inside of the shade */}
              <mesh geometry={profile} scale={[0.985, 1, 0.985]}>
                <meshBasicMaterial ref={inner} color={glow} side={1} />
              </mesh>
            </>
          ) : (
            <mesh position={[0, -0.13, 0]}>
              <sphereGeometry args={[0.12, 48, 32]} />
              <meshPhysicalMaterial color="#ffffff" roughness={0.15} transmission={0.6} thickness={0.02} transparent opacity={0.55} />
            </mesh>
          )}
          {/* Bulb */}
          <mesh position={[0, shade === "globe" ? -0.13 : -0.075, 0]}>
            <sphereGeometry args={[0.032, 24, 16]} />
            <meshBasicMaterial ref={bulb} color={glow} />
          </mesh>
          {/* Frosted diffuser across the opening, and a soft beam of light under it (fades with the switch). */}
          {shade !== "globe" && (
            <mesh position={[0, shade === "cone" ? -0.2 : -0.146, 0]} rotation-x={Math.PI / 2}>
              <circleGeometry args={[shade === "cone" ? 0.148 : 0.196, 48]} />
              <meshBasicMaterial ref={lens} color={glow} transparent opacity={0.85} />
            </mesh>
          )}
          <mesh position={[0, -0.8, 0]} geometry={getBeam()} raycast={() => {}}>
            <meshBasicMaterial ref={beam} color={glow} vertexColors transparent opacity={0.16} blending={AdditiveBlending} depthWrite={false} />
          </mesh>
          <pointLight ref={light} position={[0, -0.12, 0]} color={glow} intensity={2.6} distance={5} decay={2} />
        </group>
      </group>
    </group>
  )
}
