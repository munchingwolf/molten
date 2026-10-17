"use client"

import { Grid } from "@react-three/drei"

type Props = {
  /** Fine line colour */
  cellColor?: string
  /** Major line colour */
  sectionColor?: string
  /** Fine cell size in metres */
  cellSize?: number
  /** Extend to the horizon (otherwise a 40 cm tile) */
  infinite?: boolean
}

/** A crisp shader grid (drei <Grid>): a 40 cm measuring tile by default, or a floor that fades into the distance. */
export default function InfiniteGrid({ cellColor = "#7FE3FF", sectionColor = "#9FE7D2", cellSize = 0.02, infinite = false }: Props) {
  return (
    <Grid
      args={[0.4, 0.4]}
      cellSize={cellSize}
      cellThickness={0.6}
      cellColor={cellColor}
      sectionSize={cellSize * 5}
      sectionThickness={1.2}
      sectionColor={sectionColor}
      infiniteGrid={infinite}
      fadeDistance={infinite ? 6 : 100}
      fadeStrength={1.5}
      side={2}
      // a decorative floor must not swallow clicks meant for things in front of it
      raycast={() => null}
    />
  )
}
