"use client"

import { useRef, useState } from "react"
import type { Mesh } from "three"
import { useFrame } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"

const TRAVEL = 0.02 // thumb offset from centre, metres
const K = 900 // spring stiffness
const C = 18 // damping; under-damped (C < 2*sqrt(K) = 60) so the thumb overshoots and bounces

type Props = { value?: boolean; onChange?: (v: boolean) => void; label?: string }

/** 8 cm toggle switch whose thumb snaps over with a bouncy spring. Tap to flip. Controlled via `value`, or uncontrolled. */
export default function SpringToggle({ value, onChange, label = "Toggle" }: Props) {
  const [inner, setInner] = useState(false)
  const [hover, setHover] = useState(false)
  const on = value ?? inner
  const thumb = useRef<Mesh>(null)
  const vel = useRef(0)

  useFrame((_, delta) => {
    const m = thumb.current
    if (!m) return
    const dt = Math.min(delta, 1 / 30) // keep the integrator stable through frame drops
    vel.current += ((on ? TRAVEL : -TRAVEL) - m.position.x) * K * dt - vel.current * C * dt
    m.position.x += vel.current * dt
  })

  const flip = () => {
    if (value === undefined) setInner(!on)
    onChange?.(!on)
  }

  return (
    <group>
      <group onClick={flip} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
        <mesh>
          <boxGeometry args={[0.08, 0.04, 0.008]} />
          <meshStandardMaterial color={on ? "#9FE7D2" : hover ? "#262A35" : "#1B1E27"} roughness={0.6} />
        </mesh>
        {/* x is driven by the spring in useFrame; initial position only. */}
        <mesh ref={thumb} position={[on ? TRAVEL : -TRAVEL, 0, 0.008]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.016, 0.016, 0.01, 32]} />
          <meshStandardMaterial color={on ? "#06221B" : "#EEF0F4"} roughness={0.4} />
        </mesh>
      </group>
      <group position={[0, -0.045, 0]}>
        <Container pixelSize={0.002} flexDirection="column" alignItems="center">
          <Text fontSize={14} color="#EEF0F4">
            {label}
          </Text>
          <Text fontSize={12} color="#9AA0AD">
            {on ? "On" : "Off"}
          </Text>
        </Container>
      </group>
    </group>
  )
}
