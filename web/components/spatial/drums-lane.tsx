"use client"

import { useEffect, useRef, useState } from "react"
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { CanvasTexture, SRGBColorSpace } from "three"
import * as Tone from "tone"

// The Night Set palette (mockup `K`), plus the playhead tint.
const K = { bg: "#0B0C10", surface: "#15171E", surface2: "#1C1F28", border: "#242833", text: "#EEF0F4", muted: "#9AA0AD", accent: "#9FE7D2", warm: "#F2B48A", blue: "#3B82F6", head: "#B9D3FF" }

// Panel: 520 x 720 px at 1 mm per px = 0.52 x 0.72 m. Origin = centre, front faces +Z.
const PX = 0.001
const W = 520
const H = 720
const S = 2 // canvas pixels per panel pixel (2x the mockup's 520 x 720 for crisp text); animated repaints are capped at 30 fps
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace'
const FRAME_MS = 1000 / 30
const FLASH_MS = 300

// 4 voices x 8 eighth-note steps (1 bar). Cells 52 x 72 px = 5.2 x 7.2 cm.
const STEPS = 8
const cellX = (s: number) => 24 + s * 60
const cellY = (r: number) => 136 + r * 128

type Rect = { x: number; y: number; w: number; h: number }
const inside = (b: Rect | undefined, x: number, y: number, pad = 8) => !!b && x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad

const LABELS = ["KICK", "SNARE", "HAT", "CLAP"]
const VOICES = ["kick", "snare", "hat", "clap"]
/** Incoming drum-pad voices folded onto the 4 rows; anything else is ignored. */
const ROW_OF: Record<string, number> = { kick: 0, snare: 1, rim: 1, hat: 2, openhat: 2, clap: 3 }
const DEFAULT = [0, 1, 2, 3].map((r) => Array.from({ length: STEPS }, (_, i) => (r === 0 ? i % 2 === 0 : r === 1 ? i === 2 || i === 6 : r === 2 ? true : i === 6)))

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

function makeKit(out: Tone.InputNode) {
  const bus = new Tone.Volume(-2).connect(out)
  const kick = new Tone.MembraneSynth({ pitchDecay: 0.045, octaves: 7, envelope: { attack: 0.001, decay: 0.42, sustain: 0, release: 0.05 } }).connect(bus)
  const snF = new Tone.Filter({ type: "highpass", frequency: 1500 }).connect(bus)
  const snN = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.16, sustain: 0 }, volume: -6 }).connect(snF)
  const snB = new Tone.MembraneSynth({ pitchDecay: 0.015, octaves: 3, envelope: { attack: 0.001, decay: 0.12, sustain: 0 }, volume: -8 }).connect(bus)
  const hatF = new Tone.Filter({ type: "highpass", frequency: 8000 }).connect(bus)
  const hat = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.045, sustain: 0 }, volume: -12 }).connect(hatF)
  const clF = new Tone.Filter({ type: "bandpass", frequency: 1300, Q: 1.2 }).connect(bus)
  const cl = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.15, sustain: 0 }, volume: 0 }).connect(clF)
  const hits = [
    (t: number) => kick.triggerAttackRelease("C1", "8n", t),
    (t: number) => (snN.triggerAttackRelease(0.12, t), snB.triggerAttackRelease("G2", 0.08, t)),
    (t: number) => hat.triggerAttackRelease(0.03, t),
    // Three quick bursts then the tail: the classic hand-clap smear.
    (t: number) => [0, 0.011, 0.022].forEach((d) => cl.triggerAttackRelease(0.008, t + d)),
  ]
  return {
    hit: (r: number, time: number) => {
      // A late callback (busy main thread) gets clamped to "now"; keep start times strictly increasing.
      const t = Math.max(time, Tone.immediate() + 0.005)
      try {
        hits[r]?.(t)
      } catch {
        // shortcut: a voice still sounding past its previous start drops this hit instead of throwing out of the scheduler
      }
    },
    dispose: () => [kick, snN, snB, snF, hat, hatF, cl, clF, bus].forEach((n) => n.dispose()),
  }
}

const copyGrid = (g: boolean[][] | undefined) => [0, 1, 2, 3].map((r) => Array.from({ length: STEPS }, (_, i) => !!g?.[r]?.[i]))

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

const fade = (fl: { at: number; v: number }[], now: number) => fl.map((f) => f.v * Math.max(0, 1 - (now - f.at) / FLASH_MS))

