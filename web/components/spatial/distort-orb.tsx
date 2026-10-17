"use client"

import { useRef, useState, type ComponentRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { MeshDistortMaterial } from "@react-three/drei"

type Props = {
  color?: string
  /** Surface distortion (0–1) */
  distort?: number
  /** Ripple speed */
  speed?: number
  /** Diameter in metres */
  size?: number
}

type DistortMat = ComponentRef<typeof MeshDistortMaterial>

/** A liquid, rippling orb (drei <MeshDistortMaterial>). Hover churns the surface, tap makes it splash. */
export default function DistortOrb({ color = "#7FE3FF", distort = 0.35, speed = 2, size = 0.18 }: Props) {
  const mat = useRef<DistortMat>(null)
  const splash = useRef(0)
  const [hover, setHover] = useState(false)

  useFrame((_, dt) => {
    const m = mat.current
    if (!m) return
    splash.current *= Math.exp(-dt * 2.5)
    m.distort = THREE.MathUtils.damp(m.distort, Math.min(1, distort * (hover ? 1.6 : 1) + splash.current), 5, dt)
  })

  return (
    <mesh
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
      onClick={() => (splash.current = 0.6)}
    >
      <sphereGeometry args={[size / 2, 64, 48]} />
      <MeshDistortMaterial ref={mat} color={color} distort={distort} speed={speed} roughness={0.15} metalness={0.2} />
    </mesh>
  )
}
