"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AdditiveBlending, CanvasTexture, type BufferGeometry, type MeshBasicMaterial, type MeshStandardMaterial, type Texture } from "three"
import { useFrame } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
import * as Tone from "tone"

const BG = "#0B0C10"
const SURFACE = "#15171E"
const BORDER = "#242833"
const BORDER2 = "#323745"
const TEXT = "#EEF0F4"
const MUTED = "#9AA0AD"
const FAINT = "#6B7180"
const ACCENT = "#9FE7D2"
const WARM = "#F2B48A"

const P = 0.064 // pad size, metres
const GAP = 0.012
const W = 4 * P + 3 * GAP + 0.04
const H = 2 * P + GAP + 0.08
const FRONT = 0.006
const GRID_Y = -0.016

type Voice = { play: (step: number, bar: number, time: number) => void; dispose: () => void }
type Clip = { name: string; drum: boolean; make: (out: Tone.ToneAudioNode) => Voice }

// Four-bar loop in A minor: Am | F | C | G.
const CHORDS = [
  ["A3", "C4", "E4"],
  ["F3", "A3", "C4"],
  ["C4", "E4", "G4"],
  ["G3", "B3", "D4"],
]
const ROOTS = ["A1", "F1", "C2", "G1"]
const up = (note: string, semis: number) => Tone.Frequency(note).transpose(semis).toNote()

function noise(out: Tone.ToneAudioNode, type: "highpass" | "bandpass", hz: number, decay: number, volume: number) {
  const f = new Tone.Filter({ frequency: hz, type, Q: type === "bandpass" ? 1.5 : 1 }).connect(out)
  const n = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay, sustain: 0 }, volume }).connect(f)
  return { n, dispose: () => (n.dispose(), f.dispose()) }
}

const CLIPS: Clip[] = [
  {
    name: "Kick",
    drum: true,
    make: (out) => {
      const s = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: 0.4, sustain: 0 }, volume: -6 }).connect(out)
      return { play: (st, _b, t) => void (st % 4 === 0 && s.triggerAttackRelease("C1", "8n", t)), dispose: () => s.dispose() }
    },
  },
  {
    name: "Hats",
    drum: true,
    make: (out) => {
      const h = noise(out, "highpass", 8000, 0.05, -16)
      return { play: (st, _b, t) => void (st % 2 === 0 && h.n.triggerAttackRelease(0.05, t, st % 4 === 2 ? 1 : 0.45)), dispose: h.dispose }
    },
  },
  {
    name: "Clap",
    drum: true,
    make: (out) => {
      const c = noise(out, "bandpass", 1500, 0.2, -8)
      return { play: (st, _b, t) => void ((st === 4 || st === 12) && c.n.triggerAttackRelease(0.2, t)), dispose: c.dispose }
    },
  },
  {
    name: "Perc",
    drum: true,
    make: (out) => {
      const s = new Tone.MembraneSynth({ pitchDecay: 0.008, octaves: 2, envelope: { attack: 0.001, decay: 0.08, sustain: 0 }, volume: -14 }).connect(out)
      return { play: (st, _b, t) => void ([3, 7, 10, 14].includes(st) && s.triggerAttackRelease(st === 10 ? "A3" : "D4", "32n", t)), dispose: () => s.dispose() }
    },
  },
  {
    name: "Bass",
    drum: false,
    make: (out) => {
      const s = new Tone.MonoSynth({
        oscillator: { type: "sawtooth" },
        filter: { Q: 2, type: "lowpass", rolloff: -24 },
        envelope: { attack: 0.005, decay: 0.2, sustain: 0.4, release: 0.15 },
        filterEnvelope: { attack: 0.002, decay: 0.15, sustain: 0.2, release: 0.2, baseFrequency: 120, octaves: 3 },
        volume: -12,
      }).connect(out)
      return {
        play: (st, b, t) => void ([0, 3, 6, 8, 11, 14].includes(st) && s.triggerAttackRelease(st === 6 || st === 14 ? up(ROOTS[b], 12) : ROOTS[b], "16n", t)),
        dispose: () => s.dispose(),
      }
    },
  },
  {
    name: "Pad",
    drum: false,
    make: (out) => {
      const f = new Tone.Filter(1400, "lowpass").connect(out)
      const s = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "fatsawtooth", count: 3, spread: 18 },
        envelope: { attack: 0.35, decay: 0.3, sustain: 0.6, release: 1.2 },
        volume: -22,
      }).connect(f)
      return { play: (st, b, t) => void (st === 0 && s.triggerAttackRelease(CHORDS[b], "1m", t)), dispose: () => (s.dispose(), f.dispose()) }
    },
  },
  {
    name: "Arp",
    drum: false,
    make: (out) => {
      const s = new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.05 }, volume: -14 }).connect(out)
      return { play: (st, b, t) => void (st % 2 === 0 && s.triggerAttackRelease(up(CHORDS[b][[0, 1, 2, 1][(st / 2) % 4]], 12), "16n", t)), dispose: () => s.dispose() }
    },
  },
  {
    name: "Lead",
    drum: false,
    make: (out) => {
      const s = new Tone.FMSynth({ harmonicity: 2, modulationIndex: 3, envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.4 }, volume: -18 }).connect(out)
      const motif: Record<number, number> = { 0: 2, 3: 1, 6: 0, 8: 1, 11: 2 } // step -> chord tone
      return { play: (st, b, t) => void (st in motif && s.triggerAttackRelease(up(CHORDS[b][motif[st]], 12), "8n", t)), dispose: () => s.dispose() }
    },
  },
]

