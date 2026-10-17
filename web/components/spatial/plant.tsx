"use client"

import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { DoubleSide, Shape, ShapeGeometry, type Group } from "three"

type Props = { color?: string }

const POT_H = 0.2
const POT_Y = -0.15 // pot centre; plant is ~50 cm tall, centred on the origin
const SOIL_Y = POT_Y + POT_H / 2 - 0.014

/** One arching leaf: a pointed oval, folded along the midrib and curved outward. Unit length, scaled per leaf. */
function makeLeaf() {
  const s = new Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(0.22, 0.2, 0.2, 0.7, 0, 1)
  s.bezierCurveTo(-0.2, 0.7, -0.22, 0.2, 0, 0)
  const g = new ShapeGeometry(s, 10)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    pos.setZ(i, 0.45 * y * y - Math.abs(x) * 0.35)
  }
  g.computeVertexNormals()
  return g
}

const LEAVES = Array.from({ length: 11 }, (_, i) => ({
  yaw: i * 2.399, // golden angle: even spread with no visible pattern
  tilt: 0.18 + (i % 4) * 0.16,
  size: 0.22 + ((i * 7) % 5) * 0.025,
  phase: i * 1.7,
  dark: i % 3 === 0,
}))

/** Potted leafy plant, about 50 cm tall. Decorative; the leaves sway gently. `color` sets the pot. */
export default function Plant({ color = "#E8E1D5" }: Props) {
  const leaf = useMemo(makeLeaf, [])
  useEffect(() => () => leaf.dispose(), [leaf])
  const refs = useRef<(Group | null)[]>([])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    refs.current.forEach((g, i) => {
      if (!g) return
      const l = LEAVES[i]
      g.rotation.x = l.tilt + Math.sin(t * 1.1 + l.phase) * 0.035
      g.rotation.z = Math.sin(t * 0.8 + l.phase * 1.3) * 0.025
    })
  })

  return (
    <group>
      {/* Pot */}
      <mesh position={[0, POT_Y, 0]}>
        <cylinderGeometry args={[0.1, 0.08, POT_H, 40]} />
        <meshStandardMaterial color={color} roughness={0.75} />
      </mesh>
      <mesh position={[0, POT_Y + POT_H / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.096, 0.008, 8, 40]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <mesh position={[0, SOIL_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.093, 32]} />
        <meshStandardMaterial color="#2B211B" roughness={1} />
      </mesh>
      {/* Leaves: each pivots at the soil, yawed around the stem, tilted outward */}
      {LEAVES.map((l, i) => (
        <group key={i} position={[0, SOIL_Y, 0]} rotation={[0, l.yaw, 0]}>
          <group ref={(g) => void (refs.current[i] = g)} rotation={[l.tilt, 0, 0]}>
            <mesh geometry={leaf} scale={[l.size, l.size * 1.25, l.size]}>
              <meshStandardMaterial color={l.dark ? "#2F7148" : "#3E8F5A"} roughness={0.55} side={DoubleSide} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  )
}
