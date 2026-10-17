"use client"

import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import type { BufferGeometry, Group } from "three"
import type { ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
import * as Tone from "tone"

const BG = "#0B0C10"
const SURFACE = "#15171E"
const BORDER = "#242833"
const BORDER2 = "#323745"
const RAISED = "#3A4050"
const TEXT = "#EEF0F4"
const MUTED = "#9AA0AD"
const FAINT = "#6B7180"
const ACCENT = "#9FE7D2"

const W = 0.36 // plate, metres
const H = 0.2
const FRONT = 0.006
const PAD = [0.036, 0.06, 0.012] as const
const PAD_GAP = 0.006
const PAD_Y = -0.045
const KNOB_R = 0.02
const KNOB_Y = 0.05
const SWEEP = 1.5 * Math.PI
const NOTES = ["A2", "C3", "D3", "E3", "G3", "A3", "C4", "D4"] // A minor pentatonic: any order sounds right

type Wave = "sawtooth" | "square" | "triangle" | "sine"
type Props = {
  cutoff?: number
  onCutoffChange?: (v: number) => void
  resonance?: number
  onResonanceChange?: (v: number) => void
  wave?: Wave
  notes?: string[]
  onPress?: (note: string) => void
  volume?: number
  pan?: number
  mute?: boolean
  label?: string
  color?: string
}

/** 0-1 knob value -> filter cutoff in Hz, exponential from 80 Hz to 12 kHz so the sweep sounds even. */
const toHz = (c: number) => 80 * Math.pow(150, c)
const toDb = (v: number) => 40 * Math.log10(Math.max(1e-4, v))
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

type DialProps = {
  x: number
  t: number
  label: string
  readout: string
  color: string
  space: RefObject<Group | null>
  onChange: (t: number) => void
}

/** Turnable dial: drag up/down (mouse, ray or fingertip). */
function Dial({ x, t, label, readout, color, space, onChange }: DialProps) {
  const [hover, setHover] = useState(false)
  const [active, setActive] = useState(false)
  const drag = useRef<{ id: number; y: number; t: number } | null>(null)
  const localY = (e: ThreeEvent<PointerEvent>) => (space.current ? space.current.worldToLocal(e.point.clone()).y : e.point.y)
  const a = 1.25 * Math.PI - t * SWEEP
  const lit = hover || active

  return (
    <group position={[x, KNOB_Y, FRONT]}>
      <mesh position={[0, 0, 0.0005]}>
        <ringGeometry args={[KNOB_R + 0.004, KNOB_R + 0.007, 48, 1, -0.25 * Math.PI, SWEEP]} />
        <meshBasicMaterial color={BORDER2} />
      </mesh>
      {t > 0.005 && (
        <mesh position={[0, 0, 0.0008]}>
          <ringGeometry args={[KNOB_R + 0.004, KNOB_R + 0.007, 48, 1, a, t * SWEEP]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
      <group rotation={[0, 0, a - Math.PI / 2]}>
        <mesh position={[0, 0, 0.008]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[KNOB_R, KNOB_R * 1.08, 0.016, 48]} />
          <meshStandardMaterial
            color={lit ? RAISED : BORDER2}
            metalness={0.35}
            roughness={0.4}
            emissive={color}
            emissiveIntensity={active ? 0.2 : 0}
          />
        </mesh>
        <mesh position={[0, KNOB_R * 0.6, 0.0165]}>
          <boxGeometry args={[0.003, KNOB_R * 0.7, 0.001]} />
          <meshBasicMaterial color={lit ? color : TEXT} />
        </mesh>
      </group>
      <mesh
        visible={false}
        position={[0, 0, 0.009]}
        onPointerDown={(e) => {
          ;(e.target as Element).setPointerCapture(e.pointerId)
          drag.current = { id: e.pointerId, y: localY(e), t }
          setActive(true)
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (d?.id === e.pointerId) onChange(clamp01(d.t + (localY(e) - d.y) / 0.15)) // 15 cm of drag = full sweep
        }}
        onPointerUp={(e) => {
          if (drag.current?.id !== e.pointerId) return
          drag.current = null
          setActive(false)
        }}
        onPointerCancel={() => {
          drag.current = null
          setActive(false)
        }}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <boxGeometry args={[2 * KNOB_R + 0.018, 2 * KNOB_R + 0.018, 0.018]} />
      </mesh>
      <group position={[0, -KNOB_R - 0.022, 0.001]}>
        <Container pixelSize={0.002} flexDirection="column" alignItems="center" pointerEvents="none">
          <Text fontSize={10} color={FAINT}>
            {label}
          </Text>
          <Text fontSize={12} fontWeight="bold" color={lit ? color : TEXT}>
            {readout}
          </Text>
        </Container>
      </group>
    </group>
  )
}

type PadProps = { note: string; x: number; color: string; geometry: BufferGeometry; onDown: (n: string) => void; onUp: (n: string) => void }

function Pad({ note, x, color, geometry, onDown, onUp }: PadProps) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const release = () => {
    setDown(false)
    onUp(note)
  }
  return (
    <group position={[x, PAD_Y, FRONT + PAD[2] / 2]}>
      <group position={[0, 0, down ? -0.004 : 0]}>
        <mesh geometry={geometry}>
          <meshStandardMaterial
            color={down ? color : hover ? BORDER2 : BORDER}
            roughness={0.55}
            emissive={color}
            emissiveIntensity={down ? 0.6 : hover ? 0.06 : 0}
          />
        </mesh>
        <group position={[0, -PAD[1] / 2 + 0.012, PAD[2] / 2 + 0.0006]}>
          <Container pixelSize={0.002} pointerEvents="none">
            <Text fontSize={10} fontWeight="bold" color={down ? BG : MUTED}>
              {note}
            </Text>
          </Container>
        </group>
      </group>
      {/* Static hit box: the pad sinks on press, the hit surface must not, or a poke would re-trigger. */}
      <mesh
        visible={false}
        position={[0, 0, 0.002]}
        onPointerDown={() => {
          setDown(true)
          onDown(note)
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => {
          setHover(false)
          if (down) release()
        }}
      >
        <boxGeometry args={[PAD[0], PAD[1], PAD[2]]} />
      </mesh>
    </group>
  )
}

/**
 * 36 x 20 cm mono synth: 8 pokeable note pads, a lowpass filter with `cutoff` and `resonance` dials (0-1 each),
 * last-note priority with glide. Output runs through a channel with `volume` (0-1), `pan` (-1...1) and `mute`.
 */
export default function Synth({
  cutoff,
  onCutoffChange,
  resonance,
  onResonanceChange,
  wave = "sawtooth",
  notes = NOTES,
  onPress,
  volume = 0.8,
  pan = 0,
  mute = false,
  label = "Synth",
  color = ACCENT,
}: Props) {
  const [inner, setInner] = useState({ cutoff: 0.55, resonance: 0.3 })
  const root = useRef<Group>(null)
  const synth = useRef<Tone.Synth | null>(null)
  const filter = useRef<Tone.Filter | null>(null)
  const channel = useRef<Tone.Channel | null>(null)
  const held = useRef<string[]>([])
  const c = clamp01(cutoff ?? inner.cutoff)
  const r = clamp01(resonance ?? inner.resonance)
  const keys = notes.slice(0, 8)

  const padGeo = useMemo(() => new RoundedBoxGeometry(PAD[0], PAD[1], PAD[2], 4, 0.006), [])
  const plate = useMemo(() => new RoundedBoxGeometry(W, H, 0.012, 4, 0.012), [])
  useEffect(() => () => (padGeo.dispose(), plate.dispose()), [padGeo, plate])

  useEffect(() => {
    const ch = new Tone.Channel().toDestination()
    const f = new Tone.Filter({ type: "lowpass", rolloff: -24 }).connect(ch)
    const s = new Tone.Synth({
      portamento: 0.03,
      envelope: { attack: 0.005, decay: 0.25, sustain: 0.55, release: 0.35 },
      volume: -10,
    }).connect(f)
    ;[synth.current, filter.current, channel.current] = [s, f, ch]
    return () => {
      s.dispose()
      f.dispose()
      ch.dispose()
      held.current = []
      synth.current = filter.current = channel.current = null
    }
  }, [])

  useEffect(() => void filter.current?.frequency.rampTo(toHz(c), 0.04), [c])
  useEffect(() => void filter.current?.Q.rampTo(0.5 + r * 14, 0.04), [r])
  useEffect(() => {
    if (synth.current) synth.current.oscillator.type = wave
  }, [wave])
  useEffect(() => void channel.current?.volume.rampTo(toDb(clamp01(volume)), 0.05), [volume])
  useEffect(() => void channel.current?.pan.rampTo(Math.min(1, Math.max(-1, pan)), 0.05), [pan])
  useEffect(() => {
    if (channel.current) channel.current.mute = mute
  }, [mute])

  const setCutoff = (n: number) => {
    setInner((s) => ({ ...s, cutoff: n }))
    onCutoffChange?.(n)
  }
  const setRes = (n: number) => {
    setInner((s) => ({ ...s, resonance: n }))
    onResonanceChange?.(n)
  }

  const noteOn = (note: string) => {
    void Tone.start() // browsers stay silent until a user gesture resumes audio
    const s = synth.current
    if (!s) return
    held.current = [...held.current.filter((n) => n !== note), note]
    if (held.current.length > 1) s.setNote(note) // legato: glide, don't retrigger
    else s.triggerAttack(note, Tone.now())
    onPress?.(note)
  }
  const noteOff = (note: string) => {
    const s = synth.current
    if (!s || !held.current.includes(note)) return
    held.current = held.current.filter((n) => n !== note)
    const back = held.current[held.current.length - 1]
    if (back) s.setNote(back)
    else s.triggerRelease(Tone.now())
  }

  const hz = toHz(c)
  const x0 = -((keys.length - 1) * (PAD[0] + PAD_GAP)) / 2

  return (
    <group ref={root}>
      <mesh geometry={plate}>
        <meshStandardMaterial color={SURFACE} roughness={0.75} metalness={0.1} />
      </mesh>
      <group position={[-W / 2 + 0.016, KNOB_Y + 0.022, FRONT + 0.001]}>
        <Container pixelSize={0.002} anchorX="left" anchorY="top" flexDirection="column" gap={4} pointerEvents="none">
          <Text fontSize={18} fontWeight="bold" color={TEXT}>
            {label}
          </Text>
          <Text fontSize={10} color={FAINT}>
            {`${wave.toUpperCase()} - MONO - LP24`}
          </Text>
        </Container>
      </group>
      <Dial
        x={0.06}
        t={c}
        label="CUTOFF"
        readout={hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${Math.round(hz)}`}
        color={color}
        space={root}
        onChange={setCutoff}
      />
      <Dial x={0.135} t={r} label="RESO" readout={`${Math.round(r * 100)}`} color={color} space={root} onChange={setRes} />
      <mesh position={[0, PAD_Y, FRONT + 0.0004]}>
        <planeGeometry args={[W - 0.016, PAD[1] + 0.012]} />
        <meshBasicMaterial color={BG} />
      </mesh>
      {keys.map((note, i) => (
        <Pad key={`${note}${i}`} note={note} x={x0 + i * (PAD[0] + PAD_GAP)} color={color} geometry={padGeo} onDown={noteOn} onUp={noteOff} />
      ))}
    </group>
  )
}
