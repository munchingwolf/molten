"use client"

import { RoundedBox } from "@react-three/drei"

// Real-world 3-seat sofa (metres). Built from the floor up, then shifted so the bounding box is centred. Front faces +Z.
const W = 2.0
const D = 0.92
const LEG = 0.1
const ARM_W = 0.17
const SEAT_Y = 0.32 // top of the seat deck
const CUSH_H = 0.14
const TOTAL_H = 0.88
const INNER = W - 2 * ARM_W
const SEATS = 3

/** Three-seat fabric sofa with loose seat and back cushions on tapered wooden legs. Decor (a good spot to sit in VR). */
export default function Sofa({ color = "#4E5D6C", legColor = "#5A3A22" }: { color?: string; legColor?: string }) {
  const fabric = <meshPhysicalMaterial color={color} roughness={1} sheen={1} sheenRoughness={0.7} sheenColor="#ffffff" />
  const cushW = INNER / SEATS - 0.008
  return (
    <group position={[0, -TOTAL_H / 2, 0]}>
      {/* legs */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (W / 2 - 0.07), LEG / 2, sz * (D / 2 - 0.07)]}>
            <cylinderGeometry args={[0.02, 0.013, LEG, 16]} />
            <meshPhysicalMaterial color={legColor} roughness={0.45} clearcoat={0.4} />
          </mesh>
        )),
      )}
      {/* seat deck */}
      <RoundedBox args={[INNER + 0.02, SEAT_Y - LEG, D - 0.02]} radius={0.03} smoothness={3} position={[0, (LEG + SEAT_Y) / 2, 0.01]}>
        {fabric}
      </RoundedBox>
      {/* arms */}
      {[-1, 1].map((s) => (
        <RoundedBox key={s} args={[ARM_W, 0.6 - LEG, D]} radius={0.05} smoothness={4} position={[s * (W / 2 - ARM_W / 2), (LEG + 0.6) / 2, 0]}>
          {fabric}
        </RoundedBox>
      ))}
      {/* back frame */}
      <RoundedBox args={[INNER + 0.02, 0.76 - LEG, 0.2]} radius={0.05} smoothness={4} position={[0, (LEG + 0.76) / 2, -D / 2 + 0.1]}>
        {fabric}
      </RoundedBox>
      {Array.from({ length: SEATS }, (_, i) => {
        const x = -INNER / 2 + (i + 0.5) * (INNER / SEATS)
        return (
          <group key={i}>
            {/* seat cushion */}
            <RoundedBox args={[cushW, CUSH_H, D - 0.22]} radius={0.05} smoothness={4} position={[x, SEAT_Y + CUSH_H / 2, 0.1]}>
              {fabric}
            </RoundedBox>
            {/* back cushion, leaning back */}
            <RoundedBox
              args={[cushW, 0.44, 0.16]}
              radius={0.06}
              smoothness={4}
              position={[x, SEAT_Y + CUSH_H + 0.2, -D / 2 + 0.27]}
              rotation={[-0.16, 0, 0]}
            >
              {fabric}
            </RoundedBox>
          </group>
        )
      })}
    </group>
  )
}
