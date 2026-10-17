"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { Check, ChevronDown } from "@react-three/uikit-lucide"
import { Color, type Group, type MeshStandardMaterial } from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

type Props = {
  value?: string
  onChange?: (v: string) => void
  /** List of choices, or one comma-separated string ("Low, Medium, High"). */
  options?: string[] | string
  label?: string
  color?: string
  size?: number
}

const W = 0.18 // 18 cm wide
const H = 0.052 // trigger height
const ROW = 0.044 // option rows: 4.4 cm, comfortable for a fingertip
const D = 0.014
const PX = 500 // uikit px per metre at pixelSize 0.002

/** 18 cm dropdown. Tap to open a list that springs down and floats 1.5 cm in front; tap a row to choose. Controlled via `value`, or uncontrolled. */
export default function Select({ value, onChange, options = ["Low", "Medium", "High", "Ultra"], label = "Quality", color = "#9FE7D2", size = 1 }: Props) {
  const list = (typeof options === "string" ? options.split(",") : options).map((o) => o.trim()).filter(Boolean)
  const [inner, setInner] = useState(list[1] ?? list[0] ?? "")
  const [open, setOpen] = useState(false)
  const current = value ?? inner
  const sheet = useRef<Group>(null)
  const anim = useRef({ s: 0, v: 0 })
  const trigger = useMemo(() => new RoundedBoxGeometry(W, H, D, 4, 0.007), [])
  const panelH = list.length * ROW + 0.012
  const panel = useMemo(() => new RoundedBoxGeometry(W + 0.008, panelH, 0.008, 4, 0.004), [panelH])
  useEffect(() => () => (trigger.dispose(), panel.dispose()), [trigger, panel])

  useFrame((_, delta) => {
    const a = anim.current
    const dt = Math.min(delta, 1 / 30)
    a.v += (360 * ((open ? 1 : 0) - a.s) - 18 * a.v) * dt
    a.s += a.v * dt
    if (sheet.current) sheet.current.scale.set(1, Math.max(0.001, a.s), 1)
  })

  const choose = (o: string) => {
    if (value === undefined) setInner(o)
    onChange?.(o)
    setOpen(false)
  }
  const toggle = () => {
    if (!open) anim.current = { s: 0, v: 0 }
    setOpen(!open)
  }

  return (
    <group scale={size}>
      <group position={[-W / 2, H / 2 + 0.014, 0]}>
        <Container pixelSize={0.002} anchorX="left" pointerEvents="none">
          <Text fontSize={10} fontWeight="medium" color="#9AA0AD">
            {label}
          </Text>
        </Container>
      </group>
      <Row width={W} height={H} geometry={trigger} color={color} onPress={toggle} base={open ? "#232733" : "#1B1E26"}>
        <Container pixelSize={0.002} pointerEvents="none" width={W * PX} height={H * PX} paddingX={9} flexDirection="row" alignItems="center" justifyContent="space-between">
          <Text fontSize={12} fontWeight="semi-bold" color="#EEF0F4">
            {current}
          </Text>
          <ChevronDown width={12} height={12} color={open ? color : "#9AA0AD"} />
        </Container>
      </Row>
      {open && (
        // Hangs from the trigger's bottom edge and floats in front, so it overlaps what's below without z-fighting.
        <group ref={sheet} position={[0, -H / 2 - 0.006, 0.015]} scale={[1, 0.001, 1]}>
          <mesh geometry={panel} position={[0, -panelH / 2, -0.006]}>
            <meshStandardMaterial color="#15171E" emissive="#101218" roughness={0.6} />
          </mesh>
          {list.map((o, i) => (
            <group key={o + i} position={[0, -0.006 - ROW / 2 - i * ROW, 0]}>
              <Row width={W - 0.008} height={ROW - 0.004} color={color} onPress={() => choose(o)} base={o === current ? "#1F2A2A" : "#15171E"} flat>
                <Container pixelSize={0.002} pointerEvents="none" width={(W - 0.008) * PX} height={(ROW - 0.004) * PX} paddingX={9} flexDirection="row" alignItems="center" justifyContent="space-between">
                  <Text fontSize={11} fontWeight={o === current ? "semi-bold" : "normal"} color={o === current ? color : "#EEF0F4"}>
                    {o}
                  </Text>
                  {o === current ? <Check width={11} height={11} color={color} /> : null}
                </Container>
              </Row>
            </group>
          ))}
        </group>
      )}
    </group>
  )
}

/** A pressable slab: hover glow, springy press depth, static hit box. */
function Row({ width, height, geometry, color, base, flat, onPress, children }: {
  width: number
  height: number
  geometry?: RoundedBoxGeometry
  color: string
  base: string
  flat?: boolean
  onPress: () => void
  children: React.ReactNode
}) {
  const body = useRef<Group>(null)
  const skin = useRef<MeshStandardMaterial>(null)
  const st = useRef({ z: 0, zv: 0, down: false, glow: 0, target: 0 })
  const accent = useMemo(() => new Color(color), [color])
  const depth = flat ? 0.004 : D

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    s.glow += (s.target - s.glow) * (1 - Math.exp(-dt * 12))
    s.zv += (420 * ((s.down ? -0.004 : 0) - s.z) - 22 * s.zv) * dt
    s.z += s.zv * dt
    if (body.current) body.current.position.z = s.z
    if (skin.current) skin.current.emissiveIntensity = 0.03 + s.glow * 0.22
  })
  const up = () => {
    st.current.down = false
  }

  return (
    <group>
      <group ref={body}>
        {geometry ? (
          <mesh geometry={geometry}>
            <meshStandardMaterial ref={skin} color={base} emissive={accent} emissiveIntensity={0.03} roughness={0.5} metalness={0.15} />
          </mesh>
        ) : (
          <mesh>
            <boxGeometry args={[width, height, depth]} />
            <meshStandardMaterial ref={skin} color={base} emissive={accent} emissiveIntensity={0.03} roughness={0.5} metalness={0.15} />
          </mesh>
        )}
        <group position={[0, 0, depth / 2 + 0.001]}>{children}</group>
      </group>
      <mesh
        visible={false}
        position={[0, 0, 0.001]}
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
        onClick={onPress}
      >
        <boxGeometry args={[width, height, depth + 0.004]} />
      </mesh>
    </group>
  )
}