const toDb = (v: number) => 40 * Math.log10(Math.max(1e-4, v))

// Soft rounded-square glow, drawn once and tinted by the material colour.
function glowTexture(): Texture | null {
  if (typeof document === "undefined") return null
  const c = document.createElement("canvas")
  c.width = c.height = 256
  const g = c.getContext("2d")!
  g.shadowColor = "white"
  g.shadowBlur = 40
  g.fillStyle = "white"
  g.beginPath()
  g.roundRect(64, 64, 128, 128, 24)
  g.fill()
  return new CanvasTexture(c)
}

type Props = {
  value?: boolean[]
  onChange?: (value: boolean[]) => void
  volume?: number
  pan?: number
  mute?: boolean
  label?: string
}

type PadProps = {
  i: number
  x: number
  y: number
  on: boolean
  playing: boolean
  geometry: BufferGeometry
  glow: Texture | null
  onToggle: (i: number) => void
  skin: (m: MeshStandardMaterial | null) => void
  halo: (m: MeshBasicMaterial | null) => void
}

function Pad({ i, x, y, on, playing, geometry, glow, onToggle, skin, halo }: PadProps) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const clip = CLIPS[i]
  const tint = clip.drum ? WARM : ACCENT
  return (
    <group position={[x, y, FRONT]}>
      <mesh position={[0, 0, 0.0005]}>
        <planeGeometry args={[P * 2, P * 2]} />
        <meshBasicMaterial ref={halo} map={glow} color={tint} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <group position={[0, 0, 0.007 - (down ? 0.005 : 0)]}>
        <mesh geometry={geometry}>
          <meshStandardMaterial
            ref={skin}
            color={playing ? tint : on ? BORDER2 : hover ? BORDER2 : BORDER}
            roughness={0.5}
            emissive={tint}
            emissiveIntensity={0}
          />
        </mesh>
        <group position={[0, -P / 2 + 0.013, 0.0076]}>
          <Container pixelSize={0.002} pointerEvents="none">
            <Text fontSize={12} fontWeight="bold" color={playing ? BG : on ? TEXT : MUTED}>
              {clip.name}
            </Text>
          </Container>
        </group>
      </group>
      {/* Static hit box: the pad sinks on press, the hit surface must not, or a poke would re-trigger. */}
      <mesh
        visible={false}
        position={[0, 0, 0.01]}
        onPointerDown={() => {
          setDown(true)
          onToggle(i)
        }}
        onPointerUp={() => setDown(false)}
        onPointerCancel={() => setDown(false)}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => {
          setHover(false)
          setDown(false)
        }}
      >
        <boxGeometry args={[P, P, 0.012]} />
      </mesh>
    </group>
  )
}

/**
 * 2 x 4 clip launcher on the global Tone transport: drums on top, bass/pad/arp/lead below, a four-bar loop in A minor.
 * Tap a pad to queue its loop; it starts (or stops) on the next bar and pulses with the beat while playing.
 * Starts the transport on the first tap. `value` = which clips are on (controlled), or uncontrolled.
 * Output runs through a channel with `volume` (0-1), `pan` (-1...1) and `mute`.
 */