type Face = { grid: boolean[][]; rec: boolean; step: number; flash: number[] }

/** The mockup's drums lane, drawn from live state. Returns the [REC, CLEAR] chip rects. */
function paint(g: G, fm: string, f: Face) {
  g.setTransform(S, 0, 0, S, 0, 0)
  g.clearRect(0, 0, W, H)
  box(g, 2, 2, W - 4, H - 4, 24, K.surface, K.border)
  box(g, 22, 22, 8, 40, 4, K.blue)
  txt(g, "LANE 3 · DRUMS", 42, 43, `700 26px ${fm}`, K.text)
  const rects = chips(g, [{ label: "REC", on: f.rec, rec: true }, { label: "CLEAR" }], fm)
  LABELS.forEach((name, r) => {
    txt(g, name, 24, 116 + r * 128, `600 18px ${fm}`, K.muted)
    for (let s = 0; s < STEPS; s++) {
      const on = !!f.grid[r]?.[s]
      box(g, cellX(s), cellY(r), 52, 72, 8, on ? K.blue : K.surface2, on ? undefined : K.border)
    }
    // A pad hit washes its row in blue, fading over FLASH_MS.
    if (f.flash[r] > 0) {
      g.globalCompositeOperation = "lighter"
      g.globalAlpha = 0.35 * f.flash[r]
      box(g, 16, cellY(r) - 22, W - 32, 116, 12, K.blue)
      g.globalAlpha = 1
      g.globalCompositeOperation = "source-over"
    }
  })
  if (f.step >= 0) {
    // Playhead: a ring around the current column's cells.
    g.lineWidth = 3
    g.strokeStyle = K.head
    for (let r = 0; r < 4; r++) {
      rr(g, cellX(f.step) - 3.5, cellY(r) - 3.5, 59, 79, 11)
      g.stroke()
    }
  }
  txt(g, "⇠ drum-pads", W / 2, 664, `500 20px ${fm}`, K.blue, "center")
  return rects
}

type Props = {
  /** Latest drum-pad hit, "<voice>:<velocity>:<seq>". Each new value flashes its row and, with REC on while playing, records it. */
  hit?: string
  /** 4 x 8 grid (kick, snare, hat, clap; eighth notes). Controlled with onStepsChange, or uncontrolled. */
  steps?: boolean[][]
  onStepsChange?: (steps: boolean[][]) => void
  /** Mixer channel on the Spatial bus (default 1 = DRUMS). */
  channel?: number
  /** Base URL of a sample kit (e.g. "/sounds/night-kit" with kit.json + <voice>.mp3). Unset = pure synth. */
  samples?: string
}

