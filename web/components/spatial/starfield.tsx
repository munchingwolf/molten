"use client"

import { useLayoutEffect, useRef, useState } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { Stars } from "@react-three/drei"

type Props = {
  /** Globe diameter in metres */
  size?: number
  /** Rotation speed */
  speed?: number
  /** Number of stars */
  count?: number
  /** Star colour saturation (0 = white) */
  saturation?: number
}

/** A pocket universe: drei <Stars> squeezed into a dark glass globe that slowly turns. Hover spins it faster. */
export default function Starfield({ size = 0.3, speed = 0.15, count = 1500, saturation = 0.4 }: Props) {
  const spin = useRef<THREE.Group>(null)
  const stars = useRef<THREE.Points>(null)
  const [hover, setHover] = useState(false)
  // Stars sit 100–150 units out and its shader halves positions, so the cloud spans ~75 units.
  const k = size / 2 / 75

  useLayoutEffect(() => {
    if (stars.current) stars.current.raycast = () => null // a Points raycast would catch clicks far outside the globe
  }, [])
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * speed * (hover ? 4 : 1)
  })

  return (
    <group onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
      <group ref={spin} scale={k}>
        <Stars ref={stars} radius={100} depth={50} count={count} factor={0.1} saturation={saturation} fade speed={1} />
      </group>
      <mesh>
        <sphereGeometry args={[size / 2, 48, 24]} />
        <meshBasicMaterial color="#15171E" side={THREE.BackSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[size / 2, 48, 24]} />
        <meshStandardMaterial color="#7FE3FF" transparent opacity={hover ? 0.14 : 0.07} roughness={0.1} depthWrite={false} />
      </mesh>
    </group>
  )
}
