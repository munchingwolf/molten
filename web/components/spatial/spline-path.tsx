"use client"

import { useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { CatmullRomLine } from "@react-three/drei"

type Props = {
  color?: string
  /** Second colour the path fades into */
  color2?: string
  /** Bead speed */
  speed?: number
  /** Line width in pixels */
  lineWidth?: number
}

const SEGMENTS = 120

/** A smooth closed path through six points (drei <CatmullRomLine>) with a bead gliding along it. Hover thickens it, tap reverses the bead. */
export default function SplinePath({ color = "#9FE7D2", color2 = "#7FE3FF", speed = 0.15, lineWidth = 3 }: Props) {
  const points = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2
        const r = i % 2 ? 0.09 : 0.14
        return new THREE.Vector3(Math.cos(a) * r, Math.sin(a * 2) * 0.04, Math.sin(a) * r)
      }),
    [],
  )
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.5), [points])
  const colors = useMemo(() => {
    const a = new THREE.Color(color)
    const b = new THREE.Color(color2)
    return Array.from({ length: SEGMENTS + 1 }, (_, i) => a.clone().lerp(b, 0.5 - 0.5 * Math.cos((i / SEGMENTS) * Math.PI * 2)))
  }, [color, color2])
  const bead = useRef<THREE.Mesh>(null)
  const t = useRef(0)
  const dir = useRef(1)
  const [hover, setHover] = useState(false)

  useFrame((_, dt) => {
    t.current = (((t.current + dt * speed * dir.current) % 1) + 1) % 1
    if (bead.current) curve.getPointAt(t.current, bead.current.position)
  })

  return (
    <group
      rotation={[0.35, 0, 0]}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
      onClick={() => (dir.current *= -1)}
    >
      <CatmullRomLine
        points={points}
        closed
        curveType="catmullrom"
        tension={0.5}
        segments={SEGMENTS}
        color="white"
        vertexColors={colors}
        lineWidth={hover ? lineWidth * 1.8 : lineWidth}
      />
      <mesh ref={bead}>
        <sphereGeometry args={[0.012, 16, 12]} />
        <meshStandardMaterial color="#EEF0F4" emissive={color} emissiveIntensity={0.6} />
      </mesh>
    </group>
  )
}
