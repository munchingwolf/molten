"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useThree, type ThreeEvent } from "@react-three/fiber"
import * as THREE from "three"
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js"
import * as Tone from "tone"

const ENV_KEY = Symbol.for("spatial.roomEnv")
/** Neutral studio reflections, built once per renderer and shared by every Spatial component, so metal reads as metal in any scene. */
function useRoomEnv() {
  const gl = useThree((s) => s.gl)
  return useMemo(() => {
    const cache = gl as unknown as Record<symbol, THREE.Texture | undefined>
    if (!cache[ENV_KEY]) {
      const pmrem = new THREE.PMREMGenerator(gl)
      const room = new RoomEnvironment()
      cache[ENV_KEY] = pmrem.fromScene(room, 0.04).texture
      room.dispose()
      pmrem.dispose()
    }
    return cache[ENV_KEY]
  }, [gl])
}

// Spatial mixer bus: a convention on globalThis, not shared code, so this file stays copy-pasteable.
type SpatialBus = { ch: Record<number, Tone.Channel>; meter: Record<number, Tone.Meter> }
function mixerChannel(n: number) {
  const g = globalThis as typeof globalThis & { __spatialMixer?: SpatialBus }
  const bus = (g.__spatialMixer ??= { ch: {}, meter: {} })
  if (!bus.ch[n]) {
    bus.ch[n] = new Tone.Channel().toDestination()
    bus.meter[n] = new Tone.Meter({ normalRange: true, smoothing: 0.8 })
    bus.ch[n].connect(bus.meter[n])
  }
  return bus.ch[n]
}

// Real-world size (metres). Origin = centre-bottom; front faces +Z; `tilt` leans the top toward the user.
// The whole top is one canvas face (960 x 320 px over 0.48 x 0.16 m = 2000 px/m), drawn and hit-tested in the same pixel coordinates.
const W = 0.5
const D = 0.18
const BODY_H = 0.05
const FACE = { w: 0.48, h: 0.16, pw: 960, ph: 320 }
const KW = FACE.pw / 15 // white key width (px)
const KEY_TOP = 72
const BLACK_H = (FACE.ph - KEY_TOP) * 0.6
const KNOB = { x: (i: number) => 260 + i * 70, y: 36, r: 16 }
const DISPLAY = { x: 20, y: 14, w: 180, h: 44 }
const PARAMS = ["cutoff", "resonance", "attack", "release"] as const
type Param = (typeof PARAMS)[number]
const DEFAULTS: Record<Param, number> = { cutoff: 0.6, resonance: 0.2, attack: 0.5, release: 0.5 }

// Palette + fonts (DESIGN.md tokens).
const K = { bg: "#0B0C10", text: "#EEF0F4", warm: "#F2B48A" }
const FM = '"JetBrains Mono", ui-monospace, Menlo, monospace'

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
// C3-C5: 15 white + 10 black keys.
const KEYS = Array.from({ length: 25 }, (_, k) => {
  const name = NAMES[(48 + k) % 12]
  return { note: `${name}${Math.floor((48 + k) / 12) - 1}`, black: name.includes("#") }
})
const WHITES = KEYS.map((k, i) => [k, i] as const).filter(([k]) => !k.black)
// KEYS index of the black key right after white j (-1 after E and B), matching the drawing order.
const BLACK_AFTER = WHITES.map(([, i]) => (KEYS[i + 1]?.black ? i + 1 : -1))

const PRESETS = ["SAW PAD", "SQUARE LEAD", "BELL KEYS", "SUB BASS"] as const
type Preset = (typeof PRESETS)[number]
// Base envelope per preset; the ATTACK / RELEASE knobs scale it (knob centre = the preset's own feel).
const ENV: Record<Preset, { a: number; r: number }> = {
  "SAW PAD": { a: 0.35, r: 1.6 },
  "SQUARE LEAD": { a: 0.006, r: 0.25 },
  "BELL KEYS": { a: 0.002, r: 1.2 },
  "SUB BASS": { a: 0.006, r: 0.3 },
}
const cutoffHz = (v: number) => 80 * Math.pow(200, v) // 80 Hz - 16 kHz
const resQ = (v: number) => 0.5 + v * 12

type Engine = { synths: Record<Preset, Tone.PolySynth>; filter: Tone.Filter; out: Tone.Volume; dispose: () => void }

