"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { Check } from "@react-three/uikit-lucide"
import { Color, LatheGeometry, Vector2, type Group, type MeshStandardMaterial } from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

type Props = {
  value?: boolean
  onChange?: (v: boolean) => void
  label?: string
  /** "square" = checkbox, "round" = radio-style dot */
  shape?: "square" | "round"
  color?: string
  size?: number
}

const S = 0.044 // 4.4 cm box
const D = 0.014
const X = -0.07 // box sits left of centre, label to its right
const OFF = new Color("#1B1E26")

// Disc with a rounded rim, facing +z (lathe profile runs bottom → top so normals face out).
function puck(r: number, d: number, b: number) {
  const pts = [new Vector2(0, -d / 2)]
  const arc = (y: number, from: number) => {
    for (let i = 0; i <= 6; i++) {
      const a = from + (i / 6) * (Math.PI / 2)
      pts.push(new Vector2(r - b + b * Math.cos(a), y + b * Math.sin(a)))
    }
  }
  arc(-d / 2 + b, -Math.PI / 2) // bottom rim
  arc(d / 2 - b, 0) // top rim
  pts.push(new Vector2(0, d / 2))
  return new LatheGeometry(pts, 64).rotateX(Math.PI / 2)
}

/** 4.4 cm 3D checkbox with a label. Tap the box or the label to toggle; the box fills and the check springs in. */
export default function Checkbox({ value, onChange, label = "Snap to grid", shape = "square", color = "#9FE7D2", size = 1 }: Props) {
  const [inner, setInner] = useState(false)
  const on = value ?? inner
  const box = useRef<Group>(null)
  const mark = useRef<Group>(null)
  const skin = useRef<MeshStandardMaterial>(null)
  const st = useRef({ z: 0, zv: 0, s: on ? 1 : 0, sv: 0, fill: on ? 1 : 0, down: false, hover: 0, target: 0 })
  const geometry = useMemo(() => (shape === "round" ? puck(S / 2, D, 0.005) : new RoundedBoxGeometry(S, S, D, 5, 0.007)), [shape])
  const accent = useMemo(() => new Color(color), [color])
  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    s.zv += (420 * ((s.down ? -0.006 : 0) - s.z) - 22 * s.zv) * dt
    s.z += s.zv * dt
    s.sv += (300 * ((on ? 1 : 0) - s.s) - 14 * s.sv) * dt // bouncy pop for the mark
    s.s += s.sv * dt
    s.fill += ((on ? 1 : 0) - s.fill) * (1 - Math.exp(-dt * 14))
    s.hover += (s.target - s.hover) * (1 - Math.exp(-dt * 10))
    if (box.current) box.current.position.z = s.z
    if (mark.current) mark.current.scale.setScalar(Math.max(0.001, s.s))
    if (skin.current) {
      skin.current.color.copy(OFF).lerp(accent, s.fill)
      skin.current.emissive.copy(accent)
      skin.current.emissiveIntensity = 0.04 + s.hover * 0.18 + s.fill * 0.15
    }
  })

  const toggle = () => {
    if (value === undefined) setInner(!on)
    onChange?.(!on)
  }
  const down = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    st.current.down = true
  }
  const up = () => {
    st.current.down = false
  }

  return (
    <group scale={size}>
      <group ref={box} position={[X, 0, 0]}>
        <mesh geometry={geometry}>
          <meshStandardMaterial ref={skin} color={on ? color : "#1B1E26"} roughness={0.4} metalness={0.15} />
        </mesh>
        <group ref={mark} position={[0, 0, D / 2 + 0.001]} scale={on ? 1 : 0.001}>
          {shape === "round" ? (
            <mesh>
              <circleGeometry args={[0.009, 32]} />
              <meshBasicMaterial color="#0B0C10" />
            </mesh>
          ) : (
            <Container pixelSize={0.002} pointerEvents="none">
              <Check width={16} height={16} color="#0B0C10" />
            </Container>
          )}
        </group>
      </group>
      <group position={[X + S / 2 + 0.014, 0, 0]}>
        <Container pixelSize={0.002} anchorX="left" pointerEvents="none">
          <Text fontSize={11} fontWeight="medium" color="#EEF0F4">
            {label}
          </Text>
        </Container>
      </group>
      {/* Box and label are one 20 cm hit row, like a native checkbox label. */}
      <mesh
        visible={false}
        position={[X - S / 2 + 0.1, 0, 0.002]}
        onPointerOver={() => (st.current.target = 1)}
        onPointerOut={() => {
          st.current.target = 0
          up()
        }}
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={toggle}
      >
        <boxGeometry args={[0.2, S + 0.008, D + 0.004]} />
      </mesh>
    </group>
  )
}
