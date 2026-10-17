"use client"

import { useRef, useState } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { MarchingCube, MarchingCubes } from "@react-three/drei"

type Props = {
  color?: string
  /** Second colour the blobs blend into */
  color2?: string
  /** Orbit speed */
  speed?: number
  /** Width in metres */
  size?: number
}

const BALLS = 5

/** Lava-lamp blobs that merge and split (drei <MarchingCubes>). Hover speeds them up, tap pulls them together. */
export default function Metaballs({ color = "#9FE7D2", color2 = "#7FE3FF", speed = 0.6, size = 0.22 }: Props) {
  const balls = useRef<(THREE.Group | null)[]>([])
  const t = useRef(0)
  const [hover, setHover] = useState(false)
  const [huddle, setHuddle] = useState(false)
  const spread = useRef(1)

  useFrame((_, dt) => {
    t.current += dt * speed * (hover ? 2 : 1)
    spread.current = THREE.MathUtils.damp(spread.current, huddle ? 0.35 : 1, 3, dt)
    balls.current.forEach((b, i) => {
      if (!b) return
      const a = t.current * (0.6 + i * 0.17) + i * 1.9
      const r = 0.45 * spread.current
      b.position.set(Math.sin(a) * r, Math.cos(a * 1.3 + i) * r, Math.sin(a * 0.7 + i * 2) * r * 0.6)
    })
  })

  return (
    <group onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)} onClick={() => setHuddle((h) => !h)}>
      {/* resolution 28 keeps the per-frame polygonise cheap enough for Quest */}
      <MarchingCubes resolution={28} maxPolyCount={8000} enableUvs={false} enableColors scale={size / 2}>
        <meshStandardMaterial vertexColors roughness={0.2} metalness={0.1} />
        {Array.from({ length: BALLS }, (_, i) => (
          <MarchingCube
            key={i}
            ref={(el) => {
              balls.current[i] = el
            }}
            strength={0.45}
            subtract={10}
            color={new THREE.Color(color).lerp(new THREE.Color(color2), i / (BALLS - 1))}
          />
        ))}
      </MarchingCubes>
    </group>
  )
}
