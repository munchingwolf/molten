"use client"

import { useEffect, useMemo, useRef } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { CanvasTexture, Color, type Group, type MeshStandardMaterial } from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

type Props = { label?: string; color?: string; strength?: number; size?: number; onPress?: () => void }

const W = 0.16
const H = 0.056
const D = 0.018
const FIELD = 0.02 // hit margin around the face; fingertips also pull from up to 10 cm away (touch hover radius)

function shadowTexture() {
  const c = document.createElement("canvas")
  c.width = 256
  c.height = 128
  const g = c.getContext("2d")!
  g.shadowColor = "black"
  g.shadowBlur = 28
  g.fillStyle = "black"
  g.beginPath()
  g.roundRect(48, 40, 160, 48, 22)
  g.fill()
  return new CanvasTexture(c)
}

/** 16 x 5.6 cm button that leans, slides and lifts toward your fingertip or ray, then springs back when you leave. */
export default function MagneticButton({ label = "Magnetic", color = "#9FE7D2", strength = 1, size = 1, onPress }: Props) {
  const body = useRef<Group>(null)
  const skin = useRef<MeshStandardMaterial>(null)
  const root = useRef<Group>(null)
  // Spring channels: x, y, z offset and x/y tilt. `to` = targets, `v` = velocities.
  const st = useRef({ p: [0, 0, 0, 0, 0], v: [0, 0, 0, 0, 0], to: [0, 0, 0, 0, 0], down: false, glow: 0 })
  const plate = useMemo(() => new RoundedBoxGeometry(W, H, D, 4, 0.014), [])
  const shadow = useMemo(() => (typeof document === "undefined" ? null : shadowTexture()), [])
  const accent = useMemo(() => new Color(color), [color])
  useEffect(() => () => (plate.dispose(), shadow?.dispose()), [plate, shadow])

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    for (let i = 0; i < 5; i++) {
      const to = i === 2 && s.down ? -0.006 : s.to[i]
      s.v[i] += (260 * (to - s.p[i]) - 16 * s.v[i]) * dt // loose spring: visible wobble on release
      s.p[i] += s.v[i] * dt
    }
    const g = body.current
    if (g) {
      g.position.set(s.p[0], s.p[1], s.p[2])
      g.rotation.set(s.p[3], s.p[4], 0)
    }
    const lit = Math.min(1, Math.abs(s.p[2]) * 160 + Math.hypot(s.p[0], s.p[1]) * 40)
    s.glow += (lit - s.glow) * (1 - Math.exp(-dt * 10))
    if (skin.current) skin.current.emissiveIntensity = 0.06 + s.glow * 0.3
  })

  const pull = (e: ThreeEvent<PointerEvent>) => {
    if (!root.current) return
    const p = root.current.worldToLocal(e.point.clone())
    const k = Math.max(0, Math.min(2, strength))
    const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v))
    st.current.to = [clamp(p.x * 0.18, 0.014) * k, clamp(p.y * 0.22, 0.01) * k, 0.006 * k, clamp(-p.y * 5, 0.3) * k, clamp(p.x * 3, 0.35) * k]
  }
  const release = () => {
    st.current.to = [0, 0, 0, 0, 0]
    st.current.down = false
  }
  const down = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    st.current.down = true
  }

  return (
    <group scale={size}>
      <group ref={root}>
        <mesh position={[0, -0.004, -D / 2 - 0.006]} scale={[W * 1.6, H * 2.2, 1]}>
          <planeGeometry />
          <meshBasicMaterial map={shadow} color="black" transparent opacity={0.55} depthWrite={false} />
        </mesh>
        <group ref={body}>
          <mesh geometry={plate}>
            <meshStandardMaterial ref={skin} color="#20242E" emissive={accent} emissiveIntensity={0.06} roughness={0.4} metalness={0.25} />
          </mesh>
          <mesh position={[0, -H / 2 + 0.008, D / 2 + 0.0005]}>
            <planeGeometry args={[W * 0.4, 0.002]} />
            <meshBasicMaterial color={accent} toneMapped={false} />
          </mesh>
          <group position={[0, 0.002, D / 2 + 0.001]}>
            <Container pixelSize={0.002} pointerEvents="none">
              <Text fontSize={13} fontWeight="semi-bold" color="#EEF0F4">
                {label}
              </Text>
            </Container>
          </group>
        </group>
        {/* Flush with the face: a fingertip "presses" within 3 cm of this box, so it must not stick out further. */}
        <mesh
          visible={false}
          position={[0, 0, 0.002]}
          onPointerOver={pull}
          onPointerMove={pull}
          onPointerOut={release}
          onPointerDown={down}
          onPointerUp={() => (st.current.down = false)}
          onPointerCancel={release}
          onClick={() => onPress?.()}
        >
          <boxGeometry args={[W + FIELD, H + FIELD, D + 0.004]} />
        </mesh>
      </group>
    </group>
  )
}
