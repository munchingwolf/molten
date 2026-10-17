"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { TorusGeometry } from "three"
import { Container, Text } from "@react-three/uikit"

const PX = 0.002 // metres per uikit pixel
const STEPS = 400 // arc resolution: the geometry is rebuilt only when the shown value crosses a step

type Props = {
  /** Progress, 0–1. */
  value?: number
  label?: string
  accent?: string
  /** Outer diameter in metres. */
  size?: number
  /** Show the percentage in the middle. */
  showValue?: boolean
}

/** 3D progress ring: a glossy tube that sweeps clockwise from 12 o'clock, with a live percentage inside. */
export default function ProgressRing({ value = 0.72, label = "Uploading", accent = "#9FE7D2", size = 0.16, showValue = true }: Props) {
  const target = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
  const tube = size * 0.04
  const R = size / 2 - tube
  const s = useRef({ x: 0, v: 0 })
  const [q, setQ] = useState(0)
  const invalidate = useThree((st) => st.invalidate)
  useEffect(() => invalidate(), [target, invalidate])

  useFrame((state, dt) => {
    const k = s.current
    if (k.x === target && k.v === 0) return
    const d = Math.min(dt, 1 / 30)
    k.v += ((target - k.x) * 90 - k.v * 16) * d // a touch under-damped: fills, nudges past, settles
    k.x += k.v * d
    if (Math.abs(target - k.x) < 1e-4 && Math.abs(k.v) < 1e-3) {
      k.x = target
      k.v = 0
    }
    const nq = Math.round(Math.min(1, Math.max(0, k.x)) * STEPS)
    if (nq !== q) setQ(nq)
    state.invalidate()
  })

  const arc = (q / STEPS) * Math.PI * 2
  const geometry = useMemo(() => new TorusGeometry(R, tube, 14, Math.max(3, Math.ceil((96 * q) / STEPS)), Math.max(1e-4, arc)), [R, tube, q, arc])
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <group>
      <mesh>
        <torusGeometry args={[R, tube * 0.55, 12, 96]} />
        <meshMatcapMaterial color="#323745" toneMapped={false} />
      </mesh>
      {q > 0 && (
        // Torus arcs run counter-clockwise from +x; rotate so this one ends at 12 o'clock and reads clockwise.
        <group position={[0, 0, 0.001]}>
          <mesh geometry={geometry} rotation={[0, 0, Math.PI / 2 - arc]}>
            <meshMatcapMaterial color={accent} toneMapped={false} />
          </mesh>
          <mesh position={[0, R, 0]}>
            <sphereGeometry args={[tube, 16, 12]} />
            <meshMatcapMaterial color={accent} toneMapped={false} />
          </mesh>
          <mesh position={[R * Math.sin(arc), R * Math.cos(arc), 0]}>
            <sphereGeometry args={[tube, 16, 12]} />
            <meshMatcapMaterial color={accent} toneMapped={false} />
          </mesh>
        </group>
      )}
      <Container pixelSize={PX} flexDirection="column" alignItems="center" gap={2} pointerEvents="none">
        {showValue && (
          <Text fontSize={size * 140} fontWeight="bold" color="#EEF0F4">
            {`${Math.round((q / STEPS) * 100)}%`}
          </Text>
        )}
        {label ? (
          <Text fontSize={size * 62} color="#9AA0AD">
            {label}
          </Text>
        ) : null}
      </Container>
    </group>
  )
}
