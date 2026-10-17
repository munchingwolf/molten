"use client"

import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { RoundedBox } from "@react-three/drei"
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

// Real-world size (metres). Origin = centre of the bounding box; front faces +Z.
const W = 0.42
const D = 0.26
const CHEEK = 0.018
const BODY_H = 0.035
const DECK_H = 0.026
const H = BODY_H + DECK_H + 0.016 // + knob height
const Y0 = -H / 2 // underside
const KEY_PITCH = 0.0235
const KEY_L = 0.115
const KEYS_X = -0.06 // left edge of the keybed
const KEYS_Z = D / 2 - 0.008 // front edge of the white keys
const DECK_Z0 = -D / 2
const DECK_Z1 = KEYS_Z - KEY_L - 0.006
const DECK_D = DECK_Z1 - DECK_Z0
const DECK_TOP = Y0 + BODY_H + DECK_H

const WHITE = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]
const BLACK: [string, number][] = [["C#4", 0], ["D#4", 1], ["F#4", 3], ["G#4", 4], ["A#4", 5]]

const PARAMS = ["cutoff", "attack", "release", "volume"] as const
type Param = (typeof PARAMS)[number]
const KNOB_X = [-0.035, 0.025, 0.085, 0.145]
const KNOB_Z = DECK_Z0 + DECK_D * 0.48
const SCREEN = { x: -0.125, z: KNOB_Z, w: 0.1, d: 0.05 }

const cutoffHz = (v: number) => 60 * Math.pow(200, v) // 60 Hz – 12 kHz
const attackS = (v: number) => 0.002 + v * v * 1.5
const releaseS = (v: number) => 0.05 + v * v * 3
const volumeDb = (v: number) => (v < 0.01 ? -Infinity : Tone.gainToDb(v * v))
const readout: Record<Param, (v: number) => string> = {
  cutoff: (v) => (cutoffHz(v) >= 1000 ? `${(cutoffHz(v) / 1000).toFixed(1)} kHz` : `${Math.round(cutoffHz(v))} Hz`),
  attack: (v) => `${Math.round(attackS(v) * 1000)} ms`,
  release: (v) => `${releaseS(v).toFixed(2)} s`,
  volume: (v) => (v < 0.01 ? "-inf dB" : `${volumeDb(v).toFixed(1)} dB`),
}

type Wave = "sawtooth" | "square" | "triangle" | "sine"
type Props = {
  cutoff?: number
  attack?: number
  release?: number
  volume?: number
  onCutoffChange?: (v: number) => void
  onAttackChange?: (v: number) => void
  onReleaseChange?: (v: number) => void
  onVolumeChange?: (v: number) => void
  /** Fires with the note name when a key goes down. */
  onPress?: (note: string) => void
  waveform?: Wave
  /** Screen + LED colour */
  color?: string
}

function grainTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 256
  const g = c.getContext("2d")!
  g.fillStyle = "#fff"
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 70; i++) {
    g.strokeStyle = `rgba(60,30,10,${0.06 + Math.random() * 0.14})`
    g.lineWidth = 0.6 + Math.random() * 2.2
    const y = Math.random() * 256
    g.beginPath()
    g.moveTo(0, y)
    for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x * 0.025 + i) * 4)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Printed legend on the brushed-aluminium control deck. Canvas top = back of the deck. */
