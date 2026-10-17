"use client"

import { useRef, useState } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { RoundedBox } from "@react-three/drei"

type Props = {
  color?: string
  /** Edge length in metres */
  size?: number
  /** Corner radius as a fraction of the size (0–0.5) */
  roundness?: number
  /** Idle turn speed */
  speed?: number
}

/** A soft-cornered cube (drei <RoundedBox>) that turns slowly, glows on hover and squashes when pressed. */
export default function RoundedBoxObject({ color = "#9FE7D2", size = 0.12, roundness = 0.2, speed = 0.4 }: Props) {
  const mesh = useRef<THREE.Mesh>(null)
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)

  useFrame((_, dt) => {
    const m = mesh.current
    if (!m) return
    m.rotation.y += dt * speed
    m.rotation.x = THREE.MathUtils.damp(m.rotation.x, hover ? 0.35 : 0.15, 6, dt)
    const sy = down ? 0.82 : hover ? 1.06 : 1
    const sxz = down ? 1.08 : hover ? 1.06 : 1
    m.scale.set(
      THREE.MathUtils.damp(m.scale.x, sxz, 14, dt),
      THREE.MathUtils.damp(m.scale.y, sy, 14, dt),
      THREE.MathUtils.damp(m.scale.z, sxz, 14, dt),
    )
  })

  const up = () => setDown(false)
  return (
    <RoundedBox
      ref={mesh}
      args={[size, size, size]}
      radius={size * Math.min(0.5, Math.max(0, roundness))}
      smoothness={4}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => {
        setHover(false)
        setDown(false)
      }}
      onPointerDown={() => setDown(true)}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hover ? 0.35 : 0.08} roughness={0.35} metalness={0.1} />
    </RoundedBox>
  )
}
