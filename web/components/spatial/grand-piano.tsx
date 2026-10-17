"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import * as Tone from "tone"
import type { Group } from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
import { Container, Text } from "@react-three/uikit"

type Props = {
  /** Hold notes after release, like the right pedal. */
  sustain?: boolean
  volume?: number
  /** Where the piano samples live (Salamander Grand Piano, CC-BY 3.0, Alexander Holm; Tone.js CDN by default). */
  baseUrl?: string
  /** Tilt of the keybed toward the player, in radians (0 = flat like a real piano). */
  tilt?: number
  onPress?: (note: string) => void
}

// Real key sizes, so fingers play it in a headset: 23.5 mm white pitch, 150 mm keys.
const PITCH = 0.0235
const WHITE_W = 0.0222
const WHITE_L = 0.15
const WHITE_H = 0.022
const BLACK_W = 0.0135
const BLACK_L = 0.095
const BLACK_H = 0.012
const DIP = 0.065 // rad: how far a key pivots down at the back hinge

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"]
const WHITES = [3, 4].flatMap((o) => LETTERS.map((l) => `${l}${o}`)).concat("C5")
const BLACKS = WHITES.slice(0, -1).flatMap((n, i) => ("CDFGA".includes(n[0]) ? [{ note: `${n[0]}#${n.slice(1)}`, i }] : []))
const ALL = [...WHITES, ...BLACKS.map((b) => b.note)]
const SAMPLES = Object.fromEntries(
  [3, 4, 5].flatMap((o) => [["C", "C"], ["D#", "Ds"], ["F#", "Fs"], ["A", "A"]].map(([n, f]) => [`${n}${o}`, `${f}${o}.mp3`])),
)

const PC: Record<string, number> = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 }
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const SHAPES: [number[], string][] = [
  [[0, 4, 7, 11], "maj7"], [[0, 4, 7, 10], "7"], [[0, 3, 7, 10], "m7"],
  [[0, 4, 7], "major"], [[0, 3, 7], "minor"], [[0, 3, 6], "dim"], [[0, 4, 8], "aug"], [[0, 5, 7], "sus4"], [[0, 2, 7], "sus2"],
]
/** Name the chord the held notes make (any inversion), else list them. */
function chordName(notes: string[]) {
  if (!notes.length) return ""
  const pcs = [...new Set(notes.map((n) => PC[n.slice(0, -1)]))].sort((a, b) => a - b)
  if (pcs.length >= 3)
    for (const root of pcs)
      for (const [shape, name] of SHAPES) {
        const rel = pcs.map((p) => (p - root + 12) % 12).sort((a, b) => a - b)
        if (rel.length === shape.length && rel.every((v, k) => v === shape[k])) return `${NAMES[root]} ${name}`
      }
  return notes.join("  ")
}

let lacquer: RoundedBoxGeometry | undefined
/**
 * Playable two-octave piano (C3–C5) with real sampled grand-piano sound. Poke or click keys; chords work (one pointer per
 * finger). Strike near the front edge to play louder. Keys pivot on a hinge and spring back; the fallboard names your chord.
 */