export default function LoopPlayer({ value, onChange, volume = 0.8, pan = 0, mute = false, label = "Loops" }: Props) {
  const [inner, setInner] = useState<boolean[]>(() => CLIPS.map(() => false))
  const [playing, setPlaying] = useState<boolean[]>(() => CLIPS.map(() => false))
  const active = CLIPS.map((_, i) => !!(value ?? inner)[i])
  const latest = useRef(active)
  const applied = useRef(playing)
  const channel = useRef<Tone.Channel | null>(null)
  const skins = useRef<(MeshStandardMaterial | null)[]>([])
  const halos = useRef<(MeshBasicMaterial | null)[]>([])
  const dots = useRef<(MeshBasicMaterial | null)[]>([])

  const padGeo = useMemo(() => new RoundedBoxGeometry(P, P, 0.014, 4, 0.008), [])
  const plate = useMemo(() => new RoundedBoxGeometry(W, H, 0.012, 4, 0.012), [])
  const glow = useMemo(glowTexture, [])
  useEffect(() => () => (padGeo.dispose(), plate.dispose(), glow?.dispose()), [padGeo, plate, glow])

  useEffect(() => {
    latest.current = active
  })

  useEffect(() => {
    const ch = new Tone.Channel().toDestination()
    const voices = CLIPS.map((c) => c.make(ch))
    channel.current = ch
    const t = Tone.getTransport()
    const id = t.scheduleRepeat((time) => {
      // Position from the transport, so loops stay on the same grid as every other sequencer.
      const pos = Math.round(t.getTicksAtTime(time) / (t.PPQ / 4))
      const step = pos % 16
      if (step === 0) {
        // Launch quantisation: queued changes land on the bar line.
        const next = CLIPS.map((_, i) => !!latest.current[i])
        applied.current = next
        Tone.getDraw().schedule(() => setPlaying(next), time)
      }
      voices.forEach((v, i) => applied.current[i] && v.play(step, Math.floor(pos / 16) % 4, time))
    }, "16n")
    const reset = () => {
      applied.current = CLIPS.map(() => false)
      setPlaying(applied.current)
    }
    t.on("stop", reset)
    return () => {
      t.clear(id)
      t.off("stop", reset)
      voices.forEach((v) => v.dispose())
      ch.dispose()
      channel.current = null
    }
  }, [])

  useEffect(() => void channel.current?.volume.rampTo(toDb(Math.min(1, Math.max(0, volume))), 0.05), [volume])
  useEffect(() => void channel.current?.pan.rampTo(Math.min(1, Math.max(-1, pan)), 0.05), [pan])
  useEffect(() => {
    if (channel.current) channel.current.mute = mute
  }, [mute])

  useFrame(({ clock }) => {
    const t = Tone.getTransport()
    const running = t.state === "started"
    const ticks = t.ticks
    const phase = running ? (ticks % t.PPQ) / t.PPQ : 0
    const beat = running ? Math.floor(ticks / t.PPQ) % 4 : -1
    const blink = Math.sin(clock.elapsedTime * 14) > 0
    CLIPS.forEach((_, i) => {
      const queued = latest.current[i] !== applied.current[i]
      const e = queued ? (blink ? 0.55 : 0.08) : applied.current[i] ? 0.25 + 0.5 * (1 - phase) ** 2 : 0
      if (skins.current[i]) skins.current[i]!.emissiveIntensity = e
      if (halos.current[i]) halos.current[i]!.opacity = applied.current[i] || queued ? e * 0.9 : 0
    })
    dots.current.forEach((m, k) => m?.color.set(k === beat ? (k === 0 ? WARM : ACCENT) : BORDER2))
  })

  const toggle = async (i: number) => {
    const next = active.map((on, k) => (k === i ? !on : on))
    if (value === undefined) setInner(next)
    onChange?.(next)
    await Tone.start() // browsers stay silent until a user gesture resumes audio
    const t = Tone.getTransport()
    if (t.state !== "started") t.start() // a clip launcher plays when you launch a clip
  }

  const x0 = -(3 * (P + GAP)) / 2
  const y0 = GRID_Y + (P + GAP) / 2

  return (
    <group>
      <mesh geometry={plate}>
        <meshStandardMaterial color={SURFACE} roughness={0.75} metalness={0.1} />
      </mesh>
      <group position={[-W / 2 + 0.02, H / 2 - 0.016, FRONT + 0.001]}>
        <Container pixelSize={0.002} anchorX="left" anchorY="top" flexDirection="row" alignItems="center" gap={8} pointerEvents="none">
          <Text fontSize={16} fontWeight="bold" color={TEXT}>
            {label}
          </Text>
          <Text fontSize={10} color={FAINT}>
            {`${playing.filter(Boolean).length}/8 PLAYING`}
          </Text>
        </Container>
      </group>
      {[0, 1, 2, 3].map((k) => (
        <mesh key={k} position={[W / 2 - 0.026 - (3 - k) * 0.014, H / 2 - 0.024, FRONT + 0.001]}>
          <circleGeometry args={[0.0035, 20]} />
          <meshBasicMaterial
            ref={(m) => {
              dots.current[k] = m
            }}
            color={BORDER2}
          />
        </mesh>
      ))}
      {CLIPS.map((_, i) => (
        <Pad
          key={i}
          i={i}
          x={x0 + (i % 4) * (P + GAP)}
          y={y0 - Math.floor(i / 4) * (P + GAP)}
          on={active[i]}
          playing={playing[i]}
          geometry={padGeo}
          glow={glow}
          onToggle={toggle}
          skin={(m) => {
            skins.current[i] = m
          }}
          halo={(m) => {
            halos.current[i] = m
          }}
        />
      ))}
    </group>
  )
}
