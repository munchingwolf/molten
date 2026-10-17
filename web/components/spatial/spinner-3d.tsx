"use client"

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import type { Group, Mesh } from "three"
import { Container, Text } from "@react-three/uikit"

const PX = 0.002 // metres per uikit pixel

type Props = {
  color?: string
  /** Outer diameter in metres. */
  size?: number
  /** 1 = normal speed. */
  speed?: number
  /** Caption under the spinner; empty hides it. */
  label?: string
}

/** 3D loading spinner: two arcs tumbling in a gyroscope around a breathing core, with an orbiting spark. */
export default function Spinner3D({ color = "#9FE7D2", size = 0.1, speed = 1, label = "Loading" }: Props) {
  const R = size / 2
  const gimbal = useRef<Group>(null)
  const outer = useRef<Mesh>(null)
  const inner = useRef<Group>(null)
  const core = useRef<Mesh>(null)
  const spark = useRef<Mesh>(null)
  const t = useRef(0)
  const [dots, setDots] = useState(0)

  useFrame((state, dt) => {
    t.current += Math.min(dt, 0.1) * speed
    const time = t.current
    if (gimbal.current) gimbal.current.rotation.set(Math.sin(time * 0.7) * 0.45, time * 0.6, 0)
    if (outer.current) outer.current.rotation.z = -time * 3.2
    if (inner.current) inner.current.rotation.set(time * 1.9, 0, time * 2.4)
    if (core.current) core.current.scale.setScalar(0.9 + Math.sin(time * 4) * 0.12)
    if (spark.current) spark.current.position.set(Math.cos(time * 2.6) * R * 1.12, Math.sin(time * 2.6) * R * 0.35, Math.sin(time * 2.6) * R * 1.12)
    const nd = Math.floor(time * 3) % 4
    if (label && nd !== dots) setDots(nd)
    state.invalidate()
  })

  return (
    <group>
      <group ref={gimbal}>
        <mesh ref={outer}>
          <torusGeometry args={[R * 0.92, R * 0.08, 12, 72, Math.PI * 1.5]} />
          <meshMatcapMaterial color={color} toneMapped={false} />
        </mesh>
        <group ref={inner}>
          <mesh>
            <torusGeometry args={[R * 0.64, R * 0.065, 12, 64, Math.PI * 1.15]} />
            <meshMatcapMaterial color="#EEF0F4" toneMapped={false} />
          </mesh>
        </group>
        <mesh ref={core}>
          <sphereGeometry args={[R * 0.24, 24, 16]} />
          <meshMatcapMaterial color={color} toneMapped={false} />
        </mesh>
      </group>
      <mesh ref={spark}>
        <sphereGeometry args={[R * 0.07, 12, 8]} />
        <meshBasicMaterial color="#F2B48A" toneMapped={false} />
      </mesh>
      {label ? (
        <group position={[0, -R - 0.03, 0]}>
          <Container pixelSize={PX} flexDirection="row" pointerEvents="none">
            <Text fontSize={13} color="#9AA0AD">
              {label}
            </Text>
            {/* Fixed-width dots, so the caption doesn't shuffle sideways as they cycle. */}
            <Container width={14}>
              <Text fontSize={13} color="#9AA0AD">
                {".".repeat(dots)}
              </Text>
            </Container>
          </Container>
        </group>
      ) : null}
    </group>
  )
}
