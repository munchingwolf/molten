"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { AdditiveBlending, CanvasTexture, SRGBColorSpace, Shape, ShapeGeometry, type Group, type MeshBasicMaterial, type Path } from "three"
import * as Tone from "tone"

const C = { surface: "#15171E", surface2: "#1C1F28", border: "#242833", text: "#EEF0F4", muted: "#9AA0AD", blue: "#3B82F6", head: "#B9D3FF", rec: "#F87171" }

// Panel: 520 x 720 px at 1 mm per px = 0.52 x 0.72 m. Origin = centre, front faces +Z.
const PX = 0.001
const W = 520
const H = 720
const S = 2 // canvas pixels per panel pixel
const MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace'
const at = (x: number, y: number, z = 0.001): [number, number, number] => [(x - W / 2) * PX, (H / 2 - y) * PX, z]
const noHit = () => null // overlays must not swallow pointer events meant for the panel

// 4 voices x 8 eighth-note steps (1 bar). Cells 52 x 72 px = 5.2 x 7.2 cm.
const STEPS = 8
const cellX = (s: number) => 24 + s * 60
const cellY = (r: number) => 136 + r * 128
const REC = { x: 290, y: 19, w: 96, h: 48 }
const CLR = { x: 396, y: 19, w: 102, h: 48 }
const inside = (b: { x: number; y: number; w: number; h: number }, x: number, y: number) => x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4

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
/** Rounded-rect outline (the playhead ring around a cell). */
function ringGeometry(w: number, h: number, r: number, t: number) {
  const rect = (s: Path, x: number, y: number, ww: number, hh: number, rad: number) => {
    s.moveTo(x + rad, y)
    s.lineTo(x + ww - rad, y)
    s.quadraticCurveTo(x + ww, y, x + ww, y + rad)
    s.lineTo(x + ww, y + hh - rad)
    s.quadraticCurveTo(x + ww, y + hh, x + ww - rad, y + hh)
    s.lineTo(x + rad, y + hh)
    s.quadraticCurveTo(x, y + hh, x, y + hh - rad)
    s.lineTo(x, y + rad)
    s.quadraticCurveTo(x, y, x + rad, y)
  }
  const outer = new Shape()
  rect(outer, -w / 2 - t, -h / 2 - t, w + 2 * t, h + 2 * t, r + t)
  const hole = new Shape()
  rect(hole, -w / 2, -h / 2, w, h, r)
  outer.holes.push(hole)
  return new ShapeGeometry(outer, 6)
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
  const head = useRef<Group>(null)
  const glows = useRef<(MeshBasicMaterial | null)[]>([])
  const ring = useMemo(() => ringGeometry(52 * PX, 72 * PX, 8 * PX, 3 * PX), [])
  const { canvas, tex, fm, fontGen } = usePanelCanvas()
  const ch = Number.isFinite(channel) ? Math.round(channel as number) : 1

  useEffect(() => {
    latest.current = { grid, rec, steps, onStepsChange }
  })
  useEffect(() => () => ring.dispose(), [ring])

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

  useEffect(() => {
    const g = canvas.getContext("2d")
    if (!g) return
    g.setTransform(S, 0, 0, S, 0, 0)
    g.clearRect(0, 0, W, H)
    box(g, 2, 2, W - 4, H - 4, 24, C.surface, C.border)
    box(g, 22, 22, 8, 40, 4, C.blue)
    txt(g, "LANE 3 - DRUMS", 42, 43, `700 26px ${fm}`, C.text)
    box(g, REC.x, REC.y, REC.w, REC.h, REC.h / 2, C.surface2, rec ? C.rec : C.border)
    g.fillStyle = rec ? C.rec : C.muted
    g.beginPath()
    g.arc(REC.x + 26, REC.y + REC.h / 2, 7, 0, Math.PI * 2)
    g.fill()
    txt(g, "REC", REC.x + 42, REC.y + REC.h / 2 + 1, `600 18px ${fm}`, rec ? C.text : C.muted)
    box(g, CLR.x, CLR.y, CLR.w, CLR.h, CLR.h / 2, C.surface2, C.border)
    txt(g, "CLEAR", CLR.x + CLR.w / 2, CLR.y + CLR.h / 2 + 1, `600 18px ${fm}`, C.text, "center")
    LABELS.forEach((name, r) => {
      txt(g, name, 24, 116 + r * 128, `600 18px ${fm}`, C.muted)
      for (let s = 0; s < STEPS; s++) {
        const on = !!grid[r]?.[s]
        box(g, cellX(s), cellY(r), 52, 72, 8, on ? C.blue : C.surface2, on ? undefined : C.border)
      }
    })
    txt(g, "<- drum-pads", W / 2, 664, `500 20px ${fm}`, C.blue, "center")
    tex.needsUpdate = true
  }, [canvas, tex, fm, fontGen, grid, rec])

  useFrame(() => {
    const s = step.current
    const h = head.current
    if (h) {
      h.visible = s >= 0
      if (s >= 0) h.position.x = (cellX(s) + 26 - W / 2) * PX
    }
    const now = performance.now()
    glows.current.forEach((m, r) => {
      if (m) m.opacity = 0.35 * flash.current[r].v * Math.max(0, 1 - (now - flash.current[r].at) / 300)
    })
  })

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    void Tone.start() // browsers stay silent until a user gesture resumes audio
    const p = e.eventObject.worldToLocal(e.point.clone())
    const x = p.x / PX + W / 2
    const y = H / 2 - p.y / PX
    if (inside(REC, x, y)) return setRec(!latest.current.rec)
    if (inside(CLR, x, y)) return commit(copyGrid(undefined))
    // Cells are 52 x 72 on a 60 x 128 pitch: the gaps count toward the nearest cell, so near-misses still land.
    const s = Math.floor((x - 20) / 60)
    const r = Math.floor((y - 126) / 128)
    if (s < 0 || s >= STEPS || r < 0 || r > 3 || y > cellY(r) + 82) return
    const next = copyGrid(latest.current.grid)
    next[r][s] = !next[r][s]
    commit(next)
  }

  return (
    <group>
      <mesh onClick={onClick}>
        <planeGeometry args={[W * PX, H * PX]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>
      <group ref={head} visible={false}>
        {LABELS.map((name, r) => (
          <mesh key={name} raycast={noHit} geometry={ring} position={[0, (H / 2 - cellY(r) - 36) * PX, 0.001]}>
            <meshBasicMaterial color={C.head} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {LABELS.map((name, r) => (
        <mesh key={name} raycast={noHit} position={at(W / 2, cellY(r) + 26, 0.0015)}>
          <planeGeometry args={[(W - 32) * PX, 116 * PX]} />
          <meshBasicMaterial ref={(m) => void (glows.current[r] = m)} color={C.blue} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}
