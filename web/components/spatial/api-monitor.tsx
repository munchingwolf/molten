"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { CanvasTexture, ExtrudeGeometry, SRGBColorSpace, Shape, type Group } from "three"
import { Container, Text, withOpacity } from "@react-three/uikit"
import { Activity } from "@react-three/uikit-lucide"

type Endpoint = { method: string; path: string; base: number }
type Props = {
  endpoints?: Endpoint[]
  /** Uptime percent shown in the header. */
  uptime?: number
  accent?: string
  /** Index of the selected endpoint. */
  value?: number
  onChange?: (index: number) => void
}

const PX = 0.002
const W = 620 // px -> 1.24 m
const BARS = 28
const MINT = "#9FE7D2"
const AMBER = "#F2B48A"
const RED = "#F2777A"
const DEFAULTS: Endpoint[] = [
  { method: "GET", path: "/api/components", base: 42 },
  { method: "POST", path: "/api/scenes", base: 88 },
  { method: "GET", path: "/api/templates", base: 35 },
  { method: "POST", path: "/api/assist", base: 160 },
  { method: "GET", path: "/api/assets/:id", base: 60 },
]

// ---------- shared slab + motion ----------
let matcap: CanvasTexture | undefined
// Previews have no lights, so a generated brushed-metal matcap shades the bezel the same everywhere.
function getMatcap() {
  if (matcap) return matcap
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const g = c.getContext("2d")!
  const grad = g.createRadialGradient(64, 34, 0, 64, 34, 92)
  grad.addColorStop(0, "#ffffff")
  grad.addColorStop(0.45, "#c9ccd4")
  grad.addColorStop(1, "#26282f")
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  matcap = new CanvasTexture(c)
  matcap.colorSpace = SRGBColorSpace
  return matcap
}
function slabGeometry(w: number, h: number, r: number, d: number) {
  const s = new Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  const bevel = 0.004
  const g = new ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10 })
  g.translate(0, 0, -(d + bevel) - 0.0015)
  return g
}
function Slab({ w, h, r = 18, depth = 0.022, color = "#2A2E38" }: { w: number; h: number; r?: number; depth?: number; color?: string }) {
  const mc = useMemo(getMatcap, [])
  const geo = useMemo(() => slabGeometry(w * PX, h * PX, r * PX, depth), [w, h, r, depth])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <mesh geometry={geo}>
      <meshMatcapMaterial matcap={mc} color={color} />
    </mesh>
  )
}
const easeOutBack = (x: number) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2
function usePanelMotion(w: number, h: number, amp = 0.5, delay = 0) {
  const ref = useRef<Group>(null)
  const m = useRef({ born: -1, z: 0, rx: 0, ry: 0, tx: 0, ty: 0, hover: false })
  useFrame((state, dt) => {
    const g = ref.current
    if (!g) return
    const s = m.current
    const now = state.clock.elapsedTime
    if (s.born < 0) s.born = now
    const p = Math.min(1, Math.max(0, (now - s.born - delay) / 0.8))
    const e = p === 1 ? 1 : easeOutBack(p)
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 10)
    s.z += ((s.hover ? 0.025 : 0) - s.z) * k
    s.rx += (s.tx - s.rx) * k
    s.ry += (s.ty - s.ry) * k
    g.position.set(0, (1 - e) * -0.06, s.z - (1 - e) * 0.1)
    g.rotation.set(s.rx, s.ry, 0)
    g.scale.setScalar(0.92 + 0.08 * e)
  })
  const handlers = {
    onPointerOver: () => void (m.current.hover = true),
    onPointerOut: () => void ((m.current.hover = false), (m.current.tx = 0), (m.current.ty = 0)),
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      const g = ref.current
      if (!g) return
      const p = g.worldToLocal(e.point.clone())
      m.current.tx = -(p.y / ((h * PX) / 2)) * 0.06 * amp
      m.current.ty = (p.x / ((w * PX) / 2)) * 0.08 * amp
    },
  }
  return { ref, handlers }
}

const noise = (i: number, t: number) => Math.sin(i * 12.9898 + t * 78.233) * 43758.5453 % 1

/** API health panel on an aluminium slab: each endpoint has a live latency sparkline, its p50 and 200/404/500 counts,
 * with overall uptime on top. Data ticks once a second; tap a row to select it (value/onChange). */