function makeEngine(): Engine {
  const out = new Tone.Volume(-4)
  const reverb = new Tone.Reverb({ decay: 2.8, wet: 0.22 }).connect(out)
  const filter = new Tone.Filter({ type: "lowpass", frequency: 2000, Q: 2, rolloff: -24 }).connect(reverb)
  const chorus = new Tone.Chorus({ frequency: 0.8, delayTime: 3.5, depth: 0.6, wet: 0.5 }).connect(filter).start()
  const synths: Record<Preset, Tone.PolySynth> = {
    "SAW PAD": new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fatsawtooth", count: 3, spread: 28 },
      envelope: { attack: 0.35, decay: 0.5, sustain: 0.75, release: 1.6 },
      volume: -14,
    }).connect(chorus),
    "SQUARE LEAD": new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fatsquare", count: 2, spread: 12 },
      envelope: { attack: 0.006, decay: 0.2, sustain: 0.6, release: 0.25 },
      volume: -16,
    }).connect(filter),
    "BELL KEYS": new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.01,
      modulationIndex: 12,
      oscillator: { type: "sine" },
      modulation: { type: "sine" },
      envelope: { attack: 0.002, decay: 1.4, sustain: 0.08, release: 1.2 },
      modulationEnvelope: { attack: 0.002, decay: 0.6, sustain: 0.15, release: 0.8 },
      volume: -10,
    }).connect(filter),
    "SUB BASS": new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fattriangle", count: 2, spread: 6 },
      envelope: { attack: 0.006, decay: 0.3, sustain: 0.85, release: 0.3 },
      volume: -6,
    }).connect(filter),
  }
  return {
    synths,
    filter,
    out,
    dispose: () => [...Object.values(synths), chorus, filter, reverb, out].forEach((n) => n.dispose()),
  }
}

type G = CanvasRenderingContext2D
function rr(g: G, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}
function box(g: G, x: number, y: number, w: number, h: number, r: number, fill: string) {
  rr(g, x, y, w, h, r)
  g.fillStyle = fill
  g.fill()
}
function knob(g: G, x: number, y: number, r: number, v: number, ring: string) {
  const a = Math.PI * (0.75 + 1.5 * v)
  g.fillStyle = "#2b303b"
  g.beginPath()
  g.arc(x, y, r, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = ring
  g.lineWidth = 4
  g.beginPath()
  g.arc(x, y, r + 6, Math.PI * 0.75, a)
  g.stroke()
  g.strokeStyle = K.text
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(x, y)
  g.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8)
  g.stroke()
}

type FaceState = { preset: Preset; color: string; values: Record<Param, number>; down: Uint8Array }

function drawKeys(g: G, s: FaceState) {
  const { pw: W, ph: H } = FACE
  g.fillStyle = "#181b22"
  g.fillRect(0, 0, W, H)
  box(g, DISPLAY.x, DISPLAY.y, DISPLAY.w, DISPLAY.h, 8, K.bg)
  g.font = `600 20px ${FM}`
  g.fillStyle = s.color
  g.textAlign = "left"
  g.textBaseline = "middle"
  g.fillText(s.preset, 36, 37, DISPLAY.w - 28)
  PARAMS.forEach((p, i) => knob(g, KNOB.x(i), KNOB.y, KNOB.r, s.values[p], s.color))
  WHITES.forEach(([, i], j) => box(g, j * KW + 2, KEY_TOP, KW - 4, H - KEY_TOP - 6, 6, s.down[i] ? s.color : "#E9ECF2"))
  BLACK_AFTER.forEach((i, j) => i >= 0 && box(g, (j + 1) * KW - KW * 0.3, KEY_TOP, KW * 0.6, BLACK_H, 4, s.down[i] ? K.warm : "#111318"))
}

type Hit = { kind: "key" | "knob"; i: number } | { kind: "preset"; i: 0 }

/** Same rectangles as the drawing, padded for fingertips. Black keys first: they sit on top. */
function hitTest(x: number, y: number): Hit | null {
  if (x < 0 || x > FACE.pw || y < 0 || y > FACE.ph) return null
  if (y >= KEY_TOP - 8) {
    const j = Math.round(x / KW) - 1 // nearest white-key boundary: the black key centred on it
    if (y <= KEY_TOP + BLACK_H + 6 && BLACK_AFTER[j] >= 0 && Math.abs(x - (j + 1) * KW) <= KW * 0.3 + 4) return { kind: "key", i: BLACK_AFTER[j] }
    return { kind: "key", i: WHITES[Math.min(14, Math.floor(x / KW))][1] }
  }
  if (x < DISPLAY.x + DISPLAY.w + 8) return { kind: "preset", i: 0 }
  const k = Math.round((x - KNOB.x(0)) / 70)
  if (k >= 0 && k < 4 && Math.hypot(x - KNOB.x(k), y - KNOB.y) < 34) return { kind: "knob", i: k }
  return null
}

