"use client"

import { useRef, useState } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { Trail } from "@react-three/drei"

type Props = {
  color?: string
  /** Loop speed */
  speed?: number
  /** Ribbon width */
  width?: number
  /** Trail length */
  length?: number
}

const R = 0.12

/** A glowing comet tracing a figure-eight, leaving a fading ribbon (drei <Trail>). Hover speeds it up, tap flips direction. */
export default function MotionTrail({ color = "#7FE3FF", speed = 1, width = 0.15, length = 5 }: Props) {
  const head = useRef<THREE.Mesh>(null)
  const t = useRef(0)
  const dir = useRef(1)
  const [hover, setHover] = useState(false)

  useFrame((_, dt) => {
    t.current += dt * speed * dir.current * (hover ? 2.2 : 1)
    const a = t.current * 2
    head.current?.position.set(Math.sin(a) * R, Math.sin(a * 2) * R * 0.45, Math.cos(a) * R * 0.3)
  })

  return (
    <group onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)} onClick={() => (dir.current *= -1)}>
      <Trail width={width} length={length} color={color} attenuation={(w) => w * w}>
        <mesh ref={head}>
          <sphereGeometry args={[0.012, 16, 12]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      </Trail>
      {/* invisible hit area covering the loop */}
      <mesh>
        <boxGeometry args={[R * 2.3, R, R * 0.8]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}
