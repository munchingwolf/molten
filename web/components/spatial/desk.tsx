"use client"

import { useEffect, useMemo } from "react"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

type Props = { color?: string }

const W = 1.2
const D = 0.6
const TOP = 0.028
const LEG = 0.035
const H = 0.75

/** Modern work desk, 120 × 60 cm and 75 cm tall: a solid top on a slim steel frame. Decorative. `color` sets the top. */
export default function Desk({ color = "#CBB08F" }: Props) {
  const top = useMemo(() => new RoundedBoxGeometry(W, TOP, D, 3, 0.008), [])
  useEffect(() => () => top.dispose(), [top])
  const legH = H - TOP
  const legY = -H / 2 + legH / 2
  const railY = H / 2 - TOP - 0.02
  const lx = W / 2 - 0.06
  const lz = D / 2 - 0.05

  return (
    <group>
      <mesh geometry={top} position={[0, H / 2 - TOP / 2, 0]}>
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * lx, legY, sz * lz]}>
            <boxGeometry args={[LEG, legH, LEG]} />
            <meshStandardMaterial color="#1B1E26" metalness={0.55} roughness={0.35} />
          </mesh>
        )),
      )}
      {/* Apron rails under the top */}
      {[-1, 1].map((sz) => (
        <mesh key={`f${sz}`} position={[0, railY, sz * lz]}>
          <boxGeometry args={[2 * lx, 0.04, 0.02]} />
          <meshStandardMaterial color="#1B1E26" metalness={0.55} roughness={0.35} />
        </mesh>
      ))}
      {[-1, 1].map((sx) => (
        <mesh key={`s${sx}`} position={[sx * lx, railY, 0]}>
          <boxGeometry args={[0.02, 0.04, 2 * lz]} />
          <meshStandardMaterial color="#1B1E26" metalness={0.55} roughness={0.35} />
        </mesh>
      ))}
      {/* Low side stretchers */}
      {[-1, 1].map((sx) => (
        <mesh key={`l${sx}`} position={[sx * lx, -H / 2 + 0.12, 0]}>
          <boxGeometry args={[0.02, 0.02, 2 * lz]} />
          <meshStandardMaterial color="#1B1E26" metalness={0.55} roughness={0.35} />
        </mesh>
      ))}
    </group>
  )
}