const _plane = new THREE.Plane()
const _n = new THREE.Vector3()
const _v = new THREE.Vector3()
/** Pointer hit -> canvas px on a face plane. */
function toPx(e: ThreeEvent<PointerEvent>, m: THREE.Mesh) {
  let p = e.point
  // R3F's DOM events reuse the capture-time hit once a captured pointer leaves the mesh, so re-cast the live ray (XR events project it already).
  if (!("pointerState" in e) && e.ray) {
    _n.set(0, 0, 1).transformDirection(m.matrixWorld)
    _plane.setFromNormalAndCoplanarPoint(_n, m.getWorldPosition(_v))
    if (e.ray.intersectPlane(_plane, _v)) p = _v
  }
  const l = m.worldToLocal(p.clone())
  return [(l.x / FACE.w + 0.5) * FACE.pw, (0.5 - l.y / FACE.h) * FACE.ph] as const
}

type Props = {
  preset?: Preset
  onPresetChange?: (preset: Preset) => void
  /** Mixer channel this instrument plays into (2 = KEYS in the Night Set) */
  channel?: number
  cutoff?: number
  resonance?: number
  attack?: number
  release?: number
  onCutoffChange?: (v: number) => void
  onResonanceChange?: (v: number) => void
  onAttackChange?: (v: number) => void
  onReleaseChange?: (v: number) => void
  /** Pressed-key glow and display colour */
  color?: string
  /** Tilt toward the user, radians (applied around local X). */
  tilt?: number
  /** Bindable value; ignored as input, exists so `onNote` can be wired. */
  note?: string
  /** Fires `note:on:vel:seq` on press and `note:off:0:seq` on release, e.g. `C4:on:0.85:12`. */
  onNote?: (value: string) => void
  /** Fires with the note name when a key goes down. */
  onPress?: (note: string) => void
}

/**
 * 25-key synth keyboard (C3-C5) with a preset display (tap to cycle SAW PAD, SQUARE LEAD, BELL KEYS, SUB BASS)
 * and CUTOFF / RES / ATTACK / RELEASE knobs. Polyphonic: play chords with several fingers.
 */
