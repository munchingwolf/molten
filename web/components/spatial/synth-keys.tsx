"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react"
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { RoundedBox } from "@react-three/drei"
import * as THREE from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
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
const W = 0.5
const D = 0.18
const BODY_H = 0.05
const PITCH = 0.032 // white key pitch: 15 keys span the full width
const WK = { w: PITCH - 0.0012, h: 0.012, l: 0.121 }
const BK = { w: PITCH * 0.6, h: 0.011, l: 0.0744 } // 60% length, like the mockup
const KEYS_Z = 0.077 // front edge of the white keys
const PIVOT_Z = KEYS_Z - WK.l // keys hinge at their back end
const KEY_Y = BODY_H // key underside (inner frame: body bottom at y = 0)
const STRIP_Z0 = -0.08
const STRIP_Z1 = PIVOT_Z - 0.002
const STRIP_TOP = BODY_H
const STRIP_Zc = (STRIP_Z0 + STRIP_Z1) / 2
const DISPLAY = { x: -0.185, w: 0.09, d: 0.022 }
const KNOB_X = [-0.11, -0.075, -0.04, -0.005]
const KNOB_Z = STRIP_Zc - 0.002
const WARM = "#F2B48A"
const PARAMS = ["cutoff", "resonance", "attack", "release"] as const
type Param = (typeof PARAMS)[number]
const LABELS = ["CUTOFF", "RES", "ATTACK", "RELEASE"]
const DEFAULTS: Record<Param, number> = { cutoff: 0.6, resonance: 0.2, attack: 0.5, release: 0.5 }

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
type KeyDef = { note: string; black: boolean; x: number }
const KEYS: KeyDef[] = (() => {
  const out: KeyDef[] = []
  let white = 0
  for (let m = 48; m <= 72; m++) {
    const name = NAMES[m % 12]
    const black = name.includes("#")
    const x = -7 * PITCH + (black ? white - 0.5 : white) * PITCH // 15 whites centred on x = 0
    out.push({ note: `${name}${Math.floor(m / 12) - 1}`, black, x })
    if (!black) white++
  }
  return out
})()
const WHITES = KEYS.map((k, i) => [k, i] as const).filter(([k]) => !k.black)
const BLACKS = KEYS.map((k, i) => [k, i] as const).filter(([k]) => k.black)

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

/** Printed control strip (canvas top = back). */
function stripTexture() {
  const c = document.createElement("canvas")
  c.width = 1024
  c.height = Math.round((1024 * (STRIP_Z1 - STRIP_Z0)) / W)
  const g = c.getContext("2d")!
  const s = 1024 / W
  const px = (x: number) => (x + W / 2) * s
  const pz = (z: number) => (z - STRIP_Z0) * s
  g.fillStyle = "#181b22"
  g.fillRect(0, 0, c.width, c.height)
  // display bezel
  g.fillStyle = "#0B0C10"
  g.fillRect(px(DISPLAY.x - DISPLAY.w / 2 - 0.003), pz(STRIP_Zc - DISPLAY.d / 2 - 0.003), (DISPLAY.w + 0.006) * s, (DISPLAY.d + 0.006) * s)
  g.textAlign = "center"
  g.font = "600 10px ui-monospace, Menlo, monospace"
  g.fillStyle = "#9AA0AD"
  KNOB_X.forEach((x, i) => g.fillText(LABELS[i], px(x), pz(STRIP_Z1) - 2))
  g.textAlign = "right"
  g.fillStyle = "#EEF0F4"
  g.font = "700 18px ui-monospace, Menlo, monospace"
  g.fillText("SYNTH KEYS", px(W / 2 - 0.012), pz(STRIP_Zc) + 2)
  g.fillStyle = "#9AA0AD"
  g.font = "500 11px ui-monospace, Menlo, monospace"
  g.fillText("SPATIAL SK-25", px(W / 2 - 0.012), pz(STRIP_Zc) + 17)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function drawDisplay(g: CanvasRenderingContext2D, accent: string, preset: Preset, note: string | null, idx: number) {
  const { width: w, height: h } = g.canvas
  g.fillStyle = "#0B0C10"
  g.fillRect(0, 0, w, h)
  g.fillStyle = accent
  g.font = "600 38px ui-monospace, Menlo, monospace"
  g.fillText(preset, 18, 52)
  g.fillStyle = "#9AA0AD"
  g.font = "500 16px ui-monospace, Menlo, monospace"
  g.fillText(`${idx + 1}/4  TAP  ${note ?? ""}`, 18, h - 12)
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i === idx ? accent : "#242833"
    g.fillRect(w - 18 - (4 - i) * 16, h - 22, 12, 6)
  }
}

