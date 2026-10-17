"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { MeshBasicMaterial, MeshStandardMaterial } from "three"
import { useFrame } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
import * as Tone from "tone"

type Pattern = "up" | "down" | "updown" | "random"
type Rate = "8n" | "16n" | "32n"
type Wave = "sine" | "triangle" | "square" | "sawtooth"

// Diatonic chords of C major / A minor, as MIDI notes.
const CHORDS: { name: string; notes: number[] }[] = [
  { name: "Am", notes: [57, 60, 64] },
  { name: "C", notes: [60, 64, 67] },
  { name: "Dm", notes: [62, 65, 69] },
  { name: "Em", notes: [64, 67, 71] },
  { name: "F", notes: [65, 69, 72] },
  { name: "G", notes: [67, 71, 74] },
]
const P = 0.07 // pad size
const GAP = 0.012
const MAX_STEPS = 3 * 3 * 2 // chord tones × max octaves × up-down

type Props = {
  /** Selected chord 0–5 (Am C Dm Em F G), -1 = stopped. Controlled, or uncontrolled. */
  value?: number
  onChange?: (chord: number) => void
  pattern?: Pattern
  /** Octaves the arpeggio spans, 1–3 */
  octaves?: number
  rate?: Rate
  wave?: Wave
  label?: string
}

function sequence(notes: number[], pattern: Pattern, octaves: number) {
  const up: number[] = []
  for (let o = 0; o < octaves; o++) for (const n of notes) up.push(n + 12 * o)
  if (pattern === "down") return up.reverse()
  if (pattern === "updown") return up.length > 2 ? [...up, ...up.slice(1, -1).reverse()] : up
  return up
}

/** 26 cm arpeggiator: poke one of six chord pads and an arpeggio plays on the shared transport; poke it again to stop. */
export default function Arpeggiator({ value, onChange, pattern = "up", octaves = 2, rate = "16n", wave = "triangle", label = "Arp" }: Props) {
  const [inner, setInner] = useState(-1)
  const chord = Math.round(value ?? inner)
  const oct = Math.max(1, Math.min(3, Math.round(octaves)))
  const seq = chord >= 0 && chord < CHORDS.length ? sequence(CHORDS[chord].notes, pattern, oct) : []
  const live = useRef({ seq, pattern })
  live.current = { seq, pattern }
  const synth = useRef<Tone.Synth | null>(null)
  const lit = useRef(-1) // index of the note sounding now, for the lights
  const step = useRef(0)
  const dots = useRef<(MeshBasicMaterial | null)[]>([])
  const skins = useRef<(MeshStandardMaterial | null)[]>([])
  const [hover, setHover] = useState(-1)
  const padGeo = useMemo(() => new RoundedBoxGeometry(P, P, 0.014, 4, 0.008), [])
  useEffect(() => () => padGeo.dispose(), [padGeo])

  useEffect(() => {
    const delay = new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.25, wet: 0.2 }).toDestination()
    const s = new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.003, decay: 0.15, sustain: 0.1, release: 0.15 }, volume: -12 }).connect(delay)
    synth.current = s
    return () => {
      s.dispose()
      delay.dispose()
      synth.current = null
    }
  }, [])

  useEffect(() => void synth.current?.set({ oscillator: { type: wave } }), [wave])

  useEffect(() => {
    const t = Tone.getTransport()
    const id = t.scheduleRepeat((time) => {
      const { seq, pattern } = live.current
      if (!seq.length || !synth.current) return void (lit.current = -1)
      const i = pattern === "random" ? Math.floor(Math.random() * seq.length) : step.current++ % seq.length
      synth.current.triggerAttackRelease(Tone.Frequency(seq[i], "midi").toFrequency(), rate, time)
      Tone.getDraw().schedule(() => (lit.current = i), time)
    }, rate)
    return () => void t.clear(id)
  }, [rate])

  useFrame(({ clock }) => {
    const pulse = 0.35 + 0.25 * Math.sin(clock.elapsedTime * 6)
    skins.current.forEach((m, i) => m && (m.emissiveIntensity = i === chord ? pulse : 0))
    dots.current.forEach((m, i) => m?.color.set(i >= seq.length ? "#15171E" : i === lit.current ? "#7FE3FF" : "#323745"))
  })

  const pick = async (i: number) => {
    const next = i === chord ? -1 : i
    step.current = 0
    if (value === undefined) setInner(next)
    onChange?.(next)
    await Tone.start() // browsers stay silent until a user gesture resumes audio
    if (next >= 0 && Tone.getTransport().state !== "started") Tone.getTransport().start()
  }

  const w = 3 * P + 2 * GAP
  return (
    <group>
      <mesh position={[0, -0.006, -0.008]}>
        <boxGeometry args={[w + 0.04, 2 * P + GAP + 0.08, 0.012]} />
        <meshStandardMaterial color="#15171E" roughness={0.7} metalness={0.1} />
      </mesh>
      <group position={[-w / 2, P + GAP / 2 + 0.012, 0]}>
        <Container pixelSize={0.002} anchorX="left" flexDirection="row" gap={8} alignItems="center" pointerEvents="none">
          <Text fontSize={14} fontWeight="semi-bold" color="#EEF0F4">
            {label}
          </Text>
          <Text fontSize={10} color="#9AA0AD">
            {chord >= 0 ? `${CHORDS[chord].name} · ${pattern} · ${oct} oct` : "Poke a chord"}
          </Text>
        </Container>
      </group>
      {Array.from({ length: MAX_STEPS }, (_, i) => (
        <mesh key={i} position={[w / 2 - (MAX_STEPS - 1 - i) * 0.006 - 0.003, P + GAP / 2 + 0.012, 0]}>
          <circleGeometry args={[0.0024, 12]} />
          <meshBasicMaterial ref={(m) => void (dots.current[i] = m)} color="#15171E" />
        </mesh>
      ))}
      {CHORDS.map((c, i) => {
        const x = -w / 2 + P / 2 + (i % 3) * (P + GAP)
        const y = (P + GAP) / 2 - Math.floor(i / 3) * (P + GAP)
        return (
          <group key={c.name} position={[x, y, 0]}>
            <mesh geometry={padGeo} position={[0, 0, hover === i ? -0.002 : 0]}>
              <meshStandardMaterial
                ref={(m) => void (skins.current[i] = m)}
                color={i === chord ? "#9FE7D2" : hover === i ? "#323745" : "#242833"}
                emissive="#9FE7D2"
                emissiveIntensity={0}
                roughness={0.5}
              />
            </mesh>
            <group position={[0, 0, 0.008]}>
              <Container pixelSize={0.002} pointerEvents="none">
                <Text fontSize={16} fontWeight="bold" color={i === chord ? "#06221B" : "#EEF0F4"}>
                  {c.name}
                </Text>
              </Container>
            </group>
            {/* Static hit box in front of the pad, so a poke doesn't re-trigger as the pad moves. */}
            <mesh
              visible={false}
              position={[0, 0, 0.006]}
              onPointerDown={() => pick(i)}
              onPointerOver={() => setHover(i)}
              onPointerOut={() => setHover((h) => (h === i ? -1 : h))}
            >
              <boxGeometry args={[P, P, 0.014]} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
