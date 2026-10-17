"use client"

import { useRef, useState } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { Billboard, RoundedBox, Text } from "@react-three/drei"

type Props = {
  text?: string
  /** Accent colour (dot, stem, hover glow) */
  color?: string
  /** Letter height in metres */
  fontSize?: number
  /** Keep the tag upright (only turn around the vertical axis) */
  upright?: boolean
}

/** A name tag on a stem that always turns to face you (drei <Billboard>). Bobs gently; hover pops it forward. */
export default function BillboardTag({ text = "Point of interest", color = "#9FE7D2", fontSize = 0.025, upright = true }: Props) {
  const tag = useRef<THREE.Group>(null)
  const [hover, setHover] = useState(false)
  // shortcut: width estimated from character count, measure the troika text if long labels look off
  const w = text.length * fontSize * 0.55 + fontSize * 2.6
  const h = fontSize * 2

  useFrame((state, dt) => {
    const g = tag.current
    if (!g) return
    g.position.y = 0.1 + Math.sin(state.clock.elapsedTime * 1.5) * 0.004
    g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, hover ? 1.12 : 1, 10, dt))
  })

  return (
    <group>
      <mesh position={[0, 0.045, 0]}>
        <cylinderGeometry args={[0.0015, 0.0015, 0.09, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.006, 16, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <group ref={tag} position={[0, 0.1, 0]}>
        <Billboard lockX={upright} lockZ={upright}>
          <group onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
            <RoundedBox args={[w, h, 0.004]} radius={0.0019} smoothness={2}>
              <meshStandardMaterial color="#15171E" emissive={color} emissiveIntensity={hover ? 0.12 : 0} roughness={0.6} />
            </RoundedBox>
            <mesh position={[-w / 2 + fontSize * 0.9, 0, 0.0025]}>
              <circleGeometry args={[fontSize * 0.25, 20]} />
              <meshBasicMaterial color={color} />
            </mesh>
            <Text position={[fontSize * 0.35, 0, 0.0025]} fontSize={fontSize} color="#EEF0F4" anchorX="center" anchorY="middle">
              {text}
            </Text>
          </group>
        </Billboard>
      </group>
    </group>
  )
}
