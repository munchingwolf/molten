"use client"

import { Grid, Text } from "@react-three/drei"

// Floor guides never take pointer rays, so hands and rays reach the components.
const noRay = () => {}
const FLAT = [-Math.PI / 2, 0, 0] as const
const METRES = [1, 2, 3, 4]

/**
 * Measuring floor for placing things: 10 cm cells, a line every metre, metre labels out from where you start,
 * and a "you" mark at the origin (where an XR session puts your feet). Reads on light and dark backdrops.
 */
export function MeasureGrid({ xray = false }: { xray?: boolean }) {
  const label = { fontSize: 0.11, color: "#EEF0F4", outlineWidth: 0.006, outlineColor: "#0B0C10", rotation: FLAT, raycast: noRay }
  return (
    <group>
      <Grid
        position-y={0.002}
        infiniteGrid
        cellSize={0.1}
        cellThickness={0.6}
        cellColor={xray ? "#3b4252" : "#7a8090"}
        sectionSize={1}
        sectionThickness={1.3}
        sectionColor={xray ? "#5b6b8a" : "#4fbfa0"}
        fadeDistance={14}
        fadeStrength={1.5}
        raycast={noRay}
      />
      {/* "You" mark: a ring the size of a standing spot. */}
      <mesh rotation={FLAT} position-y={0.004} raycast={noRay}>
        <ringGeometry args={[0.24, 0.28, 48]} />
        <meshBasicMaterial color="#4fbfa0" transparent opacity={0.9} />
      </mesh>
      <Text {...label} position={[0, 0.005, 0.38]}>you</Text>
      {/* Metre labels ahead of you (−z) and to each side (±x). */}
      {METRES.map((m) => (
        <group key={m}>
          <Text {...label} position={[0.08, 0.005, -m]} anchorX="left">{`${m} m`}</Text>
          <Text {...label} position={[m, 0.005, 0.08]} anchorY="top">{`${m} m`}</Text>
          <Text {...label} position={[-m, 0.005, 0.08]} anchorY="top">{`${m} m`}</Text>
        </group>
      ))}
    </group>
  )
}
