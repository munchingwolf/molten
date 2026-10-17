"use client"

import { useEffect, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { AdditiveBlending, CanvasTexture, SRGBColorSpace, type Group, type MeshBasicMaterial } from "three"
import * as Tone from "tone"

const C = { surface: "#15171E", surface2: "#1C1F28", border: "#242833", white: "#2B303B", black: "#111318", text: "#EEF0F4", muted: "#9AA0AD", mint: "#9FE7D2", warm: "#F2B48A", rec: "#F87171" }

// Panel: 520 x 720 px at 1 mm per px = 0.52 x 0.72 m. Origin = centre, front faces +Z.
const PX = 0.001
const W = 520
const H = 720
const S = 2 // canvas pixels per panel pixel
const MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace'
const at = (x: number, y: number, z = 0.001): [number, number, number] => [(x - W / 2) * PX, (H / 2 - y) * PX, z]
const noHit = () => null // overlays must not swallow pointer events meant for the panel

// Piano roll: 12 pitch rows (C at the top, like the mockup) x 8 eighth notes = 1 bar.
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const BLACK = [1, 3, 6, 8, 10]
const FLAT: Record<string, string> = { DB: "C#", EB: "D#", GB: "F#", AB: "G#", BB: "A#" }
const STEPS = 8
const ROW_Y = 96
const ROW_H = 44
const STEP_X = 72
const STEP_W = 53
const REC = { x: 290, y: 19, w: 96, h: 48 }
const CLR = { x: 396, y: 19, w: 102, h: 48 }
const inside = (b: { x: number; y: number; w: number; h: number }, x: number, y: number) => x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4

type Note = { id: number; pc: number; oct: number; start: number; len: number; vel: number }

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

/** "D#4:on:0.8:12" -> parts; null if malformed. */
function parse(msg: string) {
  const [name, kind, vel] = msg.split(":")
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(name?.trim() ?? "")
  if (!m || (kind !== "on" && kind !== "off")) return null
  const letter = (m[1] + m[2]).toUpperCase()
  const pc = NAMES.indexOf(FLAT[letter] ?? letter)
  if (pc < 0) return null
  const v = Number(vel)
  return { pc, oct: Number(m[3]), on: kind === "on", vel: Number.isFinite(v) && v > 0 ? Math.min(1, v > 1 ? v / 127 : v) : 0.8 }
}

function box(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string) {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
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
function txt(g: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = "left") {
  g.font = font
  g.fillStyle = color
  g.textAlign = align
  g.textBaseline = "middle"
  g.fillText(s, x, y)
}
/** The page's JetBrains Mono (next/font sets --font-jetbrains-mono), else any installed mono. */
function monoFamily() {
  const v = typeof document === "undefined" ? "" : getComputedStyle(document.body).getPropertyValue("--font-jetbrains-mono").trim()
  return v ? `${v}, ${MONO}` : MONO
}
/** A canvas-backed texture for the panel face, redrawn when fonts finish loading. */
function usePanelCanvas() {
  const [p] = useState(() => {
    const canvas = document.createElement("canvas")
    canvas.width = W * S
    canvas.height = H * S
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    tex.anisotropy = 8
    return { canvas, tex, fm: monoFamily() }
  })
  const [fontGen, setFontGen] = useState(0)
  useEffect(() => {
    let live = true
    document.fonts
      ?.load(`700 26px ${p.fm}`)
      .then(() => live && setFontGen((n) => n + 1))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [p.fm])
  useEffect(() => () => p.tex.dispose(), [p])
  return { ...p, fontGen }
}

type Props = {
  /** Latest synth-keys message: "<note>:on:<vel>:<seq>" or "<note>:off:0:<seq>". Lights the row; with REC on while playing, records. */
  note?: string
  /** Mixer channel on the Spatial bus (default 2 = KEYS). */
  channel?: number
}

/** Track-wall keys lane: one-bar piano roll on the global transport that records synth-keys notes and loops them on a soft saw pad. */
export default function KeysLane({ note, channel }: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [rec, setRec] = useState(true)
  const latest = useRef({ notes, rec })
  const nextId = useRef(1)
  const skip = useRef(new Map<number, number>()) // note id -> absolute 8th it was recorded on (already heard live)
  const held = useRef(new Map<string, { id: number; abs: number }>()) // recording in progress, by note name
  const lit = useRef(new Float32Array(12)) // live glow per pitch row
  const down = useRef(new Uint8Array(12)) // keys currently held per pitch row
  const lastNote = useRef(note)
  const head = useRef<Group>(null)
  const glows = useRef<(MeshBasicMaterial | null)[]>([])
  const { canvas, tex, fm, fontGen } = usePanelCanvas()
  const ch = Number.isFinite(channel) ? Math.round(channel as number) : 2

  useEffect(() => {
    latest.current = { notes, rec }
  })

  const update = (next: Note[]) => {
    latest.current.notes = next
    setNotes(next)
  }

  useEffect(() => {
    const filter = new Tone.Filter({ type: "lowpass", frequency: 1800, Q: 0.4 }).connect(mixerChannel(ch))
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fatsawtooth", count: 3, spread: 18 },
      envelope: { attack: 0.03, decay: 0.3, sustain: 0.55, release: 0.7 },
      volume: -16,
    }).connect(filter)
    const t = Tone.getTransport()
    const id = t.scheduleRepeat((time) => {
      const abs = Math.round(t.getTicksAtTime(time) / (t.PPQ / 2))
      const s = abs % STEPS
      const eighth = Tone.Time("8n").toSeconds()
      for (const n of latest.current.notes)
        if (n.start === s && skip.current.get(n.id) !== abs)
          synth.triggerAttackRelease(`${NAMES[n.pc]}${n.oct}`, n.len * eighth * 0.95, Math.max(time, Tone.immediate() + 0.005), n.vel)
    }, "8n")
    return () => {
      t.clear(id)
      synth.dispose()
      filter.dispose()
    }
  }, [ch])

  useEffect(() => {
    if (!note || note === lastNote.current) return
    lastNote.current = note
    const p = parse(note)
    if (!p) return
    const key = `${NAMES[p.pc]}${p.oct}`
    down.current[p.pc] = p.on ? Math.min(9, down.current[p.pc] + 1) : Math.max(0, down.current[p.pc] - 1)
    if (p.on) lit.current[p.pc] = 1
    const t = Tone.getTransport()
    const q = t.PPQ / 2
    const ticks = t.getTicksAtTime(Tone.immediate()) // what the player hears now, without the scheduler's lookahead
    if (!p.on) {
      const h = held.current.get(key)
      held.current.delete(key)
      if (!h) return
      const len = Math.min(STEPS, Math.max(1, Math.round(ticks / q - h.abs)))
      update(latest.current.notes.map((n) => (n.id === h.id ? { ...n, len } : n)))
      return
    }
    if (!latest.current.rec || t.state !== "started") return
    const abs = Math.round(ticks / q)
    const start = abs % STEPS
    const n = { id: nextId.current++, pc: p.pc, oct: p.oct, start, len: 1, vel: p.vel }
    skip.current.set(n.id, abs)
    held.current.set(key, { id: n.id, abs })
    update([...latest.current.notes.filter((o) => !(o.pc === n.pc && o.oct === n.oct && o.start === start)), n])
  }, [note])

  useEffect(() => {
    const g = canvas.getContext("2d")
    if (!g) return
    g.setTransform(S, 0, 0, S, 0, 0)
    g.clearRect(0, 0, W, H)
    box(g, 2, 2, W - 4, H - 4, 24, C.surface, C.border)
    box(g, 22, 22, 8, 40, 4, C.warm)
    txt(g, "LANE 1 - KEYS", 42, 43, `700 26px ${fm}`, C.text)
    box(g, REC.x, REC.y, REC.w, REC.h, REC.h / 2, C.surface2, rec ? C.rec : C.border)
    g.fillStyle = rec ? C.rec : C.muted
    g.beginPath()
    g.arc(REC.x + 26, REC.y + REC.h / 2, 7, 0, Math.PI * 2)
    g.fill()
    txt(g, "REC", REC.x + 42, REC.y + REC.h / 2 + 1, `600 18px ${fm}`, rec ? C.text : C.muted)
    box(g, CLR.x, CLR.y, CLR.w, CLR.h, CLR.h / 2, C.surface2, C.border)
    txt(g, "CLEAR", CLR.x + CLR.w / 2, CLR.y + CLR.h / 2 + 1, `600 18px ${fm}`, C.text, "center")
    for (let r = 0; r < 12; r++) {
      const y = ROW_Y + r * ROW_H
      g.fillStyle = BLACK.includes(r) ? C.black : C.white
      g.fillRect(22, y, 40, 40)
      g.fillStyle = C.border
      g.fillRect(70, y + 42, W - 92, 2)
    }
    for (const n of notes)
      box(g, STEP_X + n.start * STEP_W, ROW_Y + 2 + n.pc * ROW_H, Math.min(n.len, STEPS - n.start) * STEP_W - 6, 36, 6, n.oct <= 3 ? C.mint : C.warm)
    txt(g, "<- synth-keys", W / 2, 664, `500 20px ${fm}`, C.warm, "center")
    tex.needsUpdate = true
  }, [canvas, tex, fm, fontGen, notes, rec])

  useFrame((_, dt) => {
    const t = Tone.getTransport()
    const g = head.current
    if (g) {
      g.visible = t.state === "started"
      if (g.visible) {
        const pos = (t.getTicksAtTime(Tone.immediate()) / (t.PPQ / 2)) % STEPS
        g.position.x = (STEP_X - 3 + pos * STEP_W - W / 2) * PX
      }
    }
    for (let pc = 0; pc < 12; pc++) {
      lit.current[pc] = down.current[pc] ? Math.max(0.6, lit.current[pc] - dt * 1.5) : Math.max(0, lit.current[pc] - dt * 3)
      const m = glows.current[pc]
      if (m) m.opacity = 0.32 * lit.current[pc]
    }
  })

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    void Tone.start() // browsers stay silent until a user gesture resumes audio
    const p = e.eventObject.worldToLocal(e.point.clone())
    const x = p.x / PX + W / 2
    const y = H / 2 - p.y / PX
    if (inside(REC, x, y)) return setRec(!latest.current.rec)
    if (inside(CLR, x, y)) return held.current.clear(), update([])
    const s = Math.floor((x - STEP_X) / STEP_W)
    const pc = Math.floor((y - ROW_Y) / ROW_H)
    if (s < 0 || s >= STEPS || pc < 0 || pc > 11) return
    // Tap a cell to add a 1-step note (octave 4), tap a note to remove it.
    const cur = latest.current.notes
    const hit = cur.find((n) => n.pc === pc && s >= n.start && s < n.start + n.len)
    update(hit ? cur.filter((n) => n !== hit) : [...cur, { id: nextId.current++, pc, oct: 4, start: s, len: 1, vel: 0.8 }])
  }

  return (
    <group>
      <mesh onClick={onClick}>
        <planeGeometry args={[W * PX, H * PX]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>
      {NAMES.map((name, pc) => (
        <mesh key={name} raycast={noHit} position={at(W / 2, ROW_Y + pc * ROW_H + 20, 0.0015)}>
          <planeGeometry args={[(W - 40) * PX, 42 * PX]} />
          <meshBasicMaterial ref={(m) => void (glows.current[pc] = m)} color={C.warm} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      <group ref={head} visible={false} position={at(STEP_X, ROW_Y + (12 * ROW_H) / 2, 0.002)}>
        <mesh raycast={noHit}>
          <planeGeometry args={[3 * PX, (12 * ROW_H + 8) * PX]} />
          <meshBasicMaterial color={C.mint} toneMapped={false} />
        </mesh>
        <mesh raycast={noHit} position={[0, 0, -0.0003]}>
          <planeGeometry args={[14 * PX, (12 * ROW_H + 8) * PX]} />
          <meshBasicMaterial color={C.mint} transparent opacity={0.18} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}
