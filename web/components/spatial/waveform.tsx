"use client"

import { useEffect, useMemo, useRef } from "react"
import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, type MeshBasicMaterial } from "three"
import { useFrame } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
import * as Tone from "tone"

const SURFACE = "#15171E"
const STAGE = "#0D0F14"
const BORDER = "#242833"
const BORDER2 = "#323745"
const FAINT = "#6B7180"
const ACCENT = "#9FE7D2"

const W = 0.4 // screen, metres
const H = 0.12
const FRONT = 0.005
const SIZE = 2048 // analyser buffer (samples)
const WINDOW = 1024 // samples shown (~23 ms at 44.1 kHz)
const N = 256 // points drawn
const GAIN = 1.6 // a full mix rarely passes ±0.5, so lift it to fill the screen
const AMP = H / 2 - 0.008
const XS = Array.from({ length: N }, (_, i) => -W / 2 + 0.006 + (i / (N - 1)) * (W - 0.012))

function ribbon() {
  const g = new BufferGeometry()
  const pos = new Float32Array(N * 2 * 3)
  XS.forEach((x, i) => (pos[i * 6] = pos[i * 6 + 3] = x))
  g.setAttribute("position", new BufferAttribute(pos, 3))
  const idx: number[] = []
  for (let i = 0; i < N - 1; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2)
  g.setIndex(idx)
  return g
}

type Props = { color?: string; label?: string }

/** 40 × 12 cm oscilloscope of everything going to the speakers (Tone.getDestination), drawn as a glowing line. */
export default function Waveform({ color = ACCENT, label = "Output" }: Props) {
  const analyser = useRef<Tone.Waveform | null>(null)
  const dot = useRef<MeshBasicMaterial>(null)
  const ys = useMemo(() => new Float32Array(N), [])
  const plate = useMemo(() => new RoundedBoxGeometry(W + 0.02, H + 0.02, 0.01, 4, 0.008), [])
  const core = useMemo(ribbon, [])
  const glow = useMemo(ribbon, [])
  useEffect(() => () => (plate.dispose(), core.dispose(), glow.dispose()), [plate, core, glow])

  useEffect(() => {
    const w = new Tone.Waveform(SIZE)
    const out = Tone.getDestination()
    out.connect(w)
    analyser.current = w
    return () => {
      out.disconnect(w)
      w.dispose()
      analyser.current = null
    }
  }, [])

  useFrame(() => {
    const w = analyser.current
    if (!w) return
    const data = w.getValue()
    // Trigger on the first rising zero crossing so periodic sounds stand still, like a real scope.
    let start = 0
    for (let i = 1; i < SIZE - WINDOW; i++)
      if (data[i - 1] < 0 && data[i] >= 0) {
        start = i
        break
      }
    let peak = 0
    const step = WINDOW / N
    for (let i = 0; i < N; i++) {
      const s = data[start + Math.floor(i * step)] ?? 0
      peak = Math.max(peak, Math.abs(s))
      ys[i] = Math.max(-1, Math.min(1, s * GAIN)) * AMP
    }
    const dx = XS[1] - XS[0]
    const a = core.attributes.position as BufferAttribute
    const b = glow.attributes.position as BufferAttribute
    for (let i = 0; i < N; i++) {
      // Offset along the line's normal so the stroke keeps its width on steep slopes.
      const dy = ys[Math.min(N - 1, i + 1)] - ys[Math.max(0, i - 1)]
      const len = Math.hypot(2 * dx, dy)
      const nx = -dy / len
      const ny = (2 * dx) / len
      const x = XS[i]
      const y = ys[i]
      a.setXYZ(2 * i, x - nx * 0.001, y - ny * 0.001, 0)
      a.setXYZ(2 * i + 1, x + nx * 0.001, y + ny * 0.001, 0)
      b.setXYZ(2 * i, x - nx * 0.0035, y - ny * 0.0035, 0)
      b.setXYZ(2 * i + 1, x + nx * 0.0035, y + ny * 0.0035, 0)
    }
    a.needsUpdate = true
    b.needsUpdate = true
    dot.current?.color.set(peak > 0.01 ? color : BORDER2)
  })

  return (
    <group>
      <mesh geometry={plate}>
        <meshStandardMaterial color={SURFACE} roughness={0.75} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0, FRONT + 0.0004]}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial color={STAGE} roughness={0.9} />
      </mesh>
      {[-0.5, 0, 0.5].map((k) => (
        <mesh key={k} position={[0, k * AMP, FRONT + 0.0008]}>
          <planeGeometry args={[W, k ? 0.0006 : 0.001]} />
          <meshBasicMaterial color={BORDER} />
        </mesh>
      ))}
      <mesh geometry={glow} position={[0, 0, FRONT + 0.0012]} frustumCulled={false}>
        <meshBasicMaterial color={color} transparent opacity={0.22} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} />
      </mesh>
      <mesh geometry={core} position={[0, 0, FRONT + 0.0016]} frustumCulled={false}>
        <meshBasicMaterial color={color} side={DoubleSide} />
      </mesh>
      <mesh position={[W / 2 - 0.012, H / 2 - 0.012, FRONT + 0.0012]}>
        <circleGeometry args={[0.003, 20]} />
        <meshBasicMaterial ref={dot} color={BORDER2} />
      </mesh>
      <group position={[-W / 2 + 0.008, H / 2 - 0.006, FRONT + 0.0012]}>
        <Container pixelSize={0.002} anchorX="left" anchorY="top" pointerEvents="none">
          <Text fontSize={11} color={FAINT}>
            {label.toUpperCase()}
          </Text>
        </Container>
      </group>
    </group>
  )
}