function deckTexture() {
  const c = document.createElement("canvas")
  c.width = 1024
  c.height = Math.round((1024 * DECK_D) / (W - 2 * CHEEK))
  const g = c.getContext("2d")!
  const sx = c.width / (W - 2 * CHEEK)
  const px = (x: number) => (x + (W - 2 * CHEEK) / 2) * sx
  const pz = (z: number) => (z - DECK_Z0) * sx
  g.fillStyle = "#ffffff"
  g.fillRect(0, 0, c.width, c.height)
  for (let y = 0; y < c.height; y += 2) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`
    g.fillRect(0, y, c.width, 1)
  }
  g.fillStyle = "#1c1d20"
  g.textAlign = "center"
  g.font = "600 22px Helvetica, Arial, sans-serif"
  const labels = ["CUTOFF", "ATTACK", "RELEASE", "VOLUME"]
  KNOB_X.forEach((x, i) => {
    g.fillText(labels[i], px(x), pz(KNOB_Z) + 0.026 * sx + 22)
    // tick ring
    for (let k = 0; k <= 10; k++) {
      const a = Math.PI * 0.75 + (k / 10) * Math.PI * 1.5
      const r0 = 0.0145 * sx
      const r1 = (k % 5 === 0 ? 0.0185 : 0.0168) * sx
      g.lineWidth = k % 5 === 0 ? 3 : 2
      g.strokeStyle = "#1c1d20"
      g.beginPath()
      g.moveTo(px(x) + Math.cos(a) * r0, pz(KNOB_Z) + Math.sin(a) * r0)
      g.lineTo(px(x) + Math.cos(a) * r1, pz(KNOB_Z) + Math.sin(a) * r1)
      g.stroke()
    }
  })
  g.textAlign = "left"
  g.font = "700 30px Helvetica, Arial, sans-serif"
  g.fillText("SPATIAL", 24, 44)
  g.font = "400 22px Helvetica, Arial, sans-serif"
  g.fillText("S-13 POLYPHONIC SYNTHESIZER", 160, 42)
  // screen bezel
  g.fillStyle = "#151619"
  const bx = px(SCREEN.x - SCREEN.w / 2 - 0.004)
  const bz = pz(SCREEN.z - SCREEN.d / 2 - 0.004)
  g.fillRect(bx, bz, (SCREEN.w + 0.008) * sx, (SCREEN.d + 0.008) * sx)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function drawScreen(g: CanvasRenderingContext2D, color: string, param: Param | null, values: Record<Param, number>, note: string | null) {
  const { width: w, height: h } = g.canvas
  g.fillStyle = "#030605"
  g.fillRect(0, 0, w, h)
  g.fillStyle = color
  g.strokeStyle = color
  g.font = "600 18px ui-monospace, Menlo, monospace"
  g.globalAlpha = 0.6
  g.fillText("S-13  POLY  " + (note ?? "--"), 14, 26)
  g.globalAlpha = 1
  const p = param ?? "cutoff"
  g.font = "700 30px ui-monospace, Menlo, monospace"
  g.fillText(p.toUpperCase(), 14, 66)
  g.textAlign = "right"
  g.fillText(readout[p](values[p]), w - 14, 66)
  g.textAlign = "left"
  // value bar
  g.lineWidth = 2
  g.strokeRect(14, 80, w - 28, 12)
  g.fillRect(16, 82, (w - 32) * values[p], 8)
  // envelope / filter curve
  g.lineWidth = 3
  g.beginPath()
  const x0 = 14
  const x1 = w - 14
  const yb = h - 10
  const yt = 104
  if (p === "cutoff") {
    const knee = x0 + (x1 - x0) * values.cutoff
    g.moveTo(x0, yt + 10)
    g.lineTo(knee - 12, yt + 10)
    g.quadraticCurveTo(knee, yt - 4, knee + 10, yt + 20)
    g.lineTo(Math.min(x1, knee + 50), yb)
  } else {
    const a = 0.05 + values.attack * 0.35
    const r = 0.05 + values.release * 0.35
    g.moveTo(x0, yb)
    g.lineTo(x0 + (x1 - x0) * a, yt)
    g.lineTo(x0 + (x1 - x0) * (a + 0.12), yt + (yb - yt) * 0.35)
    g.lineTo(x1 - (x1 - x0) * r, yt + (yb - yt) * 0.35)
    g.lineTo(x1, yb)
  }
  g.stroke()
}

type KnobProps = { x: number; t: number; onSet: (t: number) => void; root: RefObject<THREE.Group | null>; env: THREE.Texture; color: string }

function Knob({ x, t, onSet, root, env, color }: KnobProps) {
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
    const d = p.x - drag.current.p.x - (p.z - drag.current.p.z) + (p.y - drag.current.p.y) // right, away or up = more
    onSet(Math.min(1, Math.max(0, drag.current.t + d / 0.08)))
  }
  const up = () => (drag.current = null)
  return (
    <group position={[x, DECK_TOP, KNOB_Z]}>
      <mesh
        position={[0, 0.01, 0]}
        visible={false}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <cylinderGeometry args={[0.017, 0.017, 0.024, 16]} />
      </mesh>
      <group rotation={[0, Math.PI * 0.75 - t * Math.PI * 1.5, 0]}>
        <mesh position={[0, 0.006, 0]}>
          <cylinderGeometry args={[0.0115, 0.0125, 0.012, 32]} />
          <meshPhysicalMaterial color={hover ? "#34363b" : "#222326"} roughness={0.55} clearcoat={0.4} envMap={env} />
        </mesh>
        <mesh position={[0, 0.0135, 0]}>
          <cylinderGeometry args={[0.0095, 0.0105, 0.003, 32]} />
          <meshPhysicalMaterial color="#d4d6da" metalness={0.9} roughness={0.35} envMap={env} />
        </mesh>
        <mesh position={[0, 0.0152, -0.0055]}>
          <boxGeometry args={[0.0015, 0.0006, 0.007]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

type KeyProps = { note: string; x: number; z: number; black: boolean; mat: THREE.Material; onDown: (n: string) => void; onUp: (n: string) => void }

function Key({ note, x, z, black, mat, onDown, onUp }: KeyProps) {
  const [down, setDown] = useState(false)
  const [w, h, l] = black ? [0.013, 0.02, 0.07] : [KEY_PITCH - 0.001, 0.016, KEY_L]
  const y = Y0 + BODY_H + (black ? 0.002 : 0) + h / 2
  const release = () => {
    if (!down) return
    setDown(false)
    onUp(note)
  }
  return (
    <group position={[x, y, z]}>
      {/* Static hit box above the key: the key dips on press, the hit surface must not, or a poke would re-trigger. */}
      <mesh
        visible={false}
        position={[0, 0.006, 0]}
        onPointerDown={() => {
          setDown(true)
          onDown(note)
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerOut={release}
      >
        <boxGeometry args={[black ? 0.019 : w, h + 0.012, l]} />
      </mesh>
      <RoundedBox args={[w, h, l]} radius={0.0015} smoothness={2} position={[0, down ? -0.005 : 0, 0]} rotation={[down ? -0.04 : 0, 0, 0]} material={mat} />
    </group>
  )
}

/**
 * Desktop polysynth with a 13-key keybed (C4–C5), four knobs (cutoff, attack, release, volume) and an OLED screen.
 * Every knob is controlled-or-uncontrolled (0–1). Plays through Tone.js.
 */
export default function HardwareSynth({
  cutoff,
  attack,
  release,
  volume,
  onCutoffChange,
  onAttackChange,
  onReleaseChange,
  onVolumeChange,
  onPress,
  waveform = "sawtooth",
  color = "#5BE7C4",
}: Props) {
  const env = useRoomEnv()
  const root = useRef<THREE.Group>(null)
  const [inner, setInner] = useState<Record<Param, number>>({ cutoff: 0.62, attack: 0.08, release: 0.35, volume: 0.75 })
  const [last, setLast] = useState<Param | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const ext: Record<Param, number | undefined> = { cutoff, attack, release, volume }
  const events: Record<Param, ((v: number) => void) | undefined> = {
    cutoff: onCutoffChange,
    attack: onAttackChange,
    release: onReleaseChange,
    volume: onVolumeChange,
  }
  const values = Object.fromEntries(PARAMS.map((p) => [p, Math.min(1, Math.max(0, ext[p] ?? inner[p]))])) as Record<Param, number>

  const set = (p: Param, v: number) => {
    if (ext[p] === undefined) setInner((s) => ({ ...s, [p]: v }))
    events[p]?.(v)
    setLast(p)
  }

  // Audio graph: PolySynth → low-pass filter → volume → speakers
  const audio = useRef<{ synth: Tone.PolySynth; filter: Tone.Filter; vol: Tone.Volume } | null>(null)
  useEffect(() => {
    const vol = new Tone.Volume(-6).toDestination()
    const filter = new Tone.Filter({ type: "lowpass", frequency: 2000, Q: 3, rolloff: -24 }).connect(vol)
    const synth = new Tone.PolySynth(Tone.Synth, { envelope: { attack: 0.01, decay: 0.25, sustain: 0.55, release: 0.8 }, volume: -10 }).connect(filter)
    audio.current = { synth, filter, vol }
    return () => {
      synth.dispose()
      filter.dispose()
      vol.dispose()
      audio.current = null
    }
  }, [])
  useEffect(() => {
    audio.current?.synth.set({ oscillator: { type: waveform === "sine" ? "sine" : (`fat${waveform}` as "fatsawtooth"), spread: 18, count: 3 } as never })
  }, [waveform])
  useEffect(() => void audio.current?.filter.frequency.rampTo(cutoffHz(values.cutoff), 0.05), [values.cutoff])
  useEffect(() => void audio.current?.synth.set({ envelope: { attack: attackS(values.attack), release: releaseS(values.release) } }), [values.attack, values.release])
  useEffect(() => {
    const a = audio.current
    if (!a) return
    const db = volumeDb(values.volume)
    a.vol.mute = db === -Infinity
    if (db !== -Infinity) a.vol.volume.rampTo(db, 0.05)
  }, [values.volume])

  const keyDown = (n: string) => {
    void Tone.start() // browsers stay silent until a user gesture resumes audio
    audio.current?.synth.triggerAttack(n, Tone.now())
    setNote(n)
    onPress?.(n)
  }
  const keyUp = (n: string) => audio.current?.synth.triggerRelease(n, Tone.now())

  // Screen
  const screen = useMemo(() => {
    const c = document.createElement("canvas")
    c.width = 320
    c.height = 160
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return { g: c.getContext("2d")!, tex }
  }, [])
  useEffect(() => {
    drawScreen(screen.g, color, last, values, note)
    screen.tex.needsUpdate = true
  }, [screen, color, last, note, values.cutoff, values.attack, values.release, values.volume]) // eslint-disable-line react-hooks/exhaustive-deps

  const tex = useMemo(() => ({ grain: grainTexture(), deck: deckTexture() }), [])
  const mats = useMemo(
    () => ({
      white: new THREE.MeshPhysicalMaterial({ color: "#f3f0e8", roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2, envMap: env }),
      black: new THREE.MeshPhysicalMaterial({ color: "#111214", roughness: 0.35, clearcoat: 0.5, envMap: env }),
    }),
    [env],
  )
  useEffect(
    () => () => {
      Object.values(tex).forEach((t) => t.dispose())
      Object.values(mats).forEach((m) => m.dispose())
      screen.tex.dispose()
    },
    [tex, mats, screen],
  )

  // LED pulses with the newest note
  const led = useRef<THREE.MeshBasicMaterial>(null)
  const ledLevel = useRef(0)
  useEffect(() => {
    ledLevel.current = 1
  }, [note])
  useFrame((_, dt) => {
    ledLevel.current = Math.max(0.25, ledLevel.current - dt * 3)
    led.current?.color.set(color).multiplyScalar(ledLevel.current)
  })

  const innerW = W - 2 * CHEEK
  return (
    <group ref={root}>
      {/* walnut end cheeks */}
      {[-1, 1].map((s) => (
        <RoundedBox key={s} args={[CHEEK, BODY_H + DECK_H + 0.006, D]} radius={0.004} smoothness={3} position={[s * (W / 2 - CHEEK / 2), Y0 + (BODY_H + DECK_H + 0.006) / 2, 0]}>
          <meshPhysicalMaterial color="#7a4524" map={tex.grain} roughness={0.5} clearcoat={0.35} clearcoatRoughness={0.4} envMap={env} />
        </RoundedBox>
      ))}
      {/* chassis */}
      <RoundedBox args={[innerW, BODY_H, D - 0.002]} radius={0.003} smoothness={2} position={[0, Y0 + BODY_H / 2, 0]}>
        <meshPhysicalMaterial color="#1b1c1f" roughness={0.45} clearcoat={0.5} envMap={env} />
      </RoundedBox>
      {/* raised brushed-aluminium control deck */}
      <mesh position={[0, Y0 + BODY_H + DECK_H / 2, (DECK_Z0 + DECK_Z1) / 2]}>
        <boxGeometry args={[innerW, DECK_H, DECK_D]} />
        <meshPhysicalMaterial color="#25262a" roughness={0.5} envMap={env} />
      </mesh>
      <mesh position={[0, DECK_TOP + 0.0004, (DECK_Z0 + DECK_Z1) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[innerW, DECK_D]} />
        <meshPhysicalMaterial color="#c9ccd1" map={tex.deck} metalness={0.9} roughness={0.35} envMap={env} />
      </mesh>
      {/* OLED */}
      <mesh position={[SCREEN.x, DECK_TOP + 0.0012, SCREEN.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[SCREEN.w, SCREEN.d]} />
        <meshBasicMaterial map={screen.tex} toneMapped={false} />
      </mesh>
      {/* power LED */}
      <mesh position={[innerW / 2 - 0.016, DECK_TOP + 0.001, DECK_Z0 + 0.012]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.0022, 16]} />
        <meshBasicMaterial ref={led} color={color} toneMapped={false} />
      </mesh>
      {PARAMS.map((p, i) => (
        <Knob key={p} x={KNOB_X[i]} t={values[p]} onSet={(v) => set(p, v)} root={root} env={env} color={color} />
      ))}
      {/* pitch + mod wheels */}
      {[-0.155, -0.118].map((x) => (
        <group key={x} position={[x, Y0 + BODY_H + 0.002, KEYS_Z - KEY_L / 2]}>
          <mesh position={[0, -0.002, 0]}>
            <boxGeometry args={[0.022, 0.004, 0.07]} />
            <meshStandardMaterial color="#0c0c0d" roughness={0.9} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.026, 0.026, 0.016, 32]} />
            <meshPhysicalMaterial color="#2a2b2f" roughness={0.75} envMap={env} />
          </mesh>
        </group>
      ))}
      {/* keybed */}
      {WHITE.map((n, i) => (
        <Key key={n} note={n} x={KEYS_X + KEY_PITCH * (i + 0.5)} z={KEYS_Z - KEY_L / 2} black={false} mat={mats.white} onDown={keyDown} onUp={keyUp} />
      ))}
      {BLACK.map(([n, i]) => (
        <Key key={n} note={n} x={KEYS_X + KEY_PITCH * (i + 1)} z={KEYS_Z - KEY_L + 0.035} black mat={mats.black} onDown={keyDown} onUp={keyUp} />
      ))}
      {/* speaker grille right of the keys */}
      <mesh position={[(KEYS_X + KEY_PITCH * 8 + innerW / 2) / 2, Y0 + BODY_H + 0.0004, KEYS_Z - KEY_L / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[innerW / 2 - KEYS_X - KEY_PITCH * 8 - 0.012, KEY_L - 0.01]} />
        <meshPhysicalMaterial color="#0d0d0e" roughness={0.9} envMap={env} />
      </mesh>
    </group>
  )
}
