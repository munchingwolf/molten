"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { AdditiveBlending, CanvasTexture, Color, SRGBColorSpace, type Group, type MeshBasicMaterial } from "three"

type Props = { value?: boolean; onChange?: (open: boolean) => void; color?: string }

const W = 0.84 // leaf: standard interior door
const H = 1.98
const T = 0.04
const F = 0.06 // frame width
const OPEN = 1.65 // ~95°, swings away from you

// Warm light spilling onto the floor from the far side, fading out towards you.
function makeSpill() {
  const c = document.createElement("canvas")
  c.width = 8
  c.height = 128
  const g = c.getContext("2d")!
  const grad = g.createLinearGradient(0, 0, 0, 128)
  grad.addColorStop(0, "rgba(242,180,138,0.85)")
  grad.addColorStop(1, "rgba(242,180,138,0)")
  g.fillStyle = grad
  g.fillRect(0, 0, 8, 128)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

const EDGE_OFF = new Color("#242833")
const EDGE_ON = new Color("#F2B48A")

/** 2 m door in a frame. Press it (poke, pinch or click) to swing it open or shut on a spring; light spills through the opening. Controlled via `value`, or uncontrolled. */
export default function Door({ value, onChange, color = "#E4DED3" }: Props) {
  const [inner, setInner] = useState(false)
  const [hover, setHover] = useState(false)
  const open = value ?? inner
  const leaf = useRef<Group>(null)
  const s = useRef({ a: open ? OPEN : 0, v: 0 })
  const spill = useMemo(makeSpill, [])
  useEffect(() => () => spill.dispose(), [spill])
  const spillMat = useRef<MeshBasicMaterial>(null)
  const edges = useRef<(MeshBasicMaterial | null)[]>([])

  const toggle = () => {
    if (value === undefined) setInner(!open)
    onChange?.(!open)
  }

  // Under-damped spring: a little overshoot reads as a real, weighted door.
  useFrame((_, dt) => {
    const d = Math.min(dt, 1 / 30)
    const st = s.current
    st.v += ((open ? OPEN : 0) - st.a) * 70 * d - st.v * 9 * d
    st.a += st.v * d
    // The frame stops it shutting past closed: bounce off the stop instead.
    if (st.a < 0) {
      st.a = 0
      st.v = -st.v * 0.3
    }
    if (leaf.current) leaf.current.rotation.y = st.a
    const lit = Math.min(1, Math.max(0, st.a / OPEN))
    if (spillMat.current) spillMat.current.opacity = lit
    edges.current.forEach((m) => m?.color.copy(EDGE_OFF).lerp(EDGE_ON, lit))
  })

  const handle = hover ? "#F2B48A" : "#C9CDD6"

  return (
    <group>
      {/* Frame: two jambs + header, centred on the origin */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (W / 2 + F / 2), -F / 2, 0]}>
          <boxGeometry args={[F, H, T + 0.06]} />
          <meshStandardMaterial color="#15171E" roughness={0.5} metalness={0.2} />
        </mesh>
      ))}
      <mesh position={[0, H / 2, 0]}>
        <boxGeometry args={[W + 2 * F, F, T + 0.06]} />
        <meshStandardMaterial color="#15171E" roughness={0.5} metalness={0.2} />
      </mesh>
      {/* Inner frame edges light up as the door opens */}
      {[
        { p: [-W / 2 - 0.004, -F / 2, T / 2 + 0.031], s: [0.006, H, 0.002] },
        { p: [W / 2 + 0.004, -F / 2, T / 2 + 0.031], s: [0.006, H, 0.002] },
        { p: [0, H / 2 - F / 2 + 0.004, T / 2 + 0.031], s: [W + 0.014, 0.006, 0.002] },
      ].map(({ p, s }, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <boxGeometry args={s as [number, number, number]} />
          <meshBasicMaterial ref={(m) => void (edges.current[i] = m)} color={EDGE_OFF} toneMapped={false} />
        </mesh>
      ))}
      {/* Light spill on the floor in front of the opening */}
      <mesh position={[0, -H / 2 - F / 2 + 0.011, 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W, 0.6]} />
        <meshBasicMaterial ref={spillMat} map={spill} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* Leaf hinged on the left edge */}
      <group ref={leaf} position={[-W / 2, -F / 2, 0]}>
        <group
          position={[W / 2, 0, 0]}
          onClick={toggle}
          onPointerOver={() => setHover(true)}
          onPointerOut={() => setHover(false)}
        >
          <mesh>
            <boxGeometry args={[W - 0.004, H - 0.004, T]} />
            <meshStandardMaterial color={color} roughness={0.55} />
          </mesh>
          {/* Recessed panels, both faces */}
          {[1, -1].map((z) =>
            [0.42, -0.36].map((y) => (
              <mesh key={`${z}${y}`} position={[0, y, z * (T / 2 + 0.002)]}>
                <boxGeometry args={[W - 0.2, y > 0 ? 0.78 : 0.9, 0.004]} />
                <meshStandardMaterial color={color} roughness={0.45} />
              </mesh>
            )),
          )}
          {/* Lever handles, both faces */}
          {[1, -1].map((z) => (
            <group key={z} position={[W / 2 - 0.07, -0.02, z * (T / 2)]}>
              <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, z * 0.006]}>
                <cylinderGeometry args={[0.026, 0.026, 0.012, 24]} />
                <meshStandardMaterial color={handle} metalness={0.6} roughness={0.3} />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, z * 0.03]}>
                <cylinderGeometry args={[0.009, 0.009, 0.05, 12]} />
                <meshStandardMaterial color={handle} metalness={0.6} roughness={0.3} />
              </mesh>
              <mesh position={[-0.055, 0, z * 0.055]}>
                <boxGeometry args={[0.13, 0.018, 0.018]} />
                <meshStandardMaterial color={handle} metalness={0.6} roughness={0.3} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
      {/* Threshold */}
      <mesh position={[0, -H / 2 - F / 2 + 0.005, 0]}>
        <boxGeometry args={[W + 2 * F, 0.01, T + 0.08]} />
        <meshStandardMaterial color="#242833" roughness={0.6} />
      </mesh>
    </group>
  )
}
