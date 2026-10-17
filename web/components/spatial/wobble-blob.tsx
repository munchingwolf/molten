"use client"

import { useRef, useState, type ComponentRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { MeshWobbleMaterial } from "@react-three/drei"

type Props = {
  color?: string
  /** Wobble speed */
  speed?: number
  /** Wobble strength (0–2) */
  factor?: number
  /** Width in metres */
  size?: number
}

type WobbleMat = ComponentRef<typeof MeshWobbleMaterial>

/** A jelly torus knot (drei <MeshWobbleMaterial>). Hover makes it wobble harder, tap gives it a jolt. */
export default function WobbleBlob({ color = "#9FE7D2", speed = 1.5, factor = 0.4, size = 0.18 }: Props) {
  const mat = useRef<WobbleMat>(null)
  const kick = useRef(0)
  const [hover, setHover] = useState(false)

  useFrame((_, dt) => {
    const m = mat.current
    if (!m) return
    kick.current *= Math.exp(-dt * 3)
    m.factor = THREE.MathUtils.damp(m.factor, factor * (hover ? 2 : 1) + kick.current, 6, dt)
  })

  return (
    <mesh
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
      onClick={() => (kick.current = 1.5)}
    >
      <torusKnotGeometry args={[size * 0.3, size * 0.1, 128, 16]} />
      <MeshWobbleMaterial ref={mat} color={color} speed={speed} factor={factor} roughness={0.25} metalness={0.1} />
    </mesh>
  )
}
