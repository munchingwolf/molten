"use client"

import { useRef, useState } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { Outlines } from "@react-three/drei"

type Props = {
  color?: string
  outlineColor?: string
  /** Outline thickness in metres */
  thickness?: number
  /** Width in metres */
  size?: number
}

/** A toon-style capsule with an inked outline (drei <Outlines>). Hover thickens and recolours the outline, tap toggles it off and on. */
export default function OutlinedObject({ color = "#15171E", outlineColor = "#9FE7D2", thickness = 0.004, size = 0.16 }: Props) {
  const mesh = useRef<THREE.Mesh>(null)
  const [hover, setHover] = useState(false)
  const [on, setOn] = useState(true)

  useFrame((state) => {
    const m = mesh.current
    if (!m) return
    const t = state.clock.elapsedTime
    m.rotation.set(Math.sin(t * 0.5) * 0.4, t * 0.4, Math.PI / 5)
  })

  return (
    <mesh
      ref={mesh}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
      onClick={() => setOn((o) => !o)}
    >
      <capsuleGeometry args={[size * 0.22, size * 0.5, 8, 24]} />
      <meshToonMaterial color={color} />
      {on && <Outlines thickness={hover ? thickness * 1.8 : thickness} color={hover ? "#7FE3FF" : outlineColor} />}
    </mesh>
  )
}
