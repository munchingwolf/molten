"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { CanvasTexture, SRGBColorSpace, type Mesh, type MeshBasicMaterial } from "three"
import * as Tone from "tone"

const C = { surface: "#15171E", surface2: "#1C1F28", border: "#242833", text: "#EEF0F4", muted: "#9AA0AD", mint: "#9FE7D2", warm: "#F2B48A", ink: "#0B0C10" }

// Panel: 520 x 720 px at 1 mm per px = 0.52 x 0.72 m. Origin = centre, front faces +Z.
const PX = 0.001
const W = 520
const H = 720
const S = 2 // canvas pixels per panel pixel
const MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace'
/** Panel pixel (from the top-left) to local metres, just in front of the face. */
const at = (x: number, y: number, z = 0.001): [number, number, number] => [(x - W / 2) * PX, (H / 2 - y) * PX, z]
const noHit = () => null // overlays must not swallow pointer events meant for the panel

const PLAY = { x: 378, y: 19, w: 120, h: 48 } // header-right pill (4.8 cm tall)
const DOT_Y = 410
const BARS = 40
const BAR_Y = 540
const FFT = 1024
const TOP_BIN = 300 // ~14 kHz at 48 kHz

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
}
function box(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string) {
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
  const latest = useRef({ playing, onPlayingChange, running })
  const beat = useRef({ i: -1, at: 0 })
  const analyser = useRef<Tone.Analyser | null>(null)
  const dots = useRef<(MeshBasicMaterial | null)[]>([])
  const bars = useRef<(Mesh | null)[]>([])
  const levels = useMemo(() => new Float32Array(BARS), [])
  const prevPlaying = useRef<boolean | undefined>(false)
  const { canvas, tex, fm, fontGen } = usePanelCanvas()
  const shown = Math.round(tempo ?? polled)

  useEffect(() => {
    latest.current = { playing, onPlayingChange, running }
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

  // Static face: only redrawn when the tempo, the play state or the fonts change.
  useEffect(() => {
    const g = canvas.getContext("2d")
    if (!g) return
    g.setTransform(S, 0, 0, S, 0, 0)
    g.clearRect(0, 0, W, H)
    box(g, 2, 2, W - 4, H - 4, 24, C.surface, C.border)
    box(g, 22, 22, 8, 40, 4, C.mint)
    txt(g, "LANE 2 - TEMPO", 42, 43, `700 26px ${fm}`, C.text)
    box(g, PLAY.x, PLAY.y, PLAY.w, PLAY.h, PLAY.h / 2, running ? C.warm : C.mint)
    g.fillStyle = C.ink
    if (running) g.fillRect(PLAY.x + 24, PLAY.y + 17, 14, 14)
    else {
      g.beginPath()
      g.moveTo(PLAY.x + 25, PLAY.y + 15)
      g.lineTo(PLAY.x + 39, PLAY.y + 24)
      g.lineTo(PLAY.x + 25, PLAY.y + 33)
      g.closePath()
      g.fill()
    }
    txt(g, running ? "STOP" : "PLAY", PLAY.x + 50, PLAY.y + PLAY.h / 2 + 1, `700 20px ${fm}`, C.ink)
    txt(g, `${shown}`, W / 2, 240, `700 150px ${fm}`, C.text, "center")
    txt(g, "BPM", W / 2, 340, `600 30px ${fm}`, C.muted, "center")
    for (let i = 0; i < 4; i++) {
      g.fillStyle = C.border
      g.beginPath()
      g.arc(W / 2 - 90 + i * 60, DOT_Y, 14, 0, Math.PI * 2)
      g.fill()
    }
    txt(g, "<- console.knob.tempo", W / 2, 664, `500 20px ${fm}`, C.warm, "center")
    tex.needsUpdate = true
  }, [canvas, tex, fm, fontGen, shown, running])

  useFrame((_, dt) => {
    const now = performance.now()
    const b = beat.current
    const on = latest.current.running
    dots.current.forEach((m, i) => {
      // Stopped: beat 1 waits in warm, like a count-in. Playing: the current beat lights and fades a touch.
      if (m) m.opacity = on ? (b.i === i ? 0.8 + 0.2 * Math.max(0, 1 - (now - b.at) / 200) : 0) : i === 0 ? 1 : 0
    })
    const a = analyser.current
    const data = a ? (a.getValue() as Float32Array) : null
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
      levels[i] = Math.max(target, levels[i] - Math.min(dt, 0.1) * 2.2)
      const m = bars.current[i]
      if (m) m.scale.y = (12 + levels[i] * 94) * PX
    }
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
    if (x >= PLAY.x - 8 && x <= PLAY.x + PLAY.w + 8 && y >= PLAY.y - 8 && y <= PLAY.y + PLAY.h + 8) void toggle()
  }

  return (
    <group>
      <mesh onClick={onClick}>
        <planeGeometry args={[W * PX, H * PX]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} raycast={noHit} position={at(W / 2 - 90 + i * 60, DOT_Y)}>
          <circleGeometry args={[14 * PX, 32]} />
          <meshBasicMaterial ref={(m) => void (dots.current[i] = m)} color={i === 0 ? C.warm : C.mint} transparent opacity={0} toneMapped={false} />
        </mesh>
      ))}
      {Array.from({ length: BARS }, (_, i) => (
        <mesh key={i} raycast={noHit} ref={(m) => void (bars.current[i] = m)} position={at(40 + i * 11 + 3, BAR_Y)} scale={[6 * PX, 12 * PX, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color={C.mint} transparent opacity={0.7} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}
