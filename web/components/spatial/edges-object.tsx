"use client"

import { useRef, useState } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { Edges } from "@react-three/drei"

type Props = {
  /** Edge colour */
  color?: string
  /** Width in metres */
  size?: number
  /** Turn speed */
  speed?: number
  /** Show the dark body behind the edges */
  solid?: boolean
}

/** A dodecahedron drawn as glowing hard edges (drei <Edges>) over a dark body. Hover brightens it, tap pulses it. */
export default function EdgesObject({ color = "#7FE3FF", size = 0.16, speed = 0.4, solid = true }: Props) {
  const mesh = useRef<THREE.Mesh>(null)
  const pulse = useRef(0)
  const [hover, setHover] = useState(false)

  useFrame((_, dt) => {
    const m = mesh.current
    if (!m) return
    pulse.current = Math.max(0, pulse.current - dt * 2)
    m.rotation.y += dt * speed
    m.rotation.x += dt * speed * 0.4
    m.scale.setScalar(1 + Math.sin(pulse.current * Math.PI) * 0.15)
  })

  return (
    <mesh
      ref={mesh}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
      onClick={() => (pulse.current = 1)}
    >
      <dodecahedronGeometry args={[size / 2, 0]} />
      <meshStandardMaterial color="#15171E" roughness={0.7} transparent opacity={solid ? 0.9 : 0} depthWrite={solid} />
      <Edges threshold={15} color={hover ? "#EEF0F4" : color} lineWidth={hover ? 2.5 : 1.5} />
    </mesh>
  )
}
