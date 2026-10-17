"use client"

import { useRef, useState } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { MeshReflectorMaterial } from "@react-three/drei"

type Props = {
  /** Disc diameter in metres */
  size?: number
  /** Floor colour */
  color?: string
  /** Reflection strength (0–1) */
  mirror?: number
  /** Blur of the reflection */
  blur?: number
}

/** A glossy reflective plinth (drei <MeshReflectorMaterial>) with a small cube hovering over it so there's something to reflect. Tap the cube to make it hop. */
export default function MirrorFloor({ size = 0.4, color = "#15171E", mirror = 0.75, blur = 200 }: Props) {
  const cube = useRef<THREE.Mesh>(null)
  const hop = useRef(0)
  const [hover, setHover] = useState(false)

  useFrame((state, dt) => {
    const c = cube.current
    if (!c) return
    hop.current = Math.max(0, hop.current - dt * 1.8)
    c.position.y = size * 0.18 + Math.sin(state.clock.elapsedTime * 1.2) * 0.008 + Math.sin(hop.current * Math.PI) * size * 0.15
    c.rotation.y += dt * 0.6
    c.rotation.x += dt * 0.3
  })

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[size / 2, 64]} />
        {/* small render target + modest blur kernel: one extra pass per frame */}
        <MeshReflectorMaterial
          color={color}
          resolution={256}
          blur={[blur, blur / 2]}
          mixBlur={1}
          mixStrength={1.5 * mirror}
          mirror={mirror}
          roughness={0.6}
          metalness={0.4}
          depthScale={0}
        />
      </mesh>
      <mesh
        ref={cube}
        position={[0, size * 0.18, 0]}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
        onClick={() => (hop.current = 1)}
      >
        <boxGeometry args={[size * 0.15, size * 0.15, size * 0.15]} />
        <meshStandardMaterial color="#9FE7D2" emissive="#9FE7D2" emissiveIntensity={hover ? 0.9 : 0.4} roughness={0.3} />
      </mesh>
    </group>
  )
}
