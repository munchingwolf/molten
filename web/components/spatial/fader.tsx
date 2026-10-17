"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { Group } from "three"
import type { ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

const SURFACE = "#15171E"
const BG = "#0B0C10"
const BORDER2 = "#323745"
const RAISED = "#3A4050"
const TEXT = "#EEF0F4"
const MUTED = "#9AA0AD"
const FAINT = "#6B7180"
const ACCENT = "#9FE7D2"

const TRAVEL = 0.16 // metres of cap travel from min to max
const W = 0.064
const H = TRAVEL + 0.05
const CAP = [0.046, 0.024, 0.018] as const
const FRONT = 0.006 // plate front face

type Props = {
  value?: number
  onChange?: (v: number) => void
  label?: string
  color?: string
  min?: number
  max?: number
}

/** 21 cm vertical fader with a real 3D cap. Grab the cap and slide, or tap the track to jump. `value` is in min–max units (default 0–1). Controlled via `value`, or uncontrolled. */
export default function Fader({ value, onChange, label = "Fader", color = ACCENT, min = 0, max = 1 }: Props) {
  const span = max - min || 1
  const [inner, setInner] = useState(min + span * 0.75)
  const [hover, setHover] = useState(false)
  const [active, setActive] = useState(false)
  const root = useRef<Group>(null)
  const drag = useRef<{ id: number; offset: number } | null>(null)
  const v = Math.min(max, Math.max(min, value ?? inner))
  const t = (v - min) / span // 0–1 cap position

  const plate = useMemo(() => new RoundedBoxGeometry(W, H, 0.012, 4, 0.008), [])
  const cap = useMemo(() => new RoundedBoxGeometry(CAP[0], CAP[1], CAP[2], 4, 0.005), [])
  useEffect(() => () => (plate.dispose(), cap.dispose()), [plate, cap])

  const set = (n: number) => {
    const c = min + Math.min(1, Math.max(0, n)) * span
    if (value === undefined) setInner(c)
    onChange?.(c)
  }
  // Pointer position along the track, 0–1, in the fader's own space (works when the Studio rotates or scales it).
  const at = (e: ThreeEvent<PointerEvent>) => (root.current ? root.current.worldToLocal(e.point.clone()).y / TRAVEL + 0.5 : t)

  const down = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    const p = at(e)
    const onCap = Math.abs(p - t) <= CAP[1] / 2 / TRAVEL
    drag.current = { id: e.pointerId, offset: onCap ? p - t : 0 } // grabbing the cap keeps its offset, so it doesn't jump
    if (!onCap) set(p)
    setActive(true)
  }
  const move = (e: ThreeEvent<PointerEvent>) => {
    if (drag.current?.id === e.pointerId) set(at(e) - drag.current.offset)
  }
  const up = (e: ThreeEvent<PointerEvent>) => {
    if (drag.current?.id !== e.pointerId) return
    drag.current = null
    setActive(false)
  }

  const capY = -TRAVEL / 2 + t * TRAVEL
  const lit = active || hover

  return (
    <group ref={root}>
      <mesh geometry={plate}>
        <meshStandardMaterial color={SURFACE} roughness={0.75} metalness={0.1} />
      </mesh>
      {/* track slot + level fill */}
      <mesh position={[0, 0, FRONT + 0.0005]}>
        <boxGeometry args={[0.008, TRAVEL + 0.012, 0.001]} />
        <meshBasicMaterial color={BG} />
      </mesh>
      <mesh position={[0, -TRAVEL / 2 + (t * TRAVEL) / 2, FRONT + 0.0012]} scale={[1, Math.max(t * TRAVEL, 1e-4), 1]}>
        <boxGeometry args={[0.003, 1, 0.001]} />
        <meshBasicMaterial color={color} transparent opacity={lit ? 1 : 0.7} />
      </mesh>
      {Array.from({ length: 11 }).flatMap((_, i) => {
        const major = i % 5 === 0
        return [-1, 1].map((side) => (
          <mesh key={`${i}${side}`} position={[side * (major ? 0.019 : 0.0205), -TRAVEL / 2 + (i / 10) * TRAVEL, FRONT + 0.0005]}>
            <boxGeometry args={[major ? 0.011 : 0.008, 0.0012, 0.001]} />
            <meshBasicMaterial color={major ? FAINT : BORDER2} />
          </mesh>
        ))
      })}
      {/* cap */}
      <group position={[0, capY, FRONT + CAP[2] / 2]}>
        <mesh geometry={cap}>
          <meshStandardMaterial
            color={lit ? RAISED : BORDER2}
            metalness={0.35}
            roughness={0.38}
            emissive={color}
            emissiveIntensity={active ? 0.22 : 0}
          />
        </mesh>
        <mesh position={[0, 0, CAP[2] / 2 + 0.0004]}>
          <boxGeometry args={[CAP[0] - 0.008, 0.0028, 0.0008]} />
          <meshBasicMaterial color={lit ? color : TEXT} />
        </mesh>
      </group>
      {/* Static hit box in front of everything, so poke, ray and mouse all land on it. */}
      <mesh
        visible={false}
        position={[0, 0, 0.012]}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <boxGeometry args={[W, TRAVEL + CAP[1], 0.03]} />
      </mesh>
      <group position={[0, -H / 2 - 0.03, 0]}>
        <Container pixelSize={0.002} flexDirection="column" alignItems="center" gap={2} pointerEvents="none">
          <Text fontSize={16} fontWeight="bold" color={lit ? color : TEXT}>
            {span > 1 ? `${Math.round(v)}` : `${Math.round(t * 100)}`}
          </Text>
          <Text fontSize={12} color={MUTED}>
            {label}
          </Text>
        </Container>
      </group>
    </group>
  )
}
