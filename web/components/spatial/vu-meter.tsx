"use client"

import { useEffect, useRef } from "react"
import type { MeshBasicMaterial } from "three"
import { useFrame } from "@react-three/fiber"
import * as Tone from "tone"

const N = 12
const SEG = 0.009 // segment height, metres
const GAP = 0.003
const OFF = "#2C2D28"
const COLORS = Array.from({ length: N }, (_, i) => (i < 8 ? "#1FB54A" : i < 10 ? "#E8B428" : "#E5483A"))

type Props = { value?: number }

/** 12-segment level meter of everything going to the speakers. `value` (0–1) overrides the live level. */
export default function VuMeter({ value }: Props) {
  const meter = useRef<Tone.Meter | null>(null)
  const mats = useRef<(MeshBasicMaterial | null)[]>([])
  const lit = useRef(0)

  useEffect(() => {
    const m = new Tone.Meter({ normalRange: true, smoothing: 0.8 })
    const out = Tone.getDestination()
    out.connect(m)
    meter.current = m
    return () => {
      out.disconnect(m)
      m.dispose()
      meter.current = null
    }
  }, [])

  useFrame(() => {
    let v = value
    if (v === undefined && meter.current) {
      const g = meter.current.getValue()
      // Map -48…0 dB to 0…1: raw RMS of a full mix rarely passes 0.3, so a linear scale barely moves.
      v = (Tone.gainToDb(Array.isArray(g) ? Math.max(...g) : g) + 48) / 48
    }
    const n = Number.isFinite(v) ? Math.round(Math.min(1, Math.max(0, v!)) * N) : 0
    if (n === lit.current) return
    lit.current = n
    mats.current.forEach((mat, i) => mat?.color.set(i < n ? COLORS[i] : OFF))
  })

  const height = N * (SEG + GAP) + 0.012
  return (
    <group>
      <mesh position={[0, 0, -0.004]}>
        <boxGeometry args={[0.04, height, 0.006]} />
        <meshStandardMaterial color="#1A1B18" roughness={0.8} />
      </mesh>
      {COLORS.map((_, i) => (
        <mesh key={i} position={[0, -height / 2 + 0.006 + GAP / 2 + SEG / 2 + i * (SEG + GAP), 0]}>
          <boxGeometry args={[0.028, SEG, 0.002]} />
          <meshBasicMaterial
            ref={(m) => {
              mats.current[i] = m
            }}
            color={OFF}
          />
        </mesh>
      ))}
    </group>
  )
}