export default function SynthKeys({
  preset,
  onPresetChange,
  channel = 2,
  cutoff,
  resonance,
  attack,
  release,
  onCutoffChange,
  onResonanceChange,
  onAttackChange,
  onReleaseChange,
  color = "#9FE7D2",
  tilt = 0.12,
  onNote,
  onPress,
}: Props) {
  const env = useRoomEnv()
  const [cur, setCur] = useState<Preset>(preset && PRESETS.includes(preset) ? preset : "SAW PAD")
  useEffect(() => {
    if (preset && PRESETS.includes(preset)) setCur(preset)
  }, [preset])
  const [inner, setInner] = useState(DEFAULTS)
  const ext: Record<Param, number | undefined> = { cutoff, resonance, attack, release }
  const events: Record<Param, ((v: number) => void) | undefined> = { cutoff: onCutoffChange, resonance: onResonanceChange, attack: onAttackChange, release: onReleaseChange }
  const values = Object.fromEntries(PARAMS.map((p) => [p, Math.min(1, Math.max(0, ext[p] ?? inner[p]))])) as Record<Param, number>
  const set = (p: Param, v: number) => {
    if (ext[p] === undefined) setInner((s) => ({ ...s, [p]: v }))
    events[p]?.(v)
  }

  const engine = useRef<Engine | null>(null)
  useEffect(() => {
    const e = makeEngine()
    engine.current = e
    return () => {
      e.dispose()
      engine.current = null
    }
  }, [])
  useEffect(() => {
    const out = engine.current?.out
    if (!out) return
    out.disconnect()
    out.connect(mixerChannel(channel))
  }, [channel])
  useEffect(() => void engine.current?.filter.frequency.rampTo(cutoffHz(values.cutoff), 0.05), [values.cutoff])
  useEffect(() => void engine.current?.filter.Q.rampTo(resQ(values.resonance), 0.05), [values.resonance])
  useEffect(() => {
    const e = ENV[cur]
    engine.current?.synths[cur].set({ envelope: { attack: e.a * Math.pow(8, 2 * values.attack - 1), release: e.r * Math.pow(4, 2 * values.release - 1) } })
  }, [cur, values.attack, values.release])

  // Keys: refs, not state, so presses never re-render the keyboard; they redraw the face directly.
  const down = useRef(new Uint8Array(KEYS.length))
  const seq = useRef(0)
  const playing = useRef(cur)
  useEffect(() => {
    // switching preset mid-chord: let the old sound ring out instead of hanging
    engine.current?.synths[playing.current].releaseAll()
    playing.current = cur
    down.current.fill(0)
    held.current.clear()
  }, [cur])

  // Face canvas
  const gl = useThree((s) => s.gl)
  const face = useMemo(() => {
    const c = document.createElement("canvas")
    c.width = FACE.pw
    c.height = FACE.ph
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = gl.capabilities.getMaxAnisotropy()
    return { g: c.getContext("2d")!, tex }
  }, [gl])
  useEffect(() => () => face.tex.dispose(), [face])
  const state = useRef<FaceState>(null!)
  state.current = { preset: cur, color, values, down: down.current }
  const redraw = () => {
    drawKeys(face.g, state.current)
    face.tex.needsUpdate = true
  }
  useEffect(redraw)
  useEffect(() => void document.fonts?.ready.then(redraw), []) // eslint-disable-line react-hooks/exhaustive-deps

  const keyDown = (i: number) => {
    if (down.current[i]) return
    void Tone.start() // browsers stay silent until a user gesture resumes audio
    const { note } = KEYS[i]
    const vel = 0.85
    const freq = cur === "SUB BASS" ? Tone.Frequency(note).transpose(-12).toNote() : note
    engine.current?.synths[cur].triggerAttack(freq, Tone.immediate(), vel)
    down.current[i] = 1
    seq.current++
    onNote?.(`${note}:on:${vel.toFixed(2)}:${seq.current}`)
    onPress?.(note)
    redraw()
  }
  const keyUp = (i: number) => {
    if (!down.current[i]) return
    down.current[i] = 0
    const { note } = KEYS[i]
    const freq = cur === "SUB BASS" ? Tone.Frequency(note).transpose(-12).toNote() : note
    engine.current?.synths[cur].triggerRelease(freq, Tone.immediate())
    seq.current++
    onNote?.(`${note}:off:0:${seq.current}`)
    redraw()
  }

  const cycle = () => {
    const next = PRESETS[(PRESETS.indexOf(cur) + 1) % PRESETS.length]
    setCur(next)
    onPresetChange?.(next)
  }

  // Pointer: one face plane, hit-tested in canvas px. Each pointer holds one key (chords = several fingers) and can slide
  // across keys; knob drags are relative to where they start.
  const faceMesh = useRef<THREE.Mesh>(null)
  const held = useRef(new Map<number, number>()) // pointerId -> key index
  const drags = useRef(new Map<number, { i: number; x: number; y: number; v: number }>())
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    const [x, y] = toPx(e, faceMesh.current!)
    const hit = hitTest(x, y)
    if (!hit) return
    if (hit.kind === "preset") return cycle()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    if (hit.kind === "knob") return void drags.current.set(e.pointerId, { i: hit.i, x, y, v: values[PARAMS[hit.i]] })
    held.current.set(e.pointerId, hit.i)
    keyDown(hit.i)
  }
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drags.current.get(e.pointerId)
    const k = held.current.get(e.pointerId)
    if (!d && k === undefined) return
    const [x, y] = toPx(e, faceMesh.current!)
    if (d) return set(PARAMS[d.i], Math.min(1, Math.max(0, d.v + (d.y - y + x - d.x) / 160))) // up or right = more
    const hit = hitTest(x, y)
    const next = hit?.kind === "key" ? hit.i : -1
    if (next === k) return
    keyUp(k!)
    if (next < 0 || [...held.current.values()].includes(next)) return void held.current.set(e.pointerId, -1)
    held.current.set(e.pointerId, next)
    keyDown(next)
  }
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    drags.current.delete(e.pointerId)
    const k = held.current.get(e.pointerId)
    held.current.delete(e.pointerId)
    if (k !== undefined && k >= 0) keyUp(k)
  }

  // Lift so the tilted body's front edge rests on the desk (y = 0); the inner frame keeps the body bottom at y = 0.
  const lift = (BODY_H / 2) * Math.cos(tilt) + (D / 2) * Math.sin(tilt)
  return (
    <group position={[0, lift, 0]} rotation={[tilt, 0, 0]}>
      <group position={[0, -BODY_H / 2, 0]}>
        <mesh position={[0, BODY_H / 2, 0]}>
          <boxGeometry args={[W, BODY_H, D]} />
          <meshStandardMaterial color="#1a1d25" roughness={0.55} metalness={0.15} envMap={env} envMapIntensity={0.6} />
        </mesh>
        <mesh
          ref={faceMesh}
          position={[0, BODY_H + 0.0005, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <planeGeometry args={[FACE.w, FACE.h]} />
          <meshBasicMaterial map={face.tex} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}
