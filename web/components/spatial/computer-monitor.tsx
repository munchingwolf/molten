"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
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

// Real-world 27" 16:9 monitor (metres). Built from the desk up, then shifted so the bounding box is centred.
const SW = 0.597
const SH = 0.336
const PW = SW + 0.016
const PH = SH + 0.024
const PANEL_Y = 0.1 + PH / 2
const TOTAL_H = 0.1 + PH
const BASE_D = 0.19

// DAW screen (canvas px)
const CW = 768
const CH = 432
const TOP_BAR = 30
const HEAD_W = 132
const RULER = 18
const TRACKS: [string, string, "audio" | "midi"][] = [
  ["Drums", "#FF5A36", "audio"],
  ["Bass", "#FFB020", "midi"],
  ["Keys", "#36E2C8", "midi"],
  ["Pad", "#7C9CFF", "midi"],
  ["Vox", "#B37CFF", "audio"],
  ["Guitar", "#4FD16B", "audio"],
  ["FX", "#FF6FB5", "audio"],
]
const BARS = 8
const TRACK_H = (CH - TOP_BAR - RULER - 26) / TRACKS.length
const LANE_W = CW - HEAD_W

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
}

function drawBackground(title: string) {
  const c = document.createElement("canvas")
  c.width = CW
  c.height = CH
  const g = c.getContext("2d")!
  const r = rng(7)
  g.fillStyle = "#15171b"
  g.fillRect(0, 0, CW, CH)
  // top bar
  g.fillStyle = "#202329"
  g.fillRect(0, 0, CW, TOP_BAR)
  g.fillStyle = "#9aa0ad"
  g.font = "600 13px Helvetica, Arial, sans-serif"
  g.fillText(title, 12, 19)
  g.fillStyle = "#e8eaef"
  g.beginPath()
  g.moveTo(CW / 2 - 40, 9)
  g.lineTo(CW / 2 - 40, 21)
  g.lineTo(CW / 2 - 30, 15)
  g.fill()
  g.fillRect(CW / 2 - 18, 10, 10, 10)
  g.fillStyle = "#ff4a3a"
  g.beginPath()
  g.arc(CW / 2 + 6, 15, 5.5, 0, Math.PI * 2)
  g.fill()
  // ruler
  g.fillStyle = "#1b1d22"
  g.fillRect(HEAD_W, TOP_BAR, LANE_W, RULER)
  g.fillStyle = "#7d8390"
  g.font = "500 10px Helvetica, Arial, sans-serif"
  for (let b = 0; b < BARS; b++) g.fillText(String(b + 1), HEAD_W + (b * LANE_W) / BARS + 4, TOP_BAR + 13)
  // lanes + grid
  TRACKS.forEach(([name, color, kind], t) => {
    const y = TOP_BAR + RULER + t * TRACK_H
    g.fillStyle = t % 2 ? "#181a1f" : "#1a1c21"
    g.fillRect(HEAD_W, y, LANE_W, TRACK_H)
    for (let k = 0; k <= BARS * 4; k++) {
      g.fillStyle = k % 4 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)"
      g.fillRect(HEAD_W + (k * LANE_W) / (BARS * 4), y, 1, TRACK_H)
    }
    // header
    g.fillStyle = "#1f2227"
    g.fillRect(0, y, HEAD_W, TRACK_H - 1)
    g.fillStyle = color
    g.fillRect(0, y, 4, TRACK_H - 1)
    g.fillStyle = "#e8eaef"
    g.font = "600 12px Helvetica, Arial, sans-serif"
    g.fillText(name, 12, y + 18)
    g.fillStyle = "#2c3038"
    g.fillRect(12, y + TRACK_H - 17, 14, 11)
    g.fillRect(30, y + TRACK_H - 17, 14, 11)
    g.fillStyle = "#9aa0ad"
    g.font = "700 9px Helvetica, Arial, sans-serif"
    g.fillText("M", 15, y + TRACK_H - 8)
    g.fillText("S", 34, y + TRACK_H - 8)
    // clips
    let bar = Math.floor(r() * 2)
    while (bar < BARS) {
      const len = Math.min(BARS - bar, 1 + Math.floor(r() * 4))
      const x0 = HEAD_W + (bar * LANE_W) / BARS + 1
      const w = (len * LANE_W) / BARS - 2
      g.fillStyle = color + "55"
      g.fillRect(x0, y + 2, w, TRACK_H - 4)
      g.fillStyle = color
      g.fillRect(x0, y + 2, w, 3)
      g.strokeStyle = color
      g.fillStyle = color
      if (kind === "audio") {
        const mid = y + TRACK_H / 2 + 1
        g.beginPath()
        for (let x = 0; x < w; x += 2) {
          const a = (0.25 + r() * 0.75) * (TRACK_H / 2 - 7) * (0.5 + 0.5 * Math.abs(Math.sin(x * 0.09)))
          g.moveTo(x0 + x, mid - a)
          g.lineTo(x0 + x, mid + a)
        }
        g.stroke()
      } else {
        for (let k = 0; k < len * 4; k++) {
          const ny = y + 8 + r() * (TRACK_H - 14)
          g.fillRect(x0 + 2 + (k * w) / (len * 4), ny, w / (len * 4) - 3, 3)
        }
      }
      bar += len + Math.floor(r() * 2)
    }
  })
  // bottom status bar
  g.fillStyle = "#202329"
  g.fillRect(0, CH - 26, CW, 26)
  g.fillStyle = "#7d8390"
  g.font = "500 11px Helvetica, Arial, sans-serif"
  g.fillText("48 kHz  -  24-bit  -  CPU 12%", 12, CH - 9)
  return c
}

