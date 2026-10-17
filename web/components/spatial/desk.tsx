"use client"

import { useEffect, useMemo } from "react"
import * as THREE from "three"

type Props = { color?: string }

// 125 x 58 cm, top surface 92 cm above the floor. Origin is the body's centre, so the floor is at y = -H / 2.
const W = 1.25
const D = 0.58
const H = 0.92
const TOP = 0.04
const SIDE_H = H - TOP

/** Performance desk: a flat top on two solid side panels, with a low riser at the back for a tilted console. `color` sets every part. */
export default function Desk({ color = "#1b1e26" }: Props) {
  const riser = useMemo(() => {
    const g = new THREE.BoxGeometry(0.5, 0.08, 0.1)
    // Bounds flattened to the riser's base so surface snapping (Box3 of the desk) still seats items on the 92 cm top.
    g.boundingBox = new THREE.Box3(new THREE.Vector3(-0.25, -0.04, -0.05), new THREE.Vector3(0.25, -0.04, 0.05))
    return g
  }, [])
  useEffect(() => () => riser.dispose(), [riser])

  return (
    <group>
      <mesh position={[0, H / 2 - TOP / 2, 0]}>
        <boxGeometry args={[W, TOP, D]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.15} />
      </mesh>
      {[-0.58, 0.58].map((x) => (
        <mesh key={x} position={[x, -H / 2 + SIDE_H / 2, 0]}>
          <boxGeometry args={[0.04, SIDE_H, 0.52]} />
          <meshStandardMaterial color={color} roughness={0.7} metalness={0.15} />
        </mesh>
      ))}
      <mesh geometry={riser} position={[0, H / 2 + 0.04, 0.01]}>
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.15} />
      </mesh>
    </group>
  )
}