type KnobProps = { x: number; t: number; onSet: (t: number) => void; root: RefObject<THREE.Group | null>; env: THREE.Texture; accent: string }

function Knob({ x, t, onSet, root, env, accent }: KnobProps) {
  const [hover, setHover] = useState(false)
  const drag = useRef<{ p: THREE.Vector3; t: number } | null>(null)
  const local = (e: ThreeEvent<PointerEvent>) => root.current!.worldToLocal(e.point.clone())
  const down = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    drag.current = { p: local(e), t }
  }
  const move = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current || !root.current) return
    const p = local(e)
    const d = p.y - drag.current.p.y + (drag.current.p.z - p.z) + (p.x - drag.current.p.x) // up, away or right = more
    onSet(Math.min(1, Math.max(0, drag.current.t + d / 0.08)))
  }
  const up = () => (drag.current = null)
  return (
    <group position={[x, STRIP_TOP, KNOB_Z]}>
      <mesh
        position={[0, 0.008, 0]}
        visible={false}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <cylinderGeometry args={[0.0125, 0.0125, 0.02, 16]} />
      </mesh>
      {/* value arc (canvas-style: from bottom-left, clockwise), over a dim track */}
      <mesh position={[0, 0.0004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.0102, 0.0118, 40, 1, -Math.PI * 2.25, Math.PI * 1.5]} />
        <meshBasicMaterial color="#242833" />
      </mesh>
      <mesh position={[0, 0.0006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry key={t} args={[0.0102, 0.0118, 40, 1, -Math.PI * (0.75 + 1.5 * t), Math.max(0.001, Math.PI * 1.5 * t)]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
      <group rotation={[0, Math.PI * 0.75 - t * Math.PI * 1.5, 0]}>
        <mesh position={[0, 0.003, 0]}>
          <cylinderGeometry args={[0.008, 0.0083, 0.006, 32]} />
          <meshStandardMaterial color={hover ? "#3a404d" : "#2b303b"} roughness={0.5} metalness={0.15} envMap={env} envMapIntensity={0.6} />
        </mesh>
        <mesh position={[0, 0.0062, -0.0035]}>
          <boxGeometry args={[0.0014, 0.0006, 0.0065]} />
          <meshBasicMaterial color="#EEF0F4" toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
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
  const root = useRef<THREE.Group>(null)
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

  // Keys: refs, not state, so presses never re-render the keyboard.
  const down = useRef(new Uint8Array(KEYS.length))
  const angle = useRef(new Float32Array(KEYS.length))
  const speed = useRef(new Float32Array(KEYS.length))
  const glow = useRef(new Float32Array(KEYS.length))
  const seq = useRef(0)
  const [lastNote, setLastNote] = useState<string | null>(null)
  const playing = useRef(cur)
  useEffect(() => {
    // switching preset mid-chord: let the old sound ring out instead of hanging
    engine.current?.synths[playing.current].releaseAll()
    playing.current = cur
    down.current.fill(0)
  }, [cur])

  const keyDown = (i: number) => {
    if (down.current[i]) return
    void Tone.start() // browsers stay silent until a user gesture resumes audio
    const { note } = KEYS[i]
    const vel = 0.85
    const freq = cur === "SUB BASS" ? Tone.Frequency(note).transpose(-12).toNote() : note
    engine.current?.synths[cur].triggerAttack(freq, Tone.immediate(), vel)
    down.current[i] = 1
    glow.current[i] = 1
    seq.current++
    onNote?.(`${note}:on:${vel.toFixed(2)}:${seq.current}`)
    onPress?.(note)
    setLastNote(note)
  }
  const keyUp = (i: number) => {
    if (!down.current[i]) return
    down.current[i] = 0
    const { note } = KEYS[i]
    const freq = cur === "SUB BASS" ? Tone.Frequency(note).transpose(-12).toNote() : note
    engine.current?.synths[cur].triggerRelease(freq, Tone.immediate())
    seq.current++
    onNote?.(`${note}:off:0:${seq.current}`)
  }

  const cycle = () => {
    const next = PRESETS[(PRESETS.indexOf(cur) + 1) % PRESETS.length]
    setCur(next)
    onPresetChange?.(next)
  }

  // Display
  const display = useMemo(() => {
    const c = document.createElement("canvas")
    c.width = 368
    c.height = 90
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return { g: c.getContext("2d")!, tex }
  }, [])
  useEffect(() => {
    drawDisplay(display.g, color, cur, lastNote, PRESETS.indexOf(cur))
    display.tex.needsUpdate = true
  }, [display, color, cur, lastNote])

  const geo = useMemo(
    () => ({ white: new RoundedBoxGeometry(WK.w, WK.h, WK.l, 2, 0.0018), black: new RoundedBoxGeometry(BK.w, BK.h, BK.l, 2, 0.0018) }),
    [],
  )
  const strip = useMemo(stripTexture, [])
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
      strip.dispose()
      display.tex.dispose()
    },
    [geo, strip, display],
  )

  const whites = useRef<THREE.InstancedMesh>(null)
  const blacks = useRef<THREE.InstancedMesh>(null)
  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      r: new THREE.Matrix4(),
      t: new THREE.Matrix4(),
      c: new THREE.Color(),
      accent: new THREE.Color(),
      warm: new THREE.Color(WARM),
      white: new THREE.Color("#E9ECF2"),
      black: new THREE.Color("#111318"),
    }),
    [],
  )
  useLayoutEffect(() => {
    WHITES.forEach((_, j) => whites.current?.setColorAt(j, tmp.white))
    BLACKS.forEach((_, j) => blacks.current?.setColorAt(j, tmp.black))
  }, [tmp])

  useFrame((_, dt) => {
    const step = Math.min(dt, 1 / 30)
    tmp.accent.set(color)
    const place = (mesh: THREE.InstancedMesh | null, list: typeof WHITES, k: typeof WK, base: THREE.Color, lit: THREE.Color, y0: number) => {
      if (!mesh) return
      list.forEach(([key, i], j) => {
        // damped spring: snaps down, springs back with a touch of overshoot
        const target = down.current[i] ? 0.055 : 0
        speed.current[i] += ((target - angle.current[i]) * 900 - speed.current[i] * 38) * step
        angle.current[i] += speed.current[i] * step
        glow.current[i] = down.current[i] ? 1 : Math.max(0, glow.current[i] - dt * 4)
        // hinge at the key's back end: translate to pivot, tip the front down, offset to the key centre
        tmp.t.makeTranslation(key.x, y0 + k.h / 2, PIVOT_Z)
        tmp.r.makeRotationX(angle.current[i])
        tmp.m.makeTranslation(0, 0, k.l / 2)
        mesh.setMatrixAt(j, tmp.t.multiply(tmp.r).multiply(tmp.m))
        mesh.setColorAt(j, tmp.c.copy(base).lerp(lit, glow.current[i]))
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
    place(whites.current, WHITES, WK, tmp.white, tmp.accent, KEY_Y) // pressed white = mint
    place(blacks.current, BLACKS, BK, tmp.black, tmp.warm, KEY_Y + WK.h - 0.002) // pressed black = warm
  })

  const keyHandlers = (i: number) => ({
    onPointerDown: () => keyDown(i),
    onPointerUp: () => keyUp(i),
    onPointerCancel: () => keyUp(i),
    onPointerOut: () => keyUp(i),
  })

  // Lift so the tilted body's front edge rests on the desk (y = 0); the inner frame keeps the body bottom at y = 0.
  const lift = (BODY_H / 2) * Math.cos(tilt) + (D / 2) * Math.sin(tilt)
  return (
    <group position={[0, lift, 0]} rotation={[tilt, 0, 0]}>
    <group ref={root} position={[0, -BODY_H / 2, 0]}>
      {/* chassis */}
      <RoundedBox args={[W, BODY_H, D]} radius={0.005} smoothness={3} position={[0, BODY_H / 2, 0]}>
        <meshStandardMaterial color="#1a1d25" roughness={0.55} metalness={0.15} envMap={env} envMapIntensity={0.6} />
      </RoundedBox>
      {/* face */}
      <mesh position={[0, BODY_H + 0.0004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.48, 0.16]} />
        <meshStandardMaterial color="#181b22" roughness={0.6} metalness={0.1} />
      </mesh>
      <mesh position={[0, STRIP_TOP + 0.0007, STRIP_Zc]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W - 0.02, STRIP_Z1 - STRIP_Z0]} />
        <meshStandardMaterial map={strip} roughness={0.6} metalness={0.1} />
      </mesh>
      {/* preset display: tap to cycle */}
      <mesh position={[DISPLAY.x, STRIP_TOP + 0.0012, STRIP_Zc]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[DISPLAY.w, DISPLAY.d]} />
        <meshBasicMaterial map={display.tex} toneMapped={false} />
      </mesh>
      <mesh visible={false} position={[DISPLAY.x, STRIP_TOP + 0.008, STRIP_Zc]} onClick={cycle}>
        <boxGeometry args={[DISPLAY.w + 0.006, 0.016, DISPLAY.d + 0.006]} />
      </mesh>
      {PARAMS.map((p, i) => (
        <Knob key={p} x={KNOB_X[i]} t={values[p]} onSet={(v) => set(p, v)} root={root} env={env} accent={color} />
      ))}
      {/* keybed */}
      <instancedMesh ref={whites} args={[geo.white, undefined, WHITES.length]}>
        <meshPhysicalMaterial color="#ffffff" roughness={0.35} clearcoat={0.4} clearcoatRoughness={0.3} envMap={env} envMapIntensity={0.6} />
      </instancedMesh>
      <instancedMesh ref={blacks} args={[geo.black, undefined, BLACKS.length]}>
        <meshPhysicalMaterial color="#ffffff" roughness={0.4} clearcoat={0.4} envMap={env} envMapIntensity={0.5} />
      </instancedMesh>
      {/* Static hit boxes: keys dip on press, the hit surface must not, or a poke would re-trigger. Black boxes sit higher so they win. */}
      {WHITES.map(([k, i]) => (
        <mesh key={k.note} visible={false} position={[k.x, KEY_Y + WK.h / 2 + 0.004, PIVOT_Z + WK.l / 2]} {...keyHandlers(i)}>
          <boxGeometry args={[WK.w, WK.h + 0.008, WK.l]} />
        </mesh>
      ))}
      {BLACKS.map(([k, i]) => (
        <mesh key={k.note} visible={false} position={[k.x, KEY_Y + WK.h - 0.002 + BK.h / 2 + 0.004, PIVOT_Z + BK.l / 2]} {...keyHandlers(i)}>
          <boxGeometry args={[BK.w + 0.004, BK.h + 0.01, BK.l]} />
        </mesh>
      ))}
    </group>
    </group>
  )
}
