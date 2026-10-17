"use client"

import { Suspense, useRef, useState } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { Center, Text3D } from "@react-three/drei"

type Props = {
  text?: string
  color?: string
  /** Letter height in metres */
  size?: number
  /** Extrusion depth in metres */
  depth?: number
}

// No typeface JSON ships with this app, so Text3D gets a procedural 5×7 pixel font (A–Z, 0–9, a little punctuation).
// Each glyph: 7 rows, top to bottom, 2 hex digits per row, bit 16 = leftmost pixel.
const BITMAPS: Record<string, string> = {
  A: "0e11111f111111", B: "1e11111e11111e", C: "0e11101010110e", D: "1e11111111111e", E: "1f10101e10101f",
  F: "1f10101e101010", G: "0e11101711110f", H: "1111111f111111", I: "0e04040404040e", J: "0702020202120c",
  K: "11121418141211", L: "1010101010101f", M: "111b1515111111", N: "11111915131111", O: "0e11111111110e",
  P: "1e11111e101010", Q: "0e11111115120d", R: "1e11111e141211", S: "0f10100e01011e", T: "1f040404040404",
  U: "1111111111110e", V: "11111111110a04", W: "1111111515150a", X: "11110a040a1111", Y: "1111110a040404",
  Z: "1f01020408101f", "0": "0e11131519110e", "1": "040c040404040e", "2": "0e11010204081f", "3": "1f02040201110e",
  "4": "02060a121f0202", "5": "1f101e0101110e", "6": "0608101e11110e", "7": "1f010204080808", "8": "0e11110e11110e",
  "9": "0e11110f01020c", "!": "04040404040004", "?": "0e110102040004", ".": "00000000000004", "-": "0000001f000000",
  ",": "00000000000408", ":": "00000400000400", " ": "00000000000000",
}
const CELL = 100
const glyphs: Record<string, { ha: number; o: string; _cachedOutline: string[] }> = {}
for (const [ch, hex] of Object.entries(BITMAPS)) {
  const cmds: string[] = []
  for (let r = 0; r < 7; r++) {
    const bits = parseInt(hex.slice(r * 2, r * 2 + 2), 16)
    const y0 = (6 - r) * CELL
    const y1 = y0 + CELL
    // merge horizontal runs into one rectangle, wound clockwise so three treats each as solid
    for (let c = 0; c < 5; c++) {
      if (!(bits & (16 >> c))) continue
      let e = c
      while (e + 1 < 5 && bits & (16 >> (e + 1))) e++
      const x0 = c * CELL
      const x1 = (e + 1) * CELL
      cmds.push(`m ${x0} ${y0} l ${x0} ${y1} l ${x1} ${y1} l ${x1} ${y0}`)
      c = e
    }
  }
  const o = cmds.join(" ")
  glyphs[ch] = { ha: 6 * CELL, o, _cachedOutline: o.split(" ") }
}
const PIXEL_FONT = {
  familyName: "Pixel 5x7",
  resolution: 7 * CELL,
  boundingBox: { yMin: -CELL, yMax: 8 * CELL },
  underlineThickness: 0,
  glyphs,
}

/** Chunky extruded pixel-font letters (drei <Text3D>) with a self-generated font. Sways gently; hover lights the faces, tap makes it hop. */
export default function Text3DTitle({ text = "HELLO XR", color = "#9FE7D2", size = 0.05, depth = 0.015 }: Props) {
  const g = useRef<THREE.Group>(null)
  const hop = useRef(0)
  const [hover, setHover] = useState(false)
  const label = text.toUpperCase().replace(/[^A-Z0-9!?.,:\- \n]/g, "?")

  useFrame((state, dt) => {
    const o = g.current
    if (!o) return
    hop.current = Math.max(0, hop.current - dt * 2.5)
    o.position.y = Math.sin(hop.current * Math.PI) * size * 0.4
    o.rotation.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.18
  })

  return (
    <group
      ref={g}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
      onClick={() => (hop.current = 1)}
    >
      <Suspense fallback={null}>
        <Center>
          <Text3D material={[]} font={PIXEL_FONT} size={size} height={depth} curveSegments={1}>
            {label}
            <meshStandardMaterial attach="material-0" color={color} emissive={color} emissiveIntensity={hover ? 0.55 : 0.15} roughness={0.35} />
            <meshStandardMaterial attach="material-1" color="#15171E" roughness={0.6} metalness={0.3} />
          </Text3D>
        </Center>
      </Suspense>
    </group>
  )
}
