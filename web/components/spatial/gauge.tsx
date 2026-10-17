"use client"

import { useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { CanvasTexture, SRGBColorSpace, type Group, type MeshBasicMaterial } from "three"
import { Container, Text } from "@react-three/uikit"

type Props = { value?: number; label?: string; color?: string; max?: number; unit?: string }

const SWEEP = (4 / 3) * Math.PI // 240° dial, open at the bottom
const R = 0.095 // tick radius, metres
const BEZEL = 0.125
const TICKS = 41
const OFF = "#2A2E3A"

let matcap: CanvasTexture | undefined
// Previews have no lights, so a generated matcap gives the body the same soft top-light everywhere.
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

// Angle from +y, counter-clockwise: t = 0 is lower-left, t = 1 lower-right.
const angleOf = (t: number) => SWEEP / 2 - t * SWEEP

/** 25 cm dial gauge. `value` is 0-1; the needle springs to it and the tick ring lights up. Readout shows value x `max` + `unit`. */
export default function Gauge({ value = 0.72, label = "CPU load", color = "#9FE7D2", max = 100, unit = "%" }: Props) {
  const t = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
  const [hover, setHover] = useState(false)
  const needle = useRef<Group>(null)
  const ticks = useRef<(MeshBasicMaterial | null)[]>([])
  const spring = useRef({ x: 0, v: 0, lit: -1 })
  const mc = useMemo(getMatcap, [])
  const tickColor = (k: number) => (k / (TICKS - 1) > 0.8 ? "#F2B48A" : color)

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const s = spring.current
    s.v += (120 * (t - s.x) - 14 * s.v) * dt // slightly under-damped: the needle overshoots a touch, like a real meter
    s.x += s.v * dt
    const settled = Math.abs(t - s.x) < 1e-4 && Math.abs(s.v) < 1e-3
    if (settled) s.x = t
    if (needle.current) needle.current.rotation.z = angleOf(Math.min(1.04, Math.max(-0.04, s.x)))
    const lit = Math.round(Math.min(1, Math.max(0, s.x)) * (TICKS - 1)) + (s.x > 0.001 ? 1 : 0)
    if (lit !== s.lit) {
      s.lit = lit
      ticks.current.forEach((m, k) => m?.color.set(k < lit ? tickColor(k) : OFF))
    }
    if (!settled) state.invalidate()
  })

  const shown = t * max
  return (
    <group onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.008]}>
        <cylinderGeometry args={[BEZEL, BEZEL, 0.016, 64]} />
        <meshMatcapMaterial matcap={mc} color="#1B1E26" />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <torusGeometry args={[BEZEL, 0.004, 12, 96]} />
        <meshMatcapMaterial matcap={mc} color={hover ? color : "#3A3F4E"} />
      </mesh>
      {Array.from({ length: TICKS }, (_, k) => {
        const a = angleOf(k / (TICKS - 1))
        const major = k % 10 === 0
        const r = R - (major ? 0.004 : 0)
        return (
          <mesh key={k} position={[-Math.sin(a) * r, Math.cos(a) * r, 0.003]} rotation={[0, 0, a]}>
            <boxGeometry args={[major ? 0.004 : 0.003, major ? 0.017 : 0.009, 0.004]} />
            <meshBasicMaterial
              ref={(m) => {
                ticks.current[k] = m
              }}
              color={OFF}
              toneMapped={false}
            />
          </mesh>
        )
      })}
      <group ref={needle} position={[0, 0, 0.008]} rotation={[0, 0, angleOf(0)]}>
        <mesh position={[0, 0.036, 0]}>
          <boxGeometry args={[0.004, 0.082, 0.003]} />
          <meshBasicMaterial color="#F2B48A" toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.012, 0]}>
          <boxGeometry args={[0.007, 0.022, 0.003]} />
          <meshMatcapMaterial matcap={mc} color="#3A3F4E" />
        </mesh>
      </group>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.011]}>
        <cylinderGeometry args={[0.011, 0.011, 0.008, 32]} />
        <meshMatcapMaterial matcap={mc} color="#EEF0F4" />
      </mesh>
      <group position={[0, -0.062, 0.004]}>
        <Container pixelSize={0.002} pointerEvents="none" flexDirection="column" alignItems="center">
          <Text fontSize={22} fontWeight="bold" color="#EEF0F4">
            {`${Number.isInteger(shown) || shown >= 10 ? Math.round(shown) : shown.toFixed(1)}${unit}`}
          </Text>
          <Text fontSize={10} color="#9AA0AD">
            {label}
          </Text>
        </Container>
      </group>
      {hover && (
        <>
          <group position={[-0.085, -0.075, 0.004]}>
            <Container pixelSize={0.002} pointerEvents="none">
              <Text fontSize={9} color="#6B7180">{`0${unit}`}</Text>
            </Container>
          </group>
          <group position={[0.085, -0.075, 0.004]}>
            <Container pixelSize={0.002} pointerEvents="none">
              <Text fontSize={9} color="#6B7180">{`${max}${unit}`}</Text>
            </Container>
          </group>
        </>
      )}
    </group>
  )
}
