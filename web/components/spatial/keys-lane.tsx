"use client"

import { useEffect, useRef, useState } from "react"
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { CanvasTexture, SRGBColorSpace } from "three"
import * as Tone from "tone"

// The Night Set palette (mockup `K`), plus the piano-key fills.
const K = { bg: "#0B0C10", surface: "#15171E", surface2: "#1C1F28", border: "#242833", text: "#EEF0F4", muted: "#9AA0AD", accent: "#9FE7D2", warm: "#F2B48A", blue: "#3B82F6", white: "#2b303b", black: "#111318" }

// Panel: 520 x 720 px at 1 mm per px = 0.52 x 0.72 m. Origin = centre, front faces +Z.
const PX = 0.001
const W = 520
const H = 720
const S = 2 // canvas pixels per panel pixel (2x the mockup's 520 x 720 for crisp text); animated repaints are capped at 30 fps
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace'
const FRAME_MS = 1000 / 30

// Piano roll: 12 pitch rows (C at the top, like the mockup) x 8 eighth notes = 1 bar, spanning the mockup's 72-504 px.
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const BLACK = [1, 3, 6, 8, 10]
const FLAT: Record<string, string> = { DB: "C#", EB: "D#", GB: "F#", AB: "G#", BB: "A#" }
const STEPS = 8
const ROW_Y = 96
const ROW_H = 44
const STEP_X = 72
const STEP_W = 54

type Rect = { x: number; y: number; w: number; h: number }
const inside = (b: Rect | undefined, x: number, y: number, pad = 8) => !!b && x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad

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

// Canvas helpers, as in the mockup.
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
type Chip = { label: string; on?: boolean; rec?: boolean }
/** Header-right pills in the mockup's `chips` style (active = accent fill), right-aligned to the panel margin. Returns their rects. */
function chips(g: G, list: Chip[], fm: string): Rect[] {
  const f = `600 22px ${fm}`
  const h = 48
  const y = 19
  g.font = f
  let x = W - 22
  const out: Rect[] = []
  for (let i = list.length - 1; i >= 0; i--) {
    const c = list[i]
    const ic = c.rec ? 22 : 0
    const w = g.measureText(c.label).width + 36 + ic
    x -= w
    box(g, x, y, w, h, h / 2, c.on ? K.accent : K.surface2, c.on ? undefined : K.border)
    if (c.rec) dot(g, x + 24, y + h / 2, 7, c.on ? K.bg : K.muted)
    txt(g, c.label, x + 18 + ic, y + h / 2 + 1, f, c.on ? K.bg : K.text)
    out.unshift({ x, y, w, h })
    x -= 10
  }
  return out
}

/** The page's JetBrains Mono (next/font sets --font-jetbrains-mono), else any installed mono. */
function monoFamily() {
  const v = typeof document === "undefined" ? "" : getComputedStyle(document.body).getPropertyValue("--font-jetbrains-mono").trim()
  return v ? `${v}, ${MONO}` : MONO
}
/** A transparent canvas texture for the panel face; `fontGen` bumps when the mono font finishes loading. */
function usePanelCanvas() {
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())
  const [p] = useState(() => {
    const canvas = document.createElement("canvas")
    canvas.width = W * S
    canvas.height = H * S
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    return { canvas, tex, fm: monoFamily() }
  })
  useEffect(() => {
    p.tex.anisotropy = maxAniso
    p.tex.needsUpdate = true
  }, [p, maxAniso])
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

type Face = { notes: Note[]; rec: boolean; head: number; lit: Float32Array }