/**
 * 27" studio monitor (computer display) running a live DAW: tracks, clips and a playhead that follows the shared
 * Tone transport (or loops on its own when nothing is playing). Tap the power LED to switch the screen off.
 */
export default function ComputerMonitor({
  on,
  onChange,
  title = "Spatial Session - Arrangement",
  color = "#9FE7D2",
}: {
  on?: boolean
  onChange?: (on: boolean) => void
  /** Project name in the DAW title bar */
  title?: string
  /** Playhead + selection colour */
  color?: string
}) {
  const env = useRoomEnv()
  const [inner, setInner] = useState(true)
  const power = on ?? inner
  const toggle = () => {
    if (on === undefined) setInner(!power)
    onChange?.(!power)
  }

  const bg = useMemo(() => drawBackground(title), [title])
  const screen = useMemo(() => {
    const c = document.createElement("canvas")
    c.width = CW
    c.height = CH
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return { g: c.getContext("2d")!, tex }
  }, [])
  useEffect(() => () => screen.tex.dispose(), [screen])

  const meter = useRef<Tone.Meter | null>(null)
  useEffect(() => {
    const m = new Tone.Meter({ smoothing: 0.8 })
    const out = Tone.getDestination()
    out.connect(m)
    meter.current = m
    return () => {
      out.disconnect(m)
      m.dispose()
      meter.current = null
    }
  }, [])

  const acc = useRef(1)
  const ownClock = useRef(0)
  useFrame((_, dt) => {
    if (!power) return
    ownClock.current += dt
    acc.current += dt
    if (acc.current < 1 / 20) return // 20 fps is plenty for a screen and cheap on Quest
    acc.current = 0
    const tr = Tone.getTransport()
    const beats = tr.state === "started" ? tr.ticks / tr.PPQ : ownClock.current * 2 // 120 BPM idle loop
    const pos = beats % (BARS * 4)
    const g = screen.g
    g.drawImage(bg, 0, 0)
    // playhead
    const x = HEAD_W + (pos / (BARS * 4)) * LANE_W
    g.fillStyle = color
    g.fillRect(x - 1, TOP_BAR, 2, CH - TOP_BAR - 26)
    g.beginPath()
    g.moveTo(x - 6, TOP_BAR)
    g.lineTo(x + 6, TOP_BAR)
    g.lineTo(x, TOP_BAR + 8)
    g.fill()
    // counter + bpm
    const bar = Math.floor(pos / 4) + 1
    const beat = Math.floor(pos % 4) + 1
    const tick = Math.floor((pos % 1) * 100)
    g.fillStyle = "#0f1114"
    g.fillRect(CW / 2 + 22, 5, 150, 20)
    g.fillStyle = color
    g.font = "700 14px ui-monospace, Menlo, monospace"
    g.fillText(`${bar}.${beat}.${String(tick).padStart(2, "0")}`, CW / 2 + 30, 20)
    g.fillStyle = "#e8eaef"
    g.fillText(`${tr.bpm.value.toFixed(0)} BPM`, CW / 2 + 100, 20)
    // master meter, top right
    const raw = meter.current?.getValue()
    const db = Array.isArray(raw) ? Math.max(...raw) : (raw ?? -Infinity)
    const lvl = Math.min(1, Math.max(0, (db + 48) / 48))
    g.fillStyle = "#0f1114"
    g.fillRect(CW - 130, 10, 118, 10)
    g.fillStyle = lvl > 0.9 ? "#ff4a3a" : lvl > 0.75 ? "#ffb020" : "#2bd96b"
    g.fillRect(CW - 130, 10, 118 * lvl, 10)
    screen.tex.needsUpdate = true
  })

  const metal = { metalness: 0.9, roughness: 0.35, envMap: env }
  return (
    <group position={[0, -TOTAL_H / 2, 0.045]}>
      {/* base + neck */}
      <RoundedBox args={[0.25, 0.009, BASE_D]} radius={0.004} smoothness={2} position={[0, 0.0045, -0.045]}>
        <meshPhysicalMaterial color="#b9bcc1" {...metal} />
      </RoundedBox>
      <RoundedBox args={[0.055, PANEL_Y - 0.009, 0.018]} radius={0.004} smoothness={2} position={[0, 0.009 + (PANEL_Y - 0.009) / 2, -0.055]}>
        <meshPhysicalMaterial color="#b9bcc1" {...metal} />
      </RoundedBox>
      {/* back housing */}
      <RoundedBox args={[0.34, 0.22, 0.03]} radius={0.01} smoothness={3} position={[0, PANEL_Y, -0.03]}>
        <meshPhysicalMaterial color="#1d1e21" roughness={0.5} clearcoat={0.3} envMap={env} />
      </RoundedBox>
      {/* panel + glass */}
      <RoundedBox args={[PW, PH, 0.018]} radius={0.004} smoothness={2} position={[0, PANEL_Y, 0]}>
        <meshPhysicalMaterial color="#0b0b0c" roughness={0.3} clearcoat={1} clearcoatRoughness={0.05} envMap={env} />
      </RoundedBox>
      <mesh position={[0, PANEL_Y + (PH - SH) / 2 - 0.008, 0.0092]} visible={power}>
        <planeGeometry args={[SW, SH]} />
        <meshBasicMaterial map={screen.tex} toneMapped={false} />
      </mesh>
      {/* power LED + button (bottom-right of the chin) */}
      <mesh position={[PW / 2 - 0.02, PANEL_Y - PH / 2 + 0.006, 0.0092]}>
        <circleGeometry args={[0.0015, 12]} />
        <meshBasicMaterial color={power ? "#f2f4f7" : "#ffb020"} toneMapped={false} />
      </mesh>
      <mesh visible={false} position={[PW / 2 - 0.02, PANEL_Y - PH / 2 + 0.008, 0.014]} onClick={toggle}>
        <boxGeometry args={[0.03, 0.02, 0.012]} />
      </mesh>
    </group>
  )
}
