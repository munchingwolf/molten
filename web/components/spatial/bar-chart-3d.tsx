"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { CanvasTexture, SRGBColorSpace, type Mesh } from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
import { Container, Text } from "@react-three/uikit"

type Datum = { label: string; value: number }
type Props = { data?: Datum[]; label?: string; color?: string; unit?: string }

const SAMPLE: Datum[] = [
  { label: "Jan", value: 42 },
  { label: "Feb", value: 58 },
  { label: "Mar", value: 35 },
  { label: "Apr", value: 71 },
  { label: "May", value: 64 },
  { label: "Jun", value: 88 },
]
const BAR = 0.04 // bar width and depth, metres
const SLOT = 0.066 // bar + gap (33 px at pixelSize 0.002)
const H = 0.26 // tallest bar
const DEPTH = 0.1 // base depth

let matcap: CanvasTexture | undefined
// Previews have no lights, so a generated matcap gives the bars the same soft top-light everywhere.
function getMatcap() {
  if (matcap) return matcap
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const g = c.getContext("2d")!
  const grad = g.createRadialGradient(64, 30, 0, 64, 30, 90)
  grad.addColorStop(0, "#ffffff")
  grad.addColorStop(0.5, "#d0d3da")
  grad.addColorStop(1, "#2f323a")
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  matcap = new CanvasTexture(c)
  matcap.colorSpace = SRGBColorSpace
  return matcap
}

const fmt = (v: number, unit: string) => `${Number.isInteger(v) ? v.toLocaleString("en-US") : v.toFixed(1)}${unit}`

/** 3D bar chart you can walk around. Bars grow in on mount and when `data` changes; hover a column to read its value. */
export default function BarChart3D({ data = SAMPLE, label = "Monthly active users (k)", color = "#9FE7D2", unit = "" }: Props) {
  const rows = data.map((d) => ({ label: d.label, value: Number.isFinite(d.value) ? Math.max(0, d.value) : 0 })) // shortcut: negatives clamp to 0, add a zero line if a chart needs them
  const max = Math.max(...rows.map((r) => r.value), 0) || 1
  const heights = rows.map((r) => (r.value / max) * H)
  const n = rows.length
  const width = Math.max(n, 3) * SLOT + 0.04
  const xOf = (i: number) => (i - (n - 1) / 2) * SLOT

  const [hover, setHover] = useState<number | null>(null)
  const bars = useRef<(Mesh | null)[]>([])
  const cur = useRef<number[]>([])
  const born = useRef<number | null>(null)
  const mc = useMemo(getMatcap, [])
  const barGeo = useMemo(() => new RoundedBoxGeometry(BAR, 1, BAR, 2, 0.006), [])
  const baseGeo = useMemo(() => new RoundedBoxGeometry(width, 0.014, DEPTH, 2, 0.005), [width])
  useEffect(() => () => barGeo.dispose(), [barGeo])
  useEffect(() => () => baseGeo.dispose(), [baseGeo])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const now = state.clock.elapsedTime
    if (born.current === null) born.current = now
    let moving = false
    for (let i = 0; i < n; i++) {
      const m = bars.current[i]
      if (!m) continue
      if (now - born.current < i * 0.07) {
        moving = true // staggered entrance
        continue
      }
      const c = cur.current[i] ?? 0
      let h = c + (heights[i] - c) * (1 - Math.exp(-dt * 7))
      if (Math.abs(heights[i] - h) < 0.0004) h = heights[i]
      else moving = true
      cur.current[i] = h
      m.scale.y = Math.max(h, 0.0001)
      m.position.y = h / 2
    }
    if (moving) state.invalidate() // keeps demand-mode previews animating until the bars settle
  })

  return (
    <group position={[0, -H / 2 + 0.01, 0]}>
      <mesh geometry={baseGeo} position={[0, -0.007, 0]}>
        <meshMatcapMaterial matcap={mc} color="#2A2E3A" />
      </mesh>
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <mesh key={k} position={[0, H * k, -DEPTH / 2 + 0.006]}>
          <boxGeometry args={[width - 0.02, 0.0012, 0.0012]} />
          <meshBasicMaterial color="#323745" />
        </mesh>
      ))}
      {rows.map((r, i) => (
        <group key={i} position={[xOf(i), 0, 0]}>
          <mesh
            ref={(m) => {
              bars.current[i] = m
            }}
            geometry={barGeo}
            scale={[1, 0.0001, 1]}
          >
            <meshMatcapMaterial matcap={mc} color={hover === i ? "#F2B48A" : color} />
          </mesh>
          {/* Full-height column hit box: even a zero bar is easy to hover (6.6 × 26 cm). */}
          <mesh
            visible={false}
            position={[0, H / 2, 0]}
            onPointerOver={() => setHover(i)}
            onPointerOut={() => setHover((h) => (h === i ? null : h))}
          >
            <boxGeometry args={[SLOT, H, DEPTH * 0.8]} />
          </mesh>
        </group>
      ))}
      {hover !== null && hover < n && (
        <group position={[xOf(hover), heights[hover] + 0.04, 0.02]}>
          <Container
            pixelSize={0.002}
            pointerEvents="none"
            flexDirection="column"
            alignItems="center"
            paddingX={10}
            paddingY={6}
            borderRadius={8}
            backgroundColor="#15171E"
            borderWidth={1.5}
            borderColor="#F2B48A"
          >
            <Text fontSize={16} fontWeight="bold" color="#EEF0F4">
              {fmt(rows[hover].value, unit)}
            </Text>
            <Text fontSize={10} color="#9AA0AD">
              {rows[hover].label}
            </Text>
          </Container>
        </group>
      )}
      <group position={[0, -0.03, DEPTH / 2 + 0.002]}>
        <Container pixelSize={0.002} pointerEvents="none" flexDirection="row">
          {rows.map((r, i) => (
            <Container key={i} width={SLOT / 0.002} justifyContent="center">
              <Text fontSize={11} color={hover === i ? "#EEF0F4" : "#9AA0AD"}>
                {r.label}
              </Text>
            </Container>
          ))}
          {n === 0 && (
            <Text fontSize={12} color="#9AA0AD">
              No data
            </Text>
          )}
        </Container>
      </group>
      <group position={[0, H + 0.05, 0]}>
        <Container pixelSize={0.002} pointerEvents="none">
          <Text fontSize={15} fontWeight="semi-bold" color="#EEF0F4">
            {label}
          </Text>
        </Container>
      </group>
    </group>
  )
}
