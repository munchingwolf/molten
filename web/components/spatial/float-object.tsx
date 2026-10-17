"use client"

import { useRef, useState } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { Float } from "@react-three/drei"

type Props = {
  color?: string
  /** Bob speed */
  speed?: number
  /** How far it bobs and tilts (0–2) */
  intensity?: number
  /** Gem diameter in metres */
  size?: number
}

/** A faceted gem bobbing in place with drei <Float>. Hover lights it up, tap gives it a spin. */
export default function FloatObject({ color = "#9FE7D2", speed = 1.5, intensity = 1, size = 0.12 }: Props) {
  const mesh = useRef<THREE.Mesh>(null)
  const spin = useRef(0)
  const [hover, setHover] = useState(false)

  useFrame((_, dt) => {
    const m = mesh.current
    if (!m) return
    spin.current *= Math.exp(-dt * 2)
    m.rotation.y += dt * (0.4 + spin.current)
    m.scale.setScalar(THREE.MathUtils.damp(m.scale.x, hover ? 1.12 : 1, 10, dt))
  })

  return (
    <Float speed={speed} floatIntensity={intensity} rotationIntensity={intensity * 0.6} floatingRange={[-0.015, 0.015]}>
      <mesh
        ref={mesh}
        onClick={() => (spin.current = 12)}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <icosahedronGeometry args={[size / 2, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hover ? 0.5 : 0.12}
          flatShading
          roughness={0.3}
          metalness={0.2}
        />
      </mesh>
    </Float>
  )
}
