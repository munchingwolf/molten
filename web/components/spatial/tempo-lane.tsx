"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { CanvasTexture, SRGBColorSpace } from "three"
import * as Tone from "tone"

// The Night Set palette (mockup `K`).
const K = { bg: "#0B0C10", surface: "#15171E", surface2: "#1C1F28", border: "#242833", text: "#EEF0F4", muted: "#9AA0AD", accent: "#9FE7D2", warm: "#F2B48A", blue: "#3B82F6" }

// Panel: 520 x 720 px at 1 mm per px = 0.52 x 0.72 m. Origin = centre, front faces +Z.
const PX = 0.001
const W = 520
const H = 720
const S = 2 // canvas pixels per panel pixel (2x the mockup's 520 x 720 for crisp text); animated repaints are capped at 30 fps
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace'
const FRAME_MS = 1000 / 30

const BARS = 40
const FFT = 1024
const TOP_BIN = 300 // ~14 kHz at 48 kHz
// The mockup's resting waveform, shown while the output is silent.
const IDLE = Array.from({ length: BARS }, (_, i) => Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23)))

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

type Rect = { x: number; y: number; w: number; h: number }
const inside = (b: Rect | undefined, x: number, y: number, pad = 8) => !!b && x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad

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
type Chip = { label: string; on?: boolean; icon?: "play" | "stop" | "rec" }
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
    const ic = c.icon ? 22 : 0
    const w = g.measureText(c.label).width + 36 + ic
    x -= w
    const fg = c.on ? K.bg : K.text
    box(g, x, y, w, h, h / 2, c.on ? K.accent : K.surface2, c.on ? undefined : K.border)
    const ix = x + 18
    const cy = y + h / 2
    g.fillStyle = fg
    if (c.icon === "rec") dot(g, ix + 6, cy, 7, c.on ? K.bg : K.muted)
    else if (c.icon === "stop") g.fillRect(ix, cy - 6, 12, 12)
    else if (c.icon === "play") {
      g.beginPath()
      g.moveTo(ix, cy - 8)
      g.lineTo(ix + 13, cy)
      g.lineTo(ix, cy + 8)
      g.closePath()
      g.fill()
    }
    txt(g, c.label, ix + ic, cy + 1, f, fg)
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

type Face = { bpm: number; running: boolean; beat: number; beatGlow: number; levels: Float32Array; idle: number }

/** The mockup's tempo lane, drawn from live state. Returns the PLAY/STOP chip rect. */
function paint(g: G, fm: string, f: Face) {
  g.setTransform(S, 0, 0, S, 0, 0)
  g.clearRect(0, 0, W, H)
  box(g, 2, 2, W - 4, H - 4, 24, K.surface, K.border)
  box(g, 22, 22, 8, 40, 4, K.accent)
  txt(g, "LANE 2 · TEMPO", 42, 43, `700 26px ${fm}`, K.text)
  const [play] = chips(g, [f.running ? { label: "STOP", on: true, icon: "stop" } : { label: "PLAY", icon: "play" }], fm)
  txt(g, `${f.bpm}`, W / 2, 240, `700 150px ${fm}`, K.text, "center")
  txt(g, "BPM", W / 2, 340, `600 30px ${fm}`, K.muted, "center")
  for (let i = 0; i < 4; i++) {
    const x = W / 2 - 90 + i * 60
    // Stopped: beat 1 waits in warm, like a count-in. Playing: the current beat lights (1 warm, others accent) and fades a touch.
    if (!f.running) dot(g, x, 410, 14, i ? K.border : K.warm)
    else {
      dot(g, x, 410, 14, K.border)
      if (i === f.beat) {
        g.globalAlpha = 0.8 + 0.2 * f.beatGlow
        dot(g, x, 410, 14, i ? K.accent : K.warm)
        g.globalAlpha = 1
      }
    }
  }
  g.globalAlpha = 0.7
  g.fillStyle = K.accent
  for (let i = 0; i < BARS; i++) {
    const h = 16 + (f.levels[i] * (1 - f.idle) + IDLE[i] * f.idle) * 90
    g.fillRect(40 + i * 11, 540 - h / 2, 6, h)
  }
  g.globalAlpha = 1
  txt(g, "⇠ console.knob.tempo", W / 2, 664, `500 20px ${fm}`, K.warm, "center")
  return play
}

type Props = {
  /** Tempo in BPM (60-180). Sets the global transport when it changes; when unset, shows the transport's tempo. */
  bpm?: number
  /** Transport running. Bindable with onPlayingChange. */
  playing?: boolean
  onPlayingChange?: (playing: boolean) => void
}

