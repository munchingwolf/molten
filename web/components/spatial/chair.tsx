"use client"

import { useEffect, useMemo } from "react"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

type Props = { color?: string }

const Y0 = -0.445 // floor; chair is ~89 cm tall, centred on the origin
const SEAT_Y = Y0 + 0.46
const LEAN = -0.16 // backrest tilts back

/** Mid-century dining chair: upholstered seat and back on splayed oak legs, 46 cm seat height. Decorative. `color` sets the fabric. */
export default function Chair({ color = "#C9805C" }: Props) {
  const seat = useMemo(() => new RoundedBoxGeometry(0.46, 0.05, 0.44, 3, 0.018), [])
  const back = useMemo(() => new RoundedBoxGeometry(0.44, 0.22, 0.035, 3, 0.014), [])
  useEffect(() => () => (seat.dispose(), back.dispose()), [seat, back])
  const legH = SEAT_Y - 0.025 - Y0

  return (
    <group>
      <mesh geometry={seat} position={[0, SEAT_Y, 0]}>
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {/* Splayed, tapered legs */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}${sz}`}
            position={[sx * 0.19, Y0 + legH / 2, sz * 0.17]}
            rotation={[-sz * 0.07, 0, sx * 0.07]}
          >
            <cylinderGeometry args={[0.016, 0.011, legH, 12]} />
            <meshStandardMaterial color="#B98E62" roughness={0.6} />
          </mesh>
        )),
      )}
      {/* Back posts + backrest */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * 0.2, SEAT_Y + 0.22, -0.216]} rotation={[LEAN, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.014, 0.42, 10]} />
          <meshStandardMaterial color="#B98E62" roughness={0.6} />
        </mesh>
      ))}
      <mesh geometry={back} position={[0, SEAT_Y + 0.31, -0.24]} rotation={[LEAN, 0, 0]}>
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
    </group>
  )
}
