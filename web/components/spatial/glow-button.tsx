"use client"

import { useEffect, useMemo, useRef } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { AdditiveBlending, CanvasTexture, Color, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial } from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

type Props = { label?: string; color?: string; size?: number; onPress?: () => void }

const W = 0.16 // metres
const H = 0.056
const D = 0.02
const PRESS = 0.008 // press depth

// Soft rounded-rect glow, drawn once; tinted by the material colour.
function glowTexture() {
  const c = document.createElement("canvas")
  c.width = 512
  c.height = 256
  const g = c.getContext("2d")!
  g.shadowColor = "white"
  g.shadowBlur = 48
  g.fillStyle = "white"
  g.beginPath()
  g.roundRect(96, 88, 320, 80, 40)
  g.fill()
  return new CanvasTexture(c)
}

/** 16 × 5.6 cm button that glows brighter as a fingertip approaches, sinks when pressed and flashes on click. */
export default function GlowButton({ label = "Glow", color = "#9FE7D2", size = 1, onPress }: Props) {
  const body = useRef<Mesh>(null)
  const halo = useRef<MeshBasicMaterial>(null)
  const skin = useRef<MeshStandardMaterial>(null)
  const st = useRef({ glow: 0.15, target: 0.15, z: 0, zv: 0, down: false, flash: 0 })
  const geometry = useMemo(() => new RoundedBoxGeometry(W, H, D, 4, 0.014), [])
  const texture = useMemo(() => (typeof document === "undefined" ? null : glowTexture()), [])
  const tint = useMemo(() => new Color(color), [color])
  useEffect(() => () => (geometry.dispose(), texture?.dispose()), [geometry, texture])

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    s.flash = Math.max(0, s.flash - dt * 3)
    s.glow += (Math.max(s.target, s.flash) - s.glow) * (1 - Math.exp(-dt * 12))
    const a = 420 * ((s.down ? -PRESS : 0) - s.z) - 22 * s.zv // spring: overshoots a little on release
    s.zv += a * dt
    s.z += s.zv * dt
    if (body.current) body.current.position.z = s.z
    if (halo.current) halo.current.opacity = Math.min(1, s.glow)
    if (skin.current) skin.current.emissiveIntensity = 0.08 + s.glow * 0.55
  })

  const near = (e: ThreeEvent<PointerEvent>) => {
    // Fingertips report distance: glow ramps from 10 cm away to touch. Rays and mice just hover.
    st.current.target = e.pointerType === "touch" ? Math.min(1, Math.max(0.35, 1.1 - e.distance * 9)) : 0.75
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
      <mesh position={[0, 0, -D / 2 - 0.002]} scale={[W * 1.9, H * 3.2, 1]}>
        <planeGeometry />
        <meshBasicMaterial ref={halo} map={texture} color={tint} transparent opacity={0.15} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={body}>
        <mesh geometry={geometry}>
          <meshStandardMaterial ref={skin} color="#171A21" emissive={tint} emissiveIntensity={0.16} roughness={0.35} metalness={0.2} />
        </mesh>
        <group position={[0, 0, D / 2 + 0.001]}>
          <Container pixelSize={0.002} pointerEvents="none">
            <Text fontSize={13} fontWeight="semi-bold" color="#EEF0F4">
              {label}
            </Text>
          </Container>
        </group>
      </group>
      {/* Static hit box: the body sinks on press, the hit surface must not, or a poke would re-trigger. */}
      <mesh
        visible={false}
        position={[0, 0, 0.002]}
        onPointerOver={near}
        onPointerMove={near}
        onPointerOut={() => {
          st.current.target = 0.15
          up()
        }}
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={() => {
          st.current.flash = 1.4
          onPress?.()
        }}
      >
        <boxGeometry args={[W, H, D + 0.004]} />
      </mesh>
    </group>
  )
}
