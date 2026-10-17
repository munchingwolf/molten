"use client"

import { useRef, useState } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { MeshTransmissionMaterial } from "@react-three/drei"

type Props = {
  /** Glass tint */
  color?: string
  /** Colour of the shape floating inside */
  innerColor?: string
  /** Diameter in metres */
  size?: number
  /** Rainbow fringing at the edges (0–1) */
  aberration?: number
}

/** A thick glass sphere (drei <MeshTransmissionMaterial>) bending a spinning shape inside it. Hover spins the core faster, tap swaps its shape. */
export default function GlassOrb({ color = "#EEF0F4", innerColor = "#9FE7D2", size = 0.2, aberration = 0.3 }: Props) {
  const core = useRef<THREE.Mesh>(null)
  const [hover, setHover] = useState(false)
  const [knot, setKnot] = useState(true)

  useFrame((_, dt) => {
    const c = core.current
    if (!c) return
    c.rotation.x += dt * (hover ? 1.6 : 0.4)
    c.rotation.y += dt * (hover ? 2 : 0.6)
  })

  const r = size / 2
  return (
    <group onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)} onClick={() => setKnot((k) => !k)}>
      <mesh ref={core}>
        {knot ? <torusKnotGeometry args={[r * 0.35, r * 0.1, 96, 12]} /> : <octahedronGeometry args={[r * 0.5, 0]} />}
        <meshStandardMaterial color={innerColor} emissive={innerColor} emissiveIntensity={0.4} roughness={0.3} flatShading={!knot} />
      </mesh>
      <mesh>
        <sphereGeometry args={[r, 48, 32]} />
        {/* modest samples/resolution: this renders an extra pass, keep it cheap on Quest */}
        <MeshTransmissionMaterial
          color={color}
          samples={4}
          resolution={256}
          thickness={r * 1.5}
          roughness={0.05}
          ior={1.4}
          chromaticAberration={aberration}
          anisotropy={0.1}
          distortion={0.25}
          distortionScale={0.4}
          temporalDistortion={0.1}
          backside={false}
        />
      </mesh>
    </group>
  )
}
