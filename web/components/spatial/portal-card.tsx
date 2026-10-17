"use client"

import { useRef, useState } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { MeshPortalMaterial } from "@react-three/drei"

type Props = {
  /** Colour of the world inside */
  color?: string
  /** Colour of the shape inside */
  innerColor?: string
  /** Card width in metres (3:4) */
  width?: number
  /** Animation speed inside the portal */
  speed?: number
}

/** A card that is a window into another little world (drei <MeshPortalMaterial>): a deep room with a spinning shape. Tilt it by hovering, tap to light the inside. */
export default function PortalCard({ color = "#15171E", innerColor = "#9FE7D2", width = 0.24, speed = 1 }: Props) {
  const card = useRef<THREE.Group>(null)
  const knot = useRef<THREE.Mesh>(null)
  const [hover, setHover] = useState(false)
  const [lit, setLit] = useState(false)
  const h = width * (4 / 3)

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime * speed
    if (knot.current) {
      knot.current.rotation.set(t * 0.4, t * 0.6, 0)
      knot.current.position.y = Math.sin(t) * h * 0.05
    }
    if (card.current) card.current.rotation.y = THREE.MathUtils.damp(card.current.rotation.y, hover ? 0.25 : 0, 6, dt)
  })

  return (
    <group
      ref={card}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
      onClick={() => setLit((l) => !l)}
    >
      <mesh>
        <planeGeometry args={[width, h]} />
        {/* the inside renders into its own buffer; 512 px is plenty for a 24 cm card */}
        <MeshPortalMaterial resolution={512} blur={0}>
          <ambientLight intensity={lit ? 1.2 : 0.4} />
          <pointLight position={[0, h * 0.4, -width * 0.2]} intensity={lit ? 3 : 1} distance={width * 4} decay={1} color={innerColor} />
          {/* the room: an inside-out box deeper than the card */}
          <mesh position={[0, 0, -width * 0.6]}>
            <boxGeometry args={[width * 1.2, h * 1.2, width * 1.2]} />
            <meshStandardMaterial color={color} side={THREE.BackSide} roughness={0.9} />
          </mesh>
          <mesh ref={knot} position={[0, 0, -width * 0.6]}>
            <torusKnotGeometry args={[width * 0.16, width * 0.05, 96, 12]} />
            <meshStandardMaterial color={innerColor} emissive={innerColor} emissiveIntensity={lit ? 0.8 : 0.25} roughness={0.3} />
          </mesh>
        </MeshPortalMaterial>
      </mesh>
      {/* frame */}
      <mesh position={[0, 0, -0.002]}>
        <planeGeometry args={[width + 0.012, h + 0.012]} />
        <meshStandardMaterial color={hover ? "#7FE3FF" : "#9FE7D2"} emissive={hover ? "#7FE3FF" : "#9FE7D2"} emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}
