"use client"

import { useRef, useState } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { Wireframe } from "@react-three/drei"

type Props = {
  /** Wire colour */
  stroke?: string
  /** Face fill colour */
  fill?: string
  /** Wire thickness (0–0.1) */
  thickness?: number
  /** Width in metres */
  size?: number
}

/** A geodesic sphere drawn with drei's shader <Wireframe> (thick, smooth wires, no line geometry). Hover fills the faces, tap toggles dashed wires. */
export default function WireframeObject({ stroke = "#9FE7D2", fill = "#15171E", thickness = 0.04, size = 0.18 }: Props) {
  const mesh = useRef<THREE.Mesh>(null)
  const [hover, setHover] = useState(false)
  const [dashed, setDashed] = useState(false)

  useFrame((_, dt) => {
    if (mesh.current) mesh.current.rotation.y += dt * 0.3
  })

  return (
    <mesh
      ref={mesh}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
      onClick={() => setDashed((d) => !d)}
    >
      <icosahedronGeometry args={[size / 2, 1]} />
      {/* <Wireframe> rewrites this material's shader; transparent + double-sided so fill opacity and back wires show */}
      <meshBasicMaterial transparent side={THREE.DoubleSide} depthWrite={false} />
      <Wireframe
        stroke={stroke}
        fill={fill}
        fillOpacity={hover ? 0.6 : 0.15}
        fillMix={1}
        strokeOpacity={1}
        thickness={hover ? thickness * 1.5 : thickness}
        colorBackfaces
        backfaceStroke="#7FE3FF"
        dash={dashed}
        dashRepeats={3}
        dashLength={0.5}
        squeeze
        squeezeMin={0.3}
        squeezeMax={1}
      />
    </mesh>
  )
}
