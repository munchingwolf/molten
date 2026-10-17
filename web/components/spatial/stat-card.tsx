"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { CanvasTexture, SRGBColorSpace, type Group } from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
import { Container, Text } from "@react-three/uikit"
import { TrendingDown, TrendingUp } from "@react-three/uikit-lucide"

type Props = { label?: string; value?: number | string; delta?: number; caption?: string }

const W = 230 // px at pixelSize 0.002 -> 46 cm
const H = 124

let matcap: CanvasTexture | undefined
// Previews have no lights, so a generated matcap shades the card's edge the same everywhere.
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

/** KPI card on a 1.4 cm thick slab. `delta` is a percent change (green up, warm down); hover lifts the card and reveals the `caption`. */
export default function StatCard({ label = "Active users", value = 12480, delta = 12.4, caption = "vs last week" }: Props) {
  const [hover, setHover] = useState(false)
  const lift = useRef<Group>(null)
  const mc = useMemo(getMatcap, [])
  const slab = useMemo(() => new RoundedBoxGeometry(W * 0.002 - 0.006, H * 0.002 - 0.006, 0.014, 3, 0.012), [])
  useEffect(() => () => slab.dispose(), [slab])

  useFrame((state, delta) => {
    const g = lift.current
    if (!g) return
    const k = 1 - Math.exp(-Math.min(delta, 0.05) * 12)
    const z = hover ? 0.02 : 0
    const s = hover ? 1.03 : 1
    g.position.z += (z - g.position.z) * k
    g.scale.setScalar(g.scale.x + (s - g.scale.x) * k)
    if (Math.abs(z - g.position.z) > 1e-4) state.invalidate()
  })

  const shown = typeof value === "number" ? value.toLocaleString("en-US", { maximumFractionDigits: 2 }) : value
  const d = Number.isFinite(delta) ? delta : 0
  const up = d >= 0
  const tone = up ? "#9FE7D2" : "#F2B48A"
  const Icon = up ? TrendingUp : TrendingDown

  return (
    <group ref={lift} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
      <mesh geometry={slab} position={[0, 0, -0.0075]}>
        <meshMatcapMaterial matcap={mc} color={hover ? "#2A2E3A" : "#1B1E26"} />
      </mesh>
      <Container
        pixelSize={0.002}
        width={W}
        height={H}
        flexDirection="column"
        justifyContent="space-between"
        padding={18}
        borderRadius={16}
        backgroundColor="#15171E"
        borderWidth={1.5}
        borderColor={hover ? "#9FE7D2" : "#323745"}
      >
        <Text fontSize={13} fontWeight="medium" color="#9AA0AD">
          {label}
        </Text>
        <Text fontSize={38} fontWeight="bold" color="#EEF0F4">
          {shown}
        </Text>
        <Container flexDirection="row" alignItems="center" gap={6}>
          <Icon width={14} height={14} color={tone} />
          <Text fontSize={13} fontWeight="semi-bold" color={tone}>
            {`${up ? "+" : "-"}${Math.abs(d).toFixed(1)}%`}
          </Text>
          {hover && (
            <Text fontSize={12} color="#6B7180">
              {caption}
            </Text>
          )}
        </Container>
      </Container>
    </group>
  )
}