/** Track-wall lane: big BPM readout, beat dots on the global transport, a master-output spectrum and a PLAY/STOP pill. */
export default function TempoLane({ bpm, playing, onPlayingChange }: Props) {
  const tempo = typeof bpm === "number" && Number.isFinite(bpm) ? clamp(bpm, 60, 180) : undefined
  const [polled, setPolled] = useState(() => Math.round(Tone.getTransport().bpm.value))
  const [running, setRunning] = useState(() => Tone.getTransport().state === "started")
  const shown = Math.round(tempo ?? polled)
  const latest = useRef({ playing, onPlayingChange, running, shown })
  const beat = useRef({ i: -1, at: 0 })
  const analyser = useRef<Tone.Analyser | null>(null)
  const levels = useMemo(() => new Float32Array(BARS), [])
  const idle = useRef(1) // 1 = show the resting waveform, 0 = live spectrum
  const lastPaint = useRef(0)
  const playRect = useRef<Rect>(undefined)
  const prevPlaying = useRef<boolean | undefined>(false)
  const { canvas, tex, fm, fontGen } = usePanelCanvas()

  useEffect(() => {
    latest.current = { playing, onPlayingChange, running, shown }
  })

  useEffect(() => {
    if (tempo !== undefined) Tone.getTransport().bpm.value = tempo
  }, [tempo])

  useEffect(() => {
    if (tempo !== undefined) return
    const id = setInterval(() => setPolled(Math.round(Tone.getTransport().bpm.value)), 250)
    return () => clearInterval(id)
  }, [tempo])

  // A changed `playing` prop drives the transport (mounting with false never stops music someone else started).
  useEffect(() => {
    if (playing === undefined || playing === prevPlaying.current) return
    prevPlaying.current = playing
    const t = Tone.getTransport()
    if (playing && t.state !== "started") t.start()
    else if (!playing && t.state === "started") t.stop()
  }, [playing])

  // Follow the transport (any component may start or stop it) and light a dot on every beat.
  useEffect(() => {
    const t = Tone.getTransport()
    const apply = (on: boolean) => {
      setRunning(on)
      if (!on) beat.current.i = -1
      const { playing: p, onPlayingChange: cb } = latest.current
      if (p !== undefined && p !== on) cb?.(on)
    }
    const start = () => apply(true)
    const stop = () => apply(false)
    t.on("start", start)
    t.on("stop", stop)
    t.on("pause", stop)
    const id = t.scheduleRepeat((time) => {
      const i = Math.round(t.getTicksAtTime(time) / t.PPQ) % 4
      Tone.getDraw().schedule(() => (beat.current = { i, at: performance.now() }), time)
    }, "4n")
    return () => {
      t.clear(id)
      t.off("start", start)
      t.off("stop", stop)
      t.off("pause", stop)
    }
  }, [])

  useEffect(() => {
    const a = new Tone.Analyser({ type: "fft", size: FFT, smoothing: 0.6 })
    const out = Tone.getDestination()
    out.connect(a)
    analyser.current = a
    return () => {
      out.disconnect(a)
      a.dispose()
      analyser.current = null
    }
  }, [])

  const face = (now: number): Face => {
    const b = beat.current
    return { bpm: latest.current.shown, running: latest.current.running, beat: b.i, beatGlow: Math.max(0, 1 - (now - b.at) / 200), levels, idle: idle.current }
  }

  // Tempo, play state and font changes repaint at once; the visualizer repaints from useFrame.
  useEffect(() => {
    const g = canvas.getContext("2d")
    if (!g) return
    const now = performance.now()
    const b = beat.current
    playRect.current = paint(g, fm, { bpm: shown, running, beat: b.i, beatGlow: Math.max(0, 1 - (now - b.at) / 200), levels, idle: idle.current })
    tex.needsUpdate = true
  }, [canvas, tex, fm, fontGen, shown, running, levels])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const a = analyser.current
    const data = a ? (a.getValue() as Float32Array) : null
    let peak = 0
    let moved = false
    for (let i = 0; i < BARS; i++) {
      let target = 0
      if (data) {
        // Log-spaced bins, so lows and highs both get bars.
        const lo = Math.floor(Math.pow(TOP_BIN, i / BARS))
        const hi = Math.max(lo + 1, Math.floor(Math.pow(TOP_BIN, (i + 1) / BARS)))
        let db = -Infinity
        for (let k = lo; k < hi; k++) db = Math.max(db, data[k])
        // Tilt up the highs (music falls off ~3-6 dB/octave), so hats and keys show next to the kick.
        target = Number.isFinite(db) ? clamp((db + 24 * (i / BARS) + 88) / 62, 0, 1) : 0
      }
      const v = Math.max(target, levels[i] - dt * 2.2)
      if (Math.abs(v - levels[i]) > 0.002) moved = true
      levels[i] = v
      peak = Math.max(peak, v)
    }
    // Silent output eases back to the mockup's resting waveform; sound takes over within ~0.25 s.
    const want = peak < 0.03 ? 1 : 0
    const nextIdle = want ? Math.min(1, idle.current + dt * 1.5) : Math.max(0, idle.current - dt * 4)
    if (nextIdle !== idle.current) moved = true
    idle.current = nextIdle
    const now = performance.now()
    const fading = latest.current.running && now - beat.current.at < 260
    if (!(moved || fading) || now - lastPaint.current < FRAME_MS) return
    const g = canvas.getContext("2d")
    if (!g) return
    lastPaint.current = now
    playRect.current = paint(g, fm, face(now))
    tex.needsUpdate = true
  })

  const toggle = async () => {
    await Tone.start() // browsers stay silent until a user gesture resumes audio
    const t = Tone.getTransport()
    const next = t.state !== "started"
    if (next) t.start()
    else t.stop()
    setRunning(next)
    onPlayingChange?.(next)
  }

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const p = e.eventObject.worldToLocal(e.point.clone())
    const x = p.x / PX + W / 2
    const y = H / 2 - p.y / PX
    if (inside(playRect.current, x, y)) void toggle()
  }

  return (
    <mesh onClick={onClick}>
      <planeGeometry args={[W * PX, H * PX]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  )
}
