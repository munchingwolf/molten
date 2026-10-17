"use client"

import { useEffect, useMemo, useRef } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { Color, type Group, type MeshBasicMaterial } from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

type Props = { label?: string; color?: string; tint?: string; size?: number; onPress?: () => void }

const W = 0.16
const H = 0.06
const D = 0.022

/**
 * 16 × 6 cm slab of frosted glass over a glowing core. The glass lifts toward a fingertip,
 * squashes when pressed and the core brightens. Uses three's physical transmission
 * (one shared transmission pass, cheaper on Quest than a per-material scene render).
 */
export default function GlassButton({ label = "Glass", color = "#9FE7D2", tint = "#DDE6F2", size = 1, onPress }: Props) {
  const slab = useRef<Group>(null)
  const core = useRef<MeshBasicMaterial>(null)
  const st = useRef({ glow: 0.25, target: 0.25, z: 0, zv: 0, down: false, flash: 0 })
  const glass = useMemo(() => new RoundedBoxGeometry(W, H, D, 5, 0.018), [])
  const pill = useMemo(() => new RoundedBoxGeometry(W - 0.03, H - 0.026, 0.002, 2, 0.001), [])
  const accent = useMemo(() => new Color(color), [color])
  useEffect(() => () => (glass.dispose(), pill.dispose()), [glass, pill])

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    s.flash = Math.max(0, s.flash - dt * 3)
    s.glow += (Math.max(s.target, s.flash) - s.glow) * (1 - Math.exp(-dt * 10))
    const rest = s.down ? -0.007 : (s.target - 0.25) * 0.006 // lifts up to ~4 mm toward the finger
    const a = 380 * (rest - s.z) - 20 * s.zv
    s.zv += a * dt
    s.z += s.zv * dt
    if (slab.current) {
      slab.current.position.z = s.z
      slab.current.scale.z = s.down ? 0.86 : 1
    }
    core.current?.color.copy(accent).multiplyScalar(Math.min(1.2, 0.35 + s.glow * 0.75))
  })

  const near = (e: ThreeEvent<PointerEvent>) => {
    st.current.target = e.pointerType === "touch" ? Math.min(1, Math.max(0.5, 1.1 - e.distance * 8)) : 0.8
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
      {/* Glowing core behind the glass; opaque, because three's transmission pass only captures opaque objects. */}
      <mesh geometry={pill} position={[0, 0, -D / 2 - 0.004]}>
        <meshBasicMaterial ref={core} color={color} toneMapped={false} />
      </mesh>
      <group ref={slab}>
        <mesh geometry={glass}>
          <meshPhysicalMaterial
            color={tint}
            transmission={1}
            thickness={0.02}
            roughness={0.18}
            ior={1.45}
            clearcoat={1}
            clearcoatRoughness={0.1}
            emissive={accent}
            emissiveIntensity={0.04}
          />
        </mesh>
        {/* Thin top-edge highlight: reads as a reflection even without an environment map. */}
        <mesh position={[0, H / 2 - 0.006, D / 2 + 0.0004]}>
          <planeGeometry args={[W - 0.04, 0.0016]} />
          <meshBasicMaterial color="white" transparent opacity={0.45} toneMapped={false} />
        </mesh>
        <group position={[0, -0.001, D / 2 + 0.001]}>
          <Container pixelSize={0.002} pointerEvents="none">
            <Text fontSize={13} fontWeight="semi-bold" color="#F6F8FB">
              {label}
            </Text>
          </Container>
        </group>
      </group>
      <mesh
        visible={false}
        position={[0, 0, 0.002]}
        onPointerOver={near}
        onPointerMove={near}
        onPointerOut={() => {
          st.current.target = 0.25
          up()
        }}
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={() => {
          st.current.flash = 1.3
          onPress?.()
        }}
      >
        <boxGeometry args={[W, H, D + 0.012]} />
      </mesh>
    </group>
  )
}
