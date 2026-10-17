"use client"

import { useRef, useState } from "react"
import type { ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"

const SWEEP = 1.5 * Math.PI // 270° from min to max
const DRAG_RANGE = 0.15 // metres of vertical drag for the full 0–1 range

type Props = { value?: number; onChange?: (v: number) => void; label?: string }

/** 6 cm knob. Drag up/down (mouse, ray or fingertip) to turn. Controlled via `value`, or uncontrolled. */
export default function Knob({ value, onChange, label = "Knob" }: Props) {
  const [inner, setInner] = useState(0.5)
  const [hover, setHover] = useState(false)
  const drag = useRef<{ y: number; v: number } | null>(null)
  const v = value ?? inner

  const set = (n: number) => {
    const c = Math.min(1, Math.max(0, n))
    if (value === undefined) setInner(c)
    onChange?.(c)
  }

  const down = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    drag.current = { y: e.point.y, v }
  }
  const move = (e: ThreeEvent<PointerEvent>) => {
    if (drag.current) set(drag.current.v + (e.point.y - drag.current.y) / DRAG_RANGE)
  }
  const up = () => {
    drag.current = null
  }

  return (
    <group>
      <group
        rotation={[0, 0, SWEEP / 2 - v * SWEEP]}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.025, 48]} />
          <meshStandardMaterial color={hover ? "#6A6B64" : "#55564F"} metalness={0.4} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.019, 0.0135]}>
          <boxGeometry args={[0.004, 0.018, 0.002]} />
          <meshBasicMaterial color="#1FB54A" />
        </mesh>
      </group>
      <group position={[0, -0.06, 0]}>
        <Container pixelSize={0.002} flexDirection="column" alignItems="center">
          <Text fontSize={14} color="#ECE9DF">
            {label}
          </Text>
          <Text fontSize={12} color="#A3A49D">
            {`${Math.round(v * 100)}`}
          </Text>
        </Container>
      </group>
    </group>
  )
}