/** Track-wall drum lane: a 4 x 8 step grid on the global transport with live-recording from drum pads. */
export default function DrumsLane({ hit, steps, onStepsChange, channel, samples }: Props) {
  const [inner, setInner] = useState(DEFAULT)
  const [rec, setRec] = useState(true)
  const grid = steps ?? inner
  const latest = useRef({ grid, rec, steps, onStepsChange })
  const step = useRef(-1)
  const flash = useRef([0, 0, 0, 0].map(() => ({ at: -1e9, v: 1 })))
  const skip = useRef([-1, -1, -1, -1]) // absolute 8th just recorded per row: already heard live, so don't double it
  const lastHit = useRef(hit)
  const painted = useRef({ step: -1, at: 0 })
  const rects = useRef<Rect[]>([])
  const { canvas, tex, fm, fontGen } = usePanelCanvas()
  const ch = Number.isFinite(channel) ? Math.round(channel as number) : 1

  useEffect(() => {
    latest.current = { grid, rec, steps, onStepsChange }
  })

  const commit = (next: boolean[][]) => {
    const l = latest.current
    l.grid = next
    if (l.steps === undefined) setInner(next)
    l.onStepsChange?.(next)
  }

  useEffect(() => {
    const out = mixerChannel(ch)
    const kit = makeKit(out)
    // Optional sample kit: `${samples}/kit.json` lists its voices; rows it lacks (or that fail to load) stay synthesized.
    const players: (Tone.Player | null)[] = [null, null, null, null]
    const loading: Tone.Player[] = []
    let live = true
    if (samples) {
      const base = samples.replace(/\/+$/, "")
      fetch(`${base}/kit.json`)
        .then((res) => (res.ok ? res.json() : null))
        .then((k: { voices?: unknown; format?: unknown } | null) => {
          const voices = live && Array.isArray(k?.voices) ? (k.voices as unknown[]) : []
          const fmt = typeof k?.format === "string" ? k.format : "mp3"
          VOICES.forEach((v, r) => {
            if (!voices.includes(v)) return
            const p: Tone.Player = new Tone.Player({ url: `${base}/${v}.${fmt}`, volume: -3, onload: () => live && (players[r] = p), onerror: () => {} }).connect(out)
            loading.push(p)
          })
        })
        .catch(() => {})
    }
    const play = (r: number, time: number) => {
      const p = players[r]
      if (!p) return kit.hit(r, time)
      try {
        p.start(Math.max(time, Tone.immediate() + 0.005))
      } catch {
        kit.hit(r, time)
      }
    }
    const t = Tone.getTransport()
    const id = t.scheduleRepeat((time) => {
      // Step from the transport position, so every lane stays on the same grid.
      const abs = Math.round(t.getTicksAtTime(time) / (t.PPQ / 2))
      const s = abs % STEPS
      latest.current.grid.forEach((row, r) => row[s] && skip.current[r] !== abs && play(r, time))
      Tone.getDraw().schedule(() => (step.current = s), time)
    }, "8n")
    const reset = () => (step.current = -1)
    t.on("stop", reset)
    t.on("pause", reset)
    return () => {
      live = false
      t.clear(id)
      t.off("stop", reset)
      t.off("pause", reset)
      kit.dispose()
      loading.forEach((p) => p.dispose())
    }
  }, [ch, samples])

  useEffect(() => {
    if (!hit || hit === lastHit.current) return
    lastHit.current = hit
    const [voice, vel] = hit.split(":")
    const r = ROW_OF[voice?.trim().toLowerCase() ?? ""]
    if (r === undefined) return
    const v = Number(vel)
    flash.current[r] = { at: performance.now(), v: Number.isFinite(v) && v > 0 ? Math.min(1, v > 1 ? v / 127 : v) : 1 }
    const t = Tone.getTransport()
    if (!latest.current.rec || t.state !== "started") return
    // Quantize to the 8th the player is hearing now (immediate = no lookahead).
    const abs = Math.round(t.getTicksAtTime(Tone.immediate()) / (t.PPQ / 2))
    const s = abs % STEPS
    skip.current[r] = abs
    const g = latest.current.grid
    if (g[r]?.[s]) return
    const next = copyGrid(g)
    next[r][s] = true
    commit(next)
  }, [hit])

  // Grid, REC and font changes repaint at once; the playhead and hit flashes repaint from useFrame.
  useEffect(() => {
    const g = canvas.getContext("2d")
    if (!g) return
    const now = performance.now()
    rects.current = paint(g, fm, { grid, rec, step: step.current, flash: fade(flash.current, now) })
    painted.current = { step: step.current, at: now }
    tex.needsUpdate = true
  }, [canvas, tex, fm, fontGen, grid, rec])

  useFrame(() => {
    const now = performance.now()
    const s = step.current
    const fl = fade(flash.current, now)
    const fading = flash.current.some((f) => now - f.at < FLASH_MS + 40)
    if (s === painted.current.step && !fading) return
    if (s === painted.current.step && now - painted.current.at < FRAME_MS) return
    const g = canvas.getContext("2d")
    if (!g) return
    const l = latest.current
    rects.current = paint(g, fm, { grid: l.grid, rec: l.rec, step: s, flash: fl })
    painted.current = { step: s, at: now }
    tex.needsUpdate = true
  })

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    void Tone.start() // browsers stay silent until a user gesture resumes audio
    const p = e.eventObject.worldToLocal(e.point.clone())
    const x = p.x / PX + W / 2
    const y = H / 2 - p.y / PX
    const [recRect, clrRect] = rects.current
    if (inside(recRect, x, y, 5)) return setRec(!latest.current.rec)
    if (inside(clrRect, x, y, 5)) return commit(copyGrid(undefined))
    // Cells are 52 x 72 on a 60 x 128 pitch: the gaps count toward the nearest cell, so near-misses still land.
    const s = Math.floor((x - 20) / 60)
    const r = Math.floor((y - 126) / 128)
    if (s < 0 || s >= STEPS || r < 0 || r > 3 || y > cellY(r) + 82) return
    const next = copyGrid(latest.current.grid)
    next[r][s] = !next[r][s]
    commit(next)
  }

  return (
    <mesh onClick={onClick}>
      <planeGeometry args={[W * PX, H * PX]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  )
}