export default function GrandPiano({ sustain, volume = 0.8, baseUrl = "https://tonejs.github.io/audio/salamander/", tilt = 0.24, onPress }: Props) {
  const [localSustain, setLocalSustain] = useState(false)
  const pedal = sustain ?? localSustain
  const [held, setHeld] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const voice = useRef<{ sampler?: Tone.Sampler; synth?: Tone.PolySynth; out?: Tone.Volume }>({})
  const lingering = useRef(new Set<string>()) // released while the pedal is down
  const keys = useRef(new Map<string, { group: Group | null; angle: number; vel: number; down: boolean }>())
  const body = useMemo(() => (lacquer ??= new RoundedBoxGeometry(WHITES.length * PITCH + 0.05, 0.05, WHITE_L + 0.06, 4, 0.01)), [])

  useEffect(() => {
    const out = new Tone.Volume(Tone.gainToDb(volume)).toDestination()
    const room = new Tone.Reverb({ decay: 2.4, wet: 0.16 }).connect(out)
    // Plays at once while the samples load, so the first touch is never silent.
    const synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "triangle" }, envelope: { attack: 0.004, decay: 0.4, sustain: 0.2, release: 0.9 }, volume: -10 }).connect(room)
    const sampler = new Tone.Sampler({ urls: SAMPLES, baseUrl, release: 1.1, onload: () => setReady(true) }).connect(room)
    voice.current = { sampler, synth, out }
    return () => {
      sampler.dispose()
      synth.dispose()
      room.dispose()
      out.dispose()
      voice.current = {}
    }
  }, [baseUrl])

  useEffect(() => {
    voice.current.out?.volume.rampTo(Tone.gainToDb(Math.max(0.0001, volume)), 0.05)
  }, [volume])

  useEffect(() => {
    if (pedal) return
    const v = voice.current
    for (const n of lingering.current) (ready ? v.sampler : v.synth)?.triggerRelease(n, Tone.now())
    lingering.current.clear()
  }, [pedal, ready])

  const slot = (note: string) => {
    let k = keys.current.get(note)
    if (!k) keys.current.set(note, (k = { group: null, angle: 0, vel: 0, down: false }))
    return k
  }

  const press = (note: string, e: ThreeEvent<PointerEvent>, length: number) => {
    void Tone.start() // audio stays locked until a user gesture
    const k = slot(note)
    if (k.down) return
    k.down = true
    const local = k.group ? k.group.worldToLocal(e.point.clone()).z / length : 0.7 // 0 at the hinge, 1 at the front edge
    const velocity = Math.min(1, Math.max(0.35, 0.45 + 0.55 * local))
    lingering.current.delete(note)
    const v = voice.current
    ;(ready ? v.sampler : v.synth)?.triggerAttack(note, Tone.now(), velocity)
    setHeld((h) => [...h.filter((x) => x !== note), note])
    onPress?.(note)
  }
  const release = (note: string) => {
    const k = slot(note)
    if (!k.down) return
    k.down = false
    setHeld((h) => h.filter((x) => x !== note))
    if (pedal) return void lingering.current.add(note)
    const v = voice.current
    ;(ready ? v.sampler : v.synth)?.triggerRelease(note, Tone.now())
  }

  // One spring per key: snappy down, a tiny bounce on the way back up.
  useFrame((state, dt) => {
    const h = Math.min(dt, 1 / 30)
    let moving = false
    for (const k of keys.current.values()) {
      const target = k.down ? DIP : 0
      k.vel += ((target - k.angle) * 900 - k.vel * 38) * h
      k.angle += k.vel * h
      if (k.group) k.group.rotation.x = k.angle
      if (Math.abs(target - k.angle) + Math.abs(k.vel) > 1e-4) moving = true
    }
    if (moving) state.invalidate()
  })

  const x0 = -((WHITES.length - 1) * PITCH) / 2
  const chord = chordName([...held].sort((a, b) => ALL.indexOf(a) - ALL.indexOf(b)))

  return (
    <group rotation={[tilt, 0, 0]}>
      {/* Lacquered case under the keys, cheek blocks at the ends, red felt strip at the back. */}
      <mesh geometry={body} position={[0, -0.03, -0.005]}>
        <meshPhysicalMaterial color="#17151B" roughness={0.16} clearcoat={1} clearcoatRoughness={0.06} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (WHITES.length * PITCH / 2 + 0.014), 0.004, 0.004]}>
          <boxGeometry args={[0.026, 0.05, WHITE_L + 0.03]} />
          <meshPhysicalMaterial color="#17151B" roughness={0.16} clearcoat={1} clearcoatRoughness={0.06} />
        </mesh>
      ))}
      {/* Brushed brass trim along the front of the keybed. */}
      <mesh position={[0, -0.006, WHITE_L / 2 + 0.024]}>
        <boxGeometry args={[WHITES.length * PITCH + 0.05, 0.004, 0.003]} />
        <meshStandardMaterial color="#C9A86A" metalness={0.9} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.006, -WHITE_L / 2 - 0.006]}>
        <boxGeometry args={[WHITES.length * PITCH, 0.008, 0.012]} />
        <meshStandardMaterial color="#7A1520" roughness={0.95} />
      </mesh>
      {/* Fallboard with the chord display and the sustain pedal switch. */}
      <group position={[0, 0.06, -WHITE_L / 2 - 0.03]} rotation={[-0.12, 0, 0]}>
        <mesh position={[0, 0, -0.008]}>
          <boxGeometry args={[WHITES.length * PITCH + 0.05, 0.1, 0.012]} />
          <meshPhysicalMaterial color="#17151B" roughness={0.16} clearcoat={1} clearcoatRoughness={0.06} />
        </mesh>
        <Container pixelSize={0.0006} width={560} height={130} flexDirection="row" alignItems="center" justifyContent="space-between" paddingX={30}>
          <Container flexDirection="column" gap={4}>
            <Text fontSize={20} color="#8A8F9C" fontWeight="medium">{ready ? "Grand piano" : "Loading piano…"}</Text>
            <Text fontSize={44} fontWeight="bold" color={held.length ? "#F4F1EA" : "#4A4E58"}>{chord || "Play a chord"}</Text>
          </Container>
          <Container
            paddingX={22}
            height={56}
            borderRadius={28}
            alignItems="center"
            backgroundColor={pedal ? "#9FE7D2" : "#1D1F25"}
            borderWidth={2}
            borderColor={pedal ? "#9FE7D2" : "#3A3E48"}
            cursor="pointer"
            onClick={() => setLocalSustain((s) => !s)}
          >
            <Text fontSize={22} fontWeight="semi-bold" color={pedal ? "#06221B" : "#C9CDD6"}>{pedal ? "Sustain on" : "Sustain"}</Text>
          </Container>
        </Container>
      </group>
      {WHITES.map((note, i) => (
        <Key key={note} note={note} x={x0 + i * PITCH} black={false} middleC={note === "C4"} hook={slot(note)} onDown={press} onUp={release} />
      ))}
      {BLACKS.map(({ note, i }) => (
        <Key key={note} note={note} x={x0 + (i + 0.5) * PITCH} black hook={slot(note)} onDown={press} onUp={release} />
      ))}
    </group>
  )
}

