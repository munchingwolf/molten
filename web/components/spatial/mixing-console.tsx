"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
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

// Real-world size (metres). Origin = body centre; `tilt` leans it toward the user around local X. The whole top is one
// canvas face (1000 x 580 px over 0.5 x 0.29 m = 2000 px/m), drawn and hit-tested in the same pixel coordinates.
const BODY = [0.52, 0.05, 0.31] as const
const FACE = { w: 0.5, h: 0.29, pw: 1000, ph: 580 }
const N = 8
const SEGS = 14
const clamp = (v: number) => Math.min(1, Math.max(0, v))
const faderDb = (v: number) => (v < 0.01 ? -60 : Math.max(-60, Math.min(6, 40 * Math.log10(v / 0.8)))) // 0.8 = unity
const DEFAULT_LABELS = "CH1,CH2,CH3,CH4,CH5,CH6,CH7,CH8"

// Palette + fonts (DESIGN.md tokens).
const K = { bg: "#0B0C10", border: "#242833", text: "#EEF0F4", muted: "#9AA0AD", accent: "#9FE7D2", warm: "#F2B48A" }
const FM = '"JetBrains Mono", ui-monospace, Menlo, monospace'

// Canvas layout (px).
const sx = (i: number) => 40 + i * 95 // strip left edge
const FADER = { y0: 230, travel: 278 } // channel cap top at v = 1 and its travel
const MAIN = { y0: 300, travel: 194 }
const TEMPO = { x: 900, y: 150, r: 52 }
const capY = (v: number) => FADER.y0 + (1 - v) * FADER.travel
const mainY = (v: number) => MAIN.y0 + (1 - v) * MAIN.travel

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
function box(g: G, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string) {
  rr(g, x, y, w, h, r)
  if (fill) {
    g.fillStyle = fill
    g.fill()
  }
  if (stroke) {
    g.strokeStyle = stroke
    g.lineWidth = 2
    g.stroke()
  }
}
function txt(g: G, s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = "left") {
  g.font = font
  g.fillStyle = color
  g.textAlign = align
  g.textBaseline = "middle"
  g.fillText(s, x, y)
}
function dot(g: G, x: number, y: number, r: number, c: string) {
  g.fillStyle = c
  g.beginPath()
  g.arc(x, y, r, 0, Math.PI * 2)
  g.fill()
}
function knob(g: G, x: number, y: number, r: number, v: number, ring = K.accent) {
  const a = Math.PI * (0.75 + 1.5 * v)
  dot(g, x, y, r, "#2b303b")
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

type FaceState = { vals: number[]; mutes: boolean[]; solos: boolean[]; knobs: number[]; main: number; bpm: number; labels: string[]; lit: number[] }

function drawConsole(g: G, s: FaceState) {
  const { pw: W, ph: H } = FACE
  g.fillStyle = "#181b22"
  g.fillRect(0, 0, W, H)
  for (let i = 0; i < N; i++) {
    const x = sx(i)
    box(g, x, 20, 80, H - 40, 10, "#1f232c")
    knob(g, x + 40, 70, 22, s.knobs[i * 2])
    knob(g, x + 40, 136, 18, s.knobs[i * 2 + 1])
    box(g, x + 14, 180, 24, 18, 4, s.mutes[i] ? K.warm : "#2b303b")
    box(g, x + 42, 180, 24, 18, 4, s.solos[i] ? K.accent : "#2b303b")
    box(g, x + 27, 230, 6, 300, 3, K.bg)
    box(g, x + 12, capY(s.vals[i]), 36, 22, 4, K.text)
    for (let k = 0; k < SEGS; k++) {
      g.fillStyle = k < s.lit[i] ? (k > 11 ? K.warm : K.accent) : "#262a33"
      g.fillRect(x + 58, 520 - k * 20, 10, 14)
    }
    txt(g, (s.labels[i] ?? `CH${i + 1}`).slice(0, 7).toUpperCase(), x + 40, H - 34, `600 16px ${FM}`, K.muted, "center")
  }
  box(g, 820, 20, 160, H - 40, 12, "#20242e", K.warm)
  knob(g, TEMPO.x, TEMPO.y, TEMPO.r, (s.bpm - 60) / 120, K.warm)
  txt(g, "TEMPO", 900, 232, `700 22px ${FM}`, K.warm, "center")
  txt(g, String(s.bpm), 900, 264, `600 22px ${FM}`, K.text, "center")
  box(g, 896, 300, 8, 220, 4, K.bg)
  box(g, 876, mainY(s.main), 48, 26, 5, K.warm)
}

type Hit = { kind: "fader" | "mute" | "solo" | "knob"; i: number } | { kind: "main" | "tempo"; i: 0 }

/** Same rectangles as the drawing, padded for fingertips. */
function hitTest(x: number, y: number): Hit | null {
  if (y < 0 || y > FACE.ph) return null
  if (x >= 812) {
    if (Math.hypot(x - TEMPO.x, y - TEMPO.y) < TEMPO.r + 22) return { kind: "tempo", i: 0 }
    if (x > 856 && x < 944 && y > 285) return { kind: "main", i: 0 }
    return null
  }
  const i = Math.floor((x - 32) / 95)
  if (i < 0 || i >= N) return null
  const lx = x - sx(i)
  if (y < 103) return { kind: "knob", i: i * 2 }
  if (y < 162) return { kind: "knob", i: i * 2 + 1 }
  if (y < 216) return { kind: lx < 40 ? "mute" : "solo", i }
  return { kind: "fader", i }
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

/**
 * 8-channel mixing console: per channel two knobs, MUTE (warm) and SOLO (mint) buttons, a fader and a live level meter;
 * a TEMPO knob and MAIN fader in the master section. `values` (8 numbers, 0-1) and `muted` are controlled-or-uncontrolled.
 * Channel n's fader + mute drive the shared mixer bus channel n (`globalThis.__spatialMixer`), and its meter shows that channel's level.
 * The TEMPO knob sets the shared Tone transport BPM; MAIN sets the real master volume.
 */
export default function MixingConsole({
  values,
  onChange,
  muted,
  onMuteChange,
  master,
  onMasterChange,
  labels = DEFAULT_LABELS,
  tempo,
  onTempoChange,
  tilt = 0.28,
}: {
  values?: number[]
  onChange?: (values: number[]) => void
  muted?: boolean[]
  onMuteChange?: (muted: boolean[]) => void
  /** MAIN fader 0-1 (0.8 = unity gain). Moves the real master output. */
  master?: number
  onMasterChange?: (v: number) => void
  /** Comma-separated channel names */
  labels?: string
  /** BPM 60-180. Also sets the shared Tone transport tempo. */
  tempo?: number
  onTempoChange?: (bpm: number) => void
  /** Tilt toward the user, radians (applied around local X). */
  tilt?: number
}) {
  const env = useRoomEnv()
  const gl = useThree((s) => s.gl)
  const [innerVals, setInnerVals] = useState(() => [0.8, 0.72, 0.6, 0.65, 0.78, 0.55, 0.7, 0.5])
  const [innerMute, setInnerMute] = useState(() => Array<boolean>(N).fill(false))
  const [solos, setSolos] = useState(() => Array<boolean>(N).fill(false))
  const [knobs, setKnobs] = useState(() => Array.from({ length: N * 2 }, (_, k) => (k % 2 ? ((k >> 1) * 0.61 + 0.2) % 1 : ((k >> 1) * 0.37) % 1)))
  const [innerMaster, setInnerMaster] = useState(0.8)
  const vals = Array.from({ length: N }, (_, i) => clamp(values?.[i] ?? innerVals[i]))
  const mutes = Array.from({ length: N }, (_, i) => muted?.[i] ?? innerMute[i])
  const main = clamp(master ?? innerMaster)

  const setVal = (i: number, v: number) => {
    if (v === vals[i]) return
    const next = vals.slice()
    next[i] = v
    if (values === undefined) setInnerVals(next)
    onChange?.(next)
  }
  const toggleMute = (i: number) => {
    const next = mutes.slice()
    next[i] = !next[i]
    if (muted === undefined) setInnerMute(next)
    onMuteChange?.(next)
  }
  // Only touch the global output once someone moves MAIN (or binds it), so placing a console never changes the room's volume.
  const touched = useRef(master !== undefined)
  const setMain = (v: number) => {
    if (v === main) return
    touched.current = true
    if (master === undefined) setInnerMaster(v)
    onMasterChange?.(v)
  }
  useEffect(() => {
    if (!touched.current && master === undefined) return
    const d = Tone.getDestination()
    if (main < 0.01) d.volume.rampTo(-80, 0.05)
    else d.volume.rampTo(Math.min(6, 40 * Math.log10(main / 0.8)), 0.05)
  }, [main, master])

  // Faders + mutes (and solo: any soloed channel silences the others) drive the shared mixer bus.
  const volKey = vals.join()
  const muteKey = mutes.join() + solos.join()
  useEffect(() => {
    const anySolo = solos.some(Boolean)
    vals.forEach((v, i) => {
      const ch = mixerChannel(i + 1)
      ch.volume.rampTo(faderDb(v), 0.05)
      ch.mute = mutes[i] || (anySolo && !solos[i])
    })
  }, [volKey, muteKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // TEMPO: controlled by `tempo`, else local; only writes the transport once bound or turned, so placing a console keeps the room's tempo.
  const [innerTempo, setInnerTempo] = useState(() => Math.round(Tone.getTransport().bpm.value))
  const bpm = Math.min(180, Math.max(60, Math.round(tempo ?? innerTempo)))
  const tempoTouched = useRef(tempo !== undefined)
  const setTempo = (b: number) => {
    if (b === bpm) return
    tempoTouched.current = true
    if (tempo === undefined) setInnerTempo(b)
    onTempoChange?.(b)
  }
  useEffect(() => {
    if (tempoTouched.current || tempo !== undefined) Tone.getTransport().bpm.value = bpm
  }, [bpm, tempo])

  // Face canvas: redrawn on any state change, and by the meters at most 20 fps when a level moves.
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
  const lit = useRef(Array<number>(N).fill(0))
  const state = useRef<FaceState>(null!)
  state.current = { vals, mutes, solos, knobs, main, bpm, labels: labels.split(",").map((s) => s.trim()), lit: lit.current }
  const redraw = () => {
    drawConsole(face.g, state.current)
    face.tex.needsUpdate = true
  }
  useEffect(redraw)
  useEffect(() => void document.fonts?.ready.then(redraw), []) // eslint-disable-line react-hooks/exhaustive-deps

  const nextMeter = useRef(0)
  useFrame(({ clock }) => {
    const now = clock.elapsedTime
    if (now < nextMeter.current) return
    nextMeter.current = now + 0.05
    const bus = (globalThis as typeof globalThis & { __spatialMixer?: SpatialBus }).__spatialMixer
    let changed = false
    for (let i = 0; i < N; i++) {
      const v = bus?.meter[i + 1]?.getValue()
      const lvl = typeof v === "number" ? v : 0
      const n = lvl > 0 ? Math.round(clamp((Tone.gainToDb(lvl) + 48) / 48) * SEGS) : 0
      if (n !== lit.current[i]) {
        lit.current[i] = n
        changed = true
      }
    }
    if (changed) redraw()
  })

  // Pointer: one face plane, hit-tested in canvas px. Drags are relative to where they start, so grabbing near a cap never jumps it.
  const faceMesh = useRef<THREE.Mesh>(null)
  const drags = useRef(new Map<number, { hit: Hit; x: number; y: number; v: number }>())
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    const [x, y] = toPx(e, faceMesh.current!)
    const hit = hitTest(x, y)
    if (!hit) return
    if (hit.kind === "mute") return toggleMute(hit.i)
    if (hit.kind === "solo") return setSolos((s) => s.map((on, i) => (i === hit.i ? !on : on)))
    ;(e.target as Element).setPointerCapture(e.pointerId)
    const v = { fader: vals[hit.i], knob: knobs[hit.i], main, tempo: (bpm - 60) / 120 }[hit.kind]
    drags.current.set(e.pointerId, { hit, x, y, v })
  }
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drags.current.get(e.pointerId)
    if (!d) return
    const [x, y] = toPx(e, faceMesh.current!)
    const { hit } = d
    if (hit.kind === "fader") setVal(hit.i, clamp(d.v - (y - d.y) / FADER.travel))
    else if (hit.kind === "main") setMain(clamp(d.v - (y - d.y) / MAIN.travel))
    else {
      const t = clamp(d.v + (d.y - y + x - d.x) / (hit.kind === "tempo" ? 240 : 160)) // up or right = more
      if (hit.kind === "tempo") setTempo(Math.round(60 + t * 120))
      else setKnobs((k) => (k[hit.i] === t ? k : k.map((o, j) => (j === hit.i ? t : o))))
    }
  }
  const onUp = (e: ThreeEvent<PointerEvent>) => void drags.current.delete(e.pointerId)

  return (
    <group rotation={[tilt, 0, 0]}>
      <mesh>
        <boxGeometry args={BODY} />
        <meshStandardMaterial color="#1a1d25" roughness={0.55} metalness={0.15} envMap={env} envMapIntensity={0.6} />
      </mesh>
      <mesh
        ref={faceMesh}
        position={[0, BODY[1] / 2 + 0.0005, 0]}
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
  )
}