export default function ApiMonitor({ endpoints = DEFAULTS, uptime = 99.98, accent = "#7C9CFF", value, onChange }: Props) {
  const list = endpoints.length ? endpoints : DEFAULTS
  const [tick, setTick] = useState(0)
  const [local, setLocal] = useState(0)
  const sel = value ?? local
  const H = 74 + list.length * 52 + 16
  const { ref, handlers } = usePanelMotion(W, H, 0.5)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000) // 1 Hz data, not per frame
    return () => clearInterval(id)
  }, [])

  const series = useMemo(
    () =>
      list.map((e, i) =>
        Array.from({ length: BARS }, (_, k) => {
          const n = Math.abs(noise(i, tick + k))
          const spike = n > 0.93 ? 2.4 : 1
          return Math.round(e.base * (0.7 + n * 0.6) * spike)
        }),
      ),
    [list, tick],
  )

  return (
    <group ref={ref} {...handlers}>
      <Slab w={W} h={H} />
      <Container pixelSize={PX} width={W} height={H} flexDirection="column" borderRadius={18} paddingX={18} paddingTop={16} gap={6} backgroundColor="#0D0F14" borderWidth={1.5} borderColor="#2A2F3B">
        <Container height={44} flexDirection="row" alignItems="center" gap={10}>
          <Activity width={16} height={16} color={accent} />
          <Text fontSize={15} fontWeight="semi-bold" color="#EEF0F5">API health</Text>
          <Container flexDirection="row" alignItems="center" gap={5} paddingX={8} paddingY={3} borderRadius={999} backgroundColor={withOpacity(MINT, 0.12)}>
            <Container width={6} height={6} borderRadius={3} backgroundColor={MINT} />
            <Text fontSize={10.5} color={MINT}>live</Text>
          </Container>
          <Container flexGrow={1} />
          <Text fontSize={11} color="#8A90A0">uptime 30d</Text>
          <Text fontSize={20} fontWeight="bold" color="#EEF0F5">{`${uptime.toFixed(2)}%`}</Text>
        </Container>
        {list.map((e, i) => {
          const s = series[i]
          const max = Math.max(...s)
          const p50 = [...s].sort((a, b) => a - b)[BARS >> 1]
          const n = Math.abs(noise(i, tick))
          const c4 = Math.floor(n * 6)
          const c5 = n > 0.85 ? 1 + Math.floor(n * 3) : 0
          const on = i === sel
          return (
            <Container
              key={e.method + e.path}
              height={46}
              flexDirection="row"
              alignItems="center"
              gap={10}
              paddingX={10}
              borderRadius={10}
              backgroundColor={withOpacity("#FFFFFF", on ? 0.05 : 0)}
              hover={{ backgroundColor: withOpacity("#FFFFFF", 0.035) }}
              borderWidth={1}
              borderColor={on ? withOpacity(accent, 0.5) : withOpacity("#FFFFFF", 0)}
              cursor="pointer"
              onClick={() => (setLocal(i), onChange?.(i))}
            >
              <Container width={40} height={18} borderRadius={5} alignItems="center" justifyContent="center" backgroundColor={withOpacity(e.method === "GET" ? accent : AMBER, 0.15)}>
                <Text fontSize={9.5} fontWeight="bold" color={e.method === "GET" ? accent : AMBER}>{e.method}</Text>
              </Container>
              <Text fontSize={12} color="#D5D9E3" width={120}>{e.path}</Text>
              <Container width={BARS * 4} height={26} flexDirection="row" alignItems="flex-end" gap={1}>
                {s.map((v, k) => (
                  <Container key={k} width={3} height={Math.max(2, (v / max) * 26)} borderRadius={1} backgroundColor={v > e.base * 1.8 ? AMBER : withOpacity(accent, 0.35 + (k / BARS) * 0.65)} />
                ))}
              </Container>
              <Text fontSize={12} fontWeight="semi-bold" color="#EEF0F5" width={50}>{`${p50}ms`}</Text>
              <Container flexGrow={1} />
              <Pill code="200" n={980 + Math.floor(n * 40)} c={MINT} />
              <Pill code="404" n={c4} c={AMBER} />
              <Pill code="500" n={c5} c={RED} />
            </Container>
          )
        })}
      </Container>
    </group>
  )
}

function Pill({ code, n, c }: { code: string; n: number; c: string }) {
  return (
    <Container flexDirection="row" alignItems="center" gap={4} paddingX={6} paddingY={2} borderRadius={6} backgroundColor={withOpacity(c, n ? 0.14 : 0.05)}>
      <Text fontSize={9.5} fontWeight="bold" color={n ? c : "#454B5A"}>{code}</Text>
      <Text fontSize={9.5} color={n ? "#B8BDC9" : "#454B5A"}>{String(n)}</Text>
    </Container>
  )
}