function Key({ note, x, black, middleC, hook, onDown, onUp }: {
  note: string; x: number; black: boolean; middleC?: boolean
  hook: { group: Group | null }
  onDown: (note: string, e: ThreeEvent<PointerEvent>, length: number) => void
  onUp: (note: string) => void
}) {
  const [hover, setHover] = useState(false)
  const L = black ? BLACK_L : WHITE_L
  const W = black ? BLACK_W : WHITE_W
  const H = black ? BLACK_H : WHITE_H
  const y = black ? WHITE_H / 2 + BLACK_H / 2 - 0.002 : 0
  // Pivot at the back edge; the key extends toward the player (+z).
  return (
    <group position={[x, y, -WHITE_L / 2]} ref={(g) => void (hook.group = g)}>
      <mesh
        position={[0, 0, L / 2]}
        onPointerDown={(e) => onDown(note, e, L)}
        onPointerUp={() => onUp(note)}
        onPointerCancel={() => onUp(note)}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => (setHover(false), onUp(note))}
      >
        <boxGeometry args={[W, H, L]} />
        {black ? (
          <meshPhysicalMaterial color={hover ? "#33363F" : "#0E0F12"} roughness={0.2} clearcoat={1} clearcoatRoughness={0.1} />
        ) : (
          <meshPhysicalMaterial color={hover ? "#FFFFFF" : "#F3F0E8"} roughness={0.32} clearcoat={0.6} clearcoatRoughness={0.2} />
        )}
      </mesh>
      {middleC && (
        <mesh position={[0, H / 2 + 0.0004, L - 0.012]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.0028, 16]} />
          <meshBasicMaterial color="#9FE7D2" />
        </mesh>
      )}
    </group>
  )
}