/** The mockup's keys lane, drawn from live state. `head` = playhead in steps, or < 0 when stopped. Returns the [REC, CLEAR] chip rects. */
function paint(g: G, fm: string, f: Face) {
  g.setTransform(S, 0, 0, S, 0, 0)
  g.clearRect(0, 0, W, H)
  box(g, 2, 2, W - 4, H - 4, 24, K.surface, K.border)
  box(g, 22, 22, 8, 40, 4, K.warm)
  txt(g, "LANE 1 · KEYS", 42, 43, `700 26px ${fm}`, K.text)
  const rects = chips(g, [{ label: "REC", on: f.rec, rec: true }, { label: "CLEAR" }], fm)
  for (let r = 0; r < 12; r++) {
    const y = ROW_Y + r * ROW_H
    g.fillStyle = BLACK.includes(r) ? K.black : K.white
    g.fillRect(22, y, 40, 40)
    g.fillStyle = K.border
    g.fillRect(70, y + 42, W - 92, 2)
  }
  // Notes at octave 3 and below in accent, higher in warm (the mockup's two note colours).
  for (const n of f.notes) box(g, STEP_X + n.start * STEP_W, ROW_Y + 2 + n.pc * ROW_H, Math.min(n.len, STEPS - n.start) * STEP_W - 6, 36, 6, n.oct <= 3 ? K.accent : K.warm)
  // Held / just-played keys glow across their row.
  g.globalCompositeOperation = "lighter"
  g.fillStyle = K.warm
  for (let pc = 0; pc < 12; pc++) {
    if (f.lit[pc] <= 0) continue
    g.globalAlpha = 0.32 * f.lit[pc]
    g.fillRect(20, ROW_Y + pc * ROW_H - 1, W - 40, 42)
  }
  g.globalAlpha = 1
  g.globalCompositeOperation = "source-over"
  if (f.head >= 0) {
    const x = STEP_X - 3 + f.head * STEP_W
    g.fillStyle = K.accent
    g.globalAlpha = 0.18
    g.fillRect(x - 7, ROW_Y - 4, 14, 12 * ROW_H + 8)
    g.globalAlpha = 1
    g.fillRect(x - 1.5, ROW_Y - 4, 3, 12 * ROW_H + 8)
  }
  txt(g, "⇠ synth-keys", W / 2, 664, `500 20px ${fm}`, K.warm, "center")
  return rects
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
  const painted = useRef({ head: -1, at: 0 })
  const rects = useRef<Rect[]>([])
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

  // Notes, REC and font changes repaint at once; the playhead and key glow repaint from useFrame.
  useEffect(() => {
    const g = canvas.getContext("2d")
    if (!g) return
    rects.current = paint(g, fm, { notes, rec, head: painted.current.head, lit: lit.current })
    tex.needsUpdate = true
  }, [canvas, tex, fm, fontGen, notes, rec])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const t = Tone.getTransport()
    const head = t.state === "started" ? (t.getTicksAtTime(Tone.immediate()) / (t.PPQ / 2)) % STEPS : -1
    let glowing = false
    for (let pc = 0; pc < 12; pc++) {
      const v = lit.current[pc]
      lit.current[pc] = down.current[pc] ? Math.max(0.6, v - dt * 1.5) : Math.max(0, v - dt * 3)
      if (v > 0) glowing = true
    }
    const now = performance.now()
    const moved = head !== painted.current.head
    if (!(moved || glowing) || now - painted.current.at < FRAME_MS) return
    const g = canvas.getContext("2d")
    if (!g) return
    const l = latest.current
    rects.current = paint(g, fm, { notes: l.notes, rec: l.rec, head, lit: lit.current })
    painted.current = { head, at: now }
    tex.needsUpdate = true
  })

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    void Tone.start() // browsers stay silent until a user gesture resumes audio
    const p = e.eventObject.worldToLocal(e.point.clone())
    const x = p.x / PX + W / 2
    const y = H / 2 - p.y / PX
    const [recRect, clrRect] = rects.current
    if (inside(recRect, x, y, 5)) return setRec(!latest.current.rec)
    if (inside(clrRect, x, y, 5)) return held.current.clear(), update([])
    const s = Math.floor((x - STEP_X) / STEP_W)
    const pc = Math.floor((y - ROW_Y) / ROW_H)
    if (s < 0 || s >= STEPS || pc < 0 || pc > 11) return
    // Tap a cell to add a 1-step note (octave 4), tap a note to remove it.
    const cur = latest.current.notes
    const hit = cur.find((n) => n.pc === pc && s >= n.start && s < n.start + n.len)
    update(hit ? cur.filter((n) => n !== hit) : [...cur, { id: nextId.current++, pc, oct: 4, start: s, len: 1, vel: 0.8 }])
  }

  return (
    <mesh onClick={onClick}>
      <planeGeometry args={[W * PX, H * PX]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  )
}
