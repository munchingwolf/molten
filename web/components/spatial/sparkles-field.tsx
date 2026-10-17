"use client"

import { useLayoutEffect, useRef, useState } from "react"
import * as THREE from "three"
import { Sparkles } from "@react-three/drei"

type Props = {
  color?: string
  /** Number of sparkles */
  count?: number
  /** Drift speed */
  speed?: number
  /** Field width in metres */
  size?: number
}

/** A box of drifting, twinkling motes (drei <Sparkles>). Hover makes them swell and speed up. */
export default function SparklesField({ color = "#7FE3FF", count = 40, speed = 0.4, size = 0.3 }: Props) {
  const points = useRef<THREE.Points>(null)
  const [hover, setHover] = useState(false)

  // drei's shader wobbles each mote by a fixed 0.2 m; shrink it so the field stays inside its box.
  useLayoutEffect(() => {
    const m = points.current?.material as THREE.ShaderMaterial | undefined
    if (!m || m.vertexShader.includes("* 0.02;")) return
    m.vertexShader = m.vertexShader.replace(/\* 0\.2;/g, "* 0.02;")
    m.needsUpdate = true
  }, [])

  return (
    <group onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
      <Sparkles
        ref={points}
        raycast={() => null}
        count={count}
        speed={hover ? speed * 3 : speed}
        size={hover ? 2.2 : 1.4}
        color={color}
        scale={size}
        noise={0.5}
        opacity={0.9}
      />
      {/* invisible hit box so hover works */}
      <mesh>
        <boxGeometry args={[size, size, size]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}
