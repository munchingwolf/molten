"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { Check, Delete } from "@react-three/uikit-lucide"
import { Color, type Group, type MeshStandardMaterial } from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

type Props = {
  /** The digits typed so far. */
  value?: string
  onChange?: (v: string) => void
  /** Fires when ✓ is pressed. */
  onPress?: () => void
  label?: string
  maxLength?: number
  /** Show dots instead of digits (PINs). */
  mask?: boolean
  color?: string
  size?: number
}

const KW = 0.05 // key 5 × 4.4 cm
const KH = 0.044
const GAP = 0.006
const D = 0.014
const GRID_W = 3 * KW + 2 * GAP
const DISPLAY_H = 0.05
const TOTAL_H = DISPLAY_H + 0.01 + 4 * KH + 3 * GAP
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "ok"]

/** 16 × 25 cm keypad with a display: 12 pressable 3D keys, ⌫ to delete, ✓ to submit (`onPress`). Controlled via `value`, or uncontrolled. */
export default function NumberPad({ value, onChange, onPress, label = "Enter code", maxLength = 6, mask = false, color = "#9FE7D2", size = 1 }: Props) {
  const [inner, setInner] = useState("")
  const text = (value ?? inner).slice(0, Math.max(1, maxLength))
  const display = useRef<MeshStandardMaterial>(null)
  const flash = useRef(0)
  const well = useMemo(() => new RoundedBoxGeometry(GRID_W, DISPLAY_H, 0.008, 3, 0.004), [])
  const accent = useMemo(() => new Color(color), [color])
  useEffect(() => () => well.dispose(), [well])

  useFrame((_, delta) => {
    flash.current = Math.max(0, flash.current - Math.min(delta, 1 / 30) * 2.5)
    if (display.current) display.current.emissiveIntensity = flash.current * 0.4
  })

  const set = (v: string) => {
    if (value === undefined) setInner(v)
    onChange?.(v)
  }
  const press = (k: string) => {
    if (k === "del") set(text.slice(0, -1))
    else if (k === "ok") {
      flash.current = 1
      onPress?.()
    } else if (text.length < maxLength) set(text + k)
  }

  const top = TOTAL_H / 2
  return (
    <group scale={size}>
      <group position={[0, top - DISPLAY_H / 2, 0]}>
        <mesh geometry={well} position={[0, 0, -0.004]}>
          <meshStandardMaterial ref={display} color="#0B0C10" emissive={accent} emissiveIntensity={0} roughness={0.8} />
        </mesh>
        <group position={[0, 0, 0.001]}>
          <Container pixelSize={0.002} pointerEvents="none">
            <Text fontSize={text ? 16 : 11} fontWeight={text ? "bold" : "normal"} letterSpacing={text ? 3 : 0} color={text ? "#EEF0F4" : "#6B7180"}>
              {text ? (mask ? "•".repeat(text.length) : text) : label}
            </Text>
          </Container>
        </group>
      </group>
      {KEYS.map((k, i) => {
        const x = ((i % 3) - 1) * (KW + GAP)
        const y = top - DISPLAY_H - 0.01 - KH / 2 - Math.floor(i / 3) * (KH + GAP)
        return (
          <Key key={k} x={x} y={y} accent={accent} primary={k === "ok"} onPress={() => press(k)}>
            {k === "del" ? (
              <Delete width={13} height={13} color="#9AA0AD" />
            ) : k === "ok" ? (
              <Check width={13} height={13} color="#06221B" />
            ) : (
              <Text fontSize={14} fontWeight="semi-bold" color="#EEF0F4">
                {k}
              </Text>
            )}
          </Key>
        )
      })}
    </group>
  )
}

function Key({ x, y, accent, primary, onPress, children }: { x: number; y: number; accent: Color; primary: boolean; onPress: () => void; children: React.ReactNode }) {
  const key = useRef<Group>(null)
  const skin = useRef<MeshStandardMaterial>(null)
  const st = useRef({ z: 0, zv: 0, down: false, glow: 0, target: 0, flash: 0 })
  const geometry = useMemo(() => new RoundedBoxGeometry(KW, KH, D, 4, 0.007), [])
  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    s.flash = Math.max(0, s.flash - dt * 5)
    s.glow += (Math.max(s.target, s.flash) - s.glow) * (1 - Math.exp(-dt * 14))
    s.zv += (450 * ((s.down ? -0.006 : 0) - s.z) - 24 * s.zv) * dt
    s.z += s.zv * dt
    if (key.current) key.current.position.z = s.z
    if (skin.current) skin.current.emissiveIntensity = (primary ? 0.25 : 0.03) + s.glow * 0.3
  })
  const up = () => {
    st.current.down = false
  }

  return (
    <group position={[x, y, 0]}>
      <group ref={key}>
        <mesh geometry={geometry}>
          <meshStandardMaterial ref={skin} color={primary ? accent : "#1F232C"} emissive={accent} emissiveIntensity={primary ? 0.25 : 0.03} roughness={0.45} metalness={0.15} />
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
          st.current.down = true
        }}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={() => {
          st.current.flash = 1
          onPress()
        }}
      >
        <boxGeometry args={[KW, KH, D + 0.004]} />
      </mesh>
    </group>
  )
}
