"use client"

import { useRef, useState } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { QuadraticBezierLine } from "@react-three/drei"
import type { QuadraticBezierLineRef } from "@react-three/drei"

type Props = {
  color?: string
  /** Line width in pixels */
  lineWidth?: number
  /** Sway and flow speed */
  speed?: number
  /** Distance between the two nodes in metres */
  span?: number
}

const START = new THREE.Vector3()
const END = new THREE.Vector3()
const MID = new THREE.Vector3()

/** A dashed energy arc between two nodes (drei <QuadraticBezierLine>). The arc sways and the dashes flow; hover thickens it, tap reverses the flow. */
export default function BezierCurve({ color = "#9FE7D2", lineWidth = 3, speed = 1, span = 0.3 }: Props) {
  const line = useRef<QuadraticBezierLineRef>(null)
  const flow = useRef(1)
  const [hover, setHover] = useState(false)

  useFrame((state, dt) => {
    const l = line.current
    if (!l) return
    const t = state.clock.elapsedTime * speed
    START.set(-span / 2, 0, 0)
    END.set(span / 2, 0, 0)
    MID.set(Math.sin(t * 0.7) * span * 0.2, span * 0.45 + Math.sin(t) * span * 0.08, Math.cos(t * 0.8) * span * 0.15)
    l.setPoints(START, END, MID)
    l.material.dashOffset -= dt * speed * 0.05 * flow.current
  })

  const node = (x: number) => (
    <mesh position={[x, 0, 0]}>
      <sphereGeometry args={[0.012, 20, 12]} />
      <meshStandardMaterial color="#15171E" emissive={color} emissiveIntensity={hover ? 0.8 : 0.35} roughness={0.4} />
    </mesh>
  )

  return (
    <group onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)} onClick={() => (flow.current *= -1)}>
      <QuadraticBezierLine
        ref={line}
        start={[-span / 2, 0, 0]}
        end={[span / 2, 0, 0]}
        mid={[0, span * 0.45, 0]}
        color={color}
        lineWidth={hover ? lineWidth * 1.8 : lineWidth}
        dashed
        dashSize={0.02}
        gapSize={0.01}
      />
      {node(-span / 2)}
      {node(span / 2)}
    </group>
  )
}
