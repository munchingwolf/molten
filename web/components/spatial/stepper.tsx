"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { Minus, Plus } from "@react-three/uikit-lucide"
import { Color, type Group, type MeshStandardMaterial } from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

type Props = {
  value?: number
  onChange?: (v: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
  color?: string
  size?: number
}

const K = 0.048 // 4.8 cm keys
const D = 0.016
const WELL = 0.084

/** − value + stepper with 4.8 cm keys that sink when poked; the number pops on every change. Controlled via `value`, or uncontrolled. */
export default function Stepper({ value, onChange, min = 0, max = 10, step = 1, label = "Quantity", color = "#9FE7D2", size = 1 }: Props) {
  const lo = Math.min(min, max)
  const hi = Math.max(min, max)
  const [inner, setInner] = useState(Math.min(hi, Math.max(lo, 1)))
  const v = Math.min(hi, Math.max(lo, value ?? inner))
  const decimals = (String(step).split(".")[1] ?? "").length
  const num = useRef<Group>(null)
  const pop = useRef({ s: 1, v: 0 })
  const well = useMemo(() => new RoundedBoxGeometry(WELL, K, 0.006, 3, 0.003), [])
  useEffect(() => () => well.dispose(), [well])

  const set = (n: number) => {
    const c = +Math.min(hi, Math.max(lo, n)).toFixed(decimals)
    if (c === v) return
    pop.current.v = 2.2 // kick the number's scale spring
    if (value === undefined) setInner(c)
    onChange?.(c)
  }

  useFrame((_, delta) => {
    const p = pop.current
    const dt = Math.min(delta, 1 / 30)
    p.v += (320 * (1 - p.s) - 16 * p.v) * dt
    p.s += p.v * dt
    num.current?.scale.setScalar(p.s)
  })

  const x = WELL / 2 + 0.008 + K / 2
  return (
    <group scale={size}>
      <group position={[0, K / 2 + 0.016, 0]}>
        <Container pixelSize={0.002} pointerEvents="none">
          <Text fontSize={10} fontWeight="medium" color="#9AA0AD">
            {label}
          </Text>
        </Container>
      </group>
      <Key x={-x} color={color} disabled={v <= lo} onPress={() => set(v - step)}>
        <Minus width={14} height={14} color={v <= lo ? "#6B7180" : "#EEF0F4"} />
      </Key>
      <mesh geometry={well} position={[0, 0, -D / 2 + 0.003]}>
        <meshStandardMaterial color="#0B0C10" emissive="#0B0C10" roughness={0.8} />
      </mesh>
      <group ref={num} position={[0, 0, -D / 2 + 0.007]}>
        <Container pixelSize={0.002} pointerEvents="none">
          <Text fontSize={18} fontWeight="bold" color="#EEF0F4">
            {v.toFixed(decimals)}
          </Text>
        </Container>
      </group>
      <Key x={x} color={color} disabled={v >= hi} onPress={() => set(v + step)}>
        <Plus width={14} height={14} color={v >= hi ? "#6B7180" : "#EEF0F4"} />
      </Key>
    </group>
  )
}

function Key({ x, color, disabled, onPress, children }: { x: number; color: string; disabled: boolean; onPress: () => void; children: React.ReactNode }) {
  const key = useRef<Group>(null)
  const skin = useRef<MeshStandardMaterial>(null)
  const st = useRef({ z: 0, zv: 0, down: false, glow: 0, target: 0, flash: 0 })
  const geometry = useMemo(() => new RoundedBoxGeometry(K, K, D, 4, 0.008), [])
  const accent = useMemo(() => new Color(color), [color])
  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    s.flash = Math.max(0, s.flash - dt * 4)
    s.glow += (Math.max(disabled ? 0 : s.target, s.flash) - s.glow) * (1 - Math.exp(-dt * 12))
    s.zv += (420 * ((s.down ? -0.006 : 0) - s.z) - 22 * s.zv) * dt
    s.z += s.zv * dt
    if (key.current) key.current.position.z = s.z
    if (skin.current) skin.current.emissiveIntensity = 0.04 + s.glow * 0.3
  })

  const up = () => {
    st.current.down = false
  }
  return (
    <group position={[x, 0, 0]}>
      <group ref={key}>
        <mesh geometry={geometry}>
          <meshStandardMaterial ref={skin} color={disabled ? "#15171E" : "#1F232C"} emissive={accent} emissiveIntensity={0.04} roughness={0.45} metalness={0.2} />
        </mesh>
        <group position={[0, 0, D / 2 + 0.001]}>
          <Container pixelSize={0.002} pointerEvents="none">
            {children}
          </Container>
        </group>
      </group>
      <mesh
        visible={false}
        position={[0, 0, 0.002]}
        onPointerOver={() => (st.current.target = 1)}
        onPointerOut={() => {
          st.current.target = 0
          up()
        }}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          ;(e.target as Element).setPointerCapture?.(e.pointerId)
          if (!disabled) st.current.down = true
        }}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={() => {
          if (disabled) return
          st.current.flash = 1
          onPress()
        }}
      >
        <boxGeometry args={[K, K, D + 0.004]} />
      </mesh>
    </group>
  )
}
