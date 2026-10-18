"use client"

import { memo, useEffect, useMemo, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { CanvasTexture, ExtrudeGeometry, SRGBColorSpace, Shape, type Group } from "three"
import { Container, Text, type VanillaContainer } from "@react-three/uikit"
import { SquareTerminal } from "@react-three/uikit-lucide"

type Props = {
  /** Overrides the script: lines starting with "$ " are typed as commands, the rest stream out as output. */
  lines?: string[]
  title?: string
  user?: string
  accent?: string
  /** Replay the script after it ends. */
  loop?: boolean
}

const PX = 0.002
const W = 560 // px -> 1.12 m
const H = 330
const ROWS = 13
const MINT = "#9FE7D2"
const SCRIPT = [
  "$ npm run dev",
  "> spatial-web@1.0.0 dev",
  "> next dev --turbopack",
  "  - Local:   http://localhost:3000",
  "  - Network: http://192.168.1.24:3000",
  "ready Compiled in 812ms",
  "$ git add . && git commit -m \"feat: 3d hero\"",
  "[main 4f2a9c1] feat: 3d hero",
  " 3 files changed, 118 insertions(+), 12 deletions(-)",
  "$ git push origin main",
  "Enumerating objects: 9, done.",
  "Writing objects: 100% (5/5), 2.31 KiB | 2.31 MiB/s, done.",
  "To github.com:spatial/web.git",
  "   9c1e2b7..4f2a9c1  main -> main",
  "done Deployed preview in 4.8s",
]

function tone(line: string, accent: string) {
  if (/^(ready|done)\b/.test(line) || /\bdone\.$/.test(line)) return MINT
  if (/^(warn|error)/i.test(line)) return "#F2B48A"
  if (line.startsWith(">")) return "#6B7182"
  if (/https?:\/\//.test(line)) return accent
  return "#B8BDC9"
}

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

type Row = { kind: "cmd" | "out"; text: string }

/** Terminal panel on an aluminium slab: a prompt types commands (npm run dev, git push) and their output streams in
 * under a blinking block cursor. Pass `lines` to run your own script. */
export default function Terminal({ lines, title = "zsh - spatial-web", user = "ek@spatial", accent = "#7C9CFF", loop = true }: Props) {
  const script = lines?.length ? lines : SCRIPT
  const { ref, handlers } = usePanelMotion(W, H, 0.5)
  // state: index of the script line being worked on + chars typed into it (commands only)
  const [pos, setPos] = useState({ i: 0, c: 0 })

  useEffect(() => {
    const cur = script[pos.i]
    if (cur === undefined) {
      if (!loop) return
      const id = setTimeout(() => setPos({ i: 0, c: 0 }), 3500)
      return () => clearTimeout(id)
    }
    const cmd = cur.startsWith("$ ")
    const len = cmd ? cur.length - 2 : 0
    let delay = 100
    let next = { i: pos.i + 1, c: 0 }
    if (cmd && pos.c < len) next = { i: pos.i, c: Math.min(len, pos.c + 3) } // 10 Hz typing, 3 chars a tick
    else if (cmd) delay = 380 // beat after Enter
    else delay = 120 + (cur.length % 5) * 40
    if (pos.c === 0 && cmd) delay = 700 // pause before typing a new command
    const id = setTimeout(() => setPos(next), delay)
    return () => clearTimeout(id)
  }, [pos, script, loop])

  const rows: Row[] = []
  for (let i = 0; i < Math.min(pos.i, script.length); i++) {
    const s = script[i]
    rows.push(s.startsWith("$ ") ? { kind: "cmd", text: s.slice(2) } : { kind: "out", text: s })
  }
  const cur = script[pos.i]
  const typing = cur?.startsWith("$ ") ? cur.slice(2, 2 + pos.c) : ""
  const visible = rows.slice(-(ROWS - 1))

  return (
    <group ref={ref} {...handlers}>
      <Slab w={W} h={H} />
      <Container pixelSize={PX} width={W} height={H} flexDirection="column" borderRadius={18} backgroundColor="#0A0B0F" borderWidth={1.5} borderColor="#2A2F3B" overflow="hidden">
        <Container height={34} flexShrink={0} flexDirection="row" alignItems="center" paddingX={14} backgroundColor="#12141B">
          <Container flexDirection="row" gap={7} width={60}>
            {["#F2665E", "#F5BE4F", "#5ACB6A"].map((c) => (
              <Container key={c} width={11} height={11} borderRadius={6} backgroundColor={c} />
            ))}
          </Container>
          <Container flexGrow={1} flexDirection="row" justifyContent="center" alignItems="center" gap={6}>
            <SquareTerminal width={13} height={13} color="#6B7182" />
            <Text fontSize={12} color="#8A90A0">{title}</Text>
          </Container>
          <Container width={60} />
        </Container>
        <Container height={1} flexShrink={0} backgroundColor="#22262F" />
        <Container flexGrow={1} flexDirection="column" justifyContent="flex-end" paddingX={16} paddingY={12} gap={3} overflow="hidden">
          {visible.map((r, i) => (
            <RowView key={rows.length - visible.length + i} row={r} user={user} accent={accent} />
          ))}
          {cur !== undefined || loop ? (
            <Container flexDirection="row" alignItems="center" height={17}>
              <Prompt user={user} accent={accent} />
              <Text fontSize={12.5} color="#EEF0F5" whiteSpace="pre">{typing}</Text>
              <Cursor />
            </Container>
          ) : null}
        </Container>
      </Container>
    </group>
  )
}

function Prompt({ user, accent }: { user: string; accent: string }) {
  return (
    <>
      <Text fontSize={12.5} color={MINT} whiteSpace="pre">{user + " "}</Text>
      <Text fontSize={12.5} color={accent} whiteSpace="pre">{"~/web "}</Text>
      <Text fontSize={12.5} color="#6B7182" whiteSpace="pre">{"$ "}</Text>
    </>
  )
}

const RowView = memo(function RowView({ row, user, accent }: { row: Row; user: string; accent: string }) {
  return (
    <Container flexDirection="row" alignItems="center" height={17} flexShrink={0}>
      {row.kind === "cmd" && <Prompt user={user} accent={accent} />}
      <Text fontSize={12.5} color={row.kind === "cmd" ? "#EEF0F5" : tone(row.text, accent)} whiteSpace="pre">
        {row.text}
      </Text>
    </Container>
  )
})

function Cursor() {
  const ref = useRef<VanillaContainer>(null)
  const last = useRef(1)
  useFrame(({ clock }) => {
    const v = Math.sin(clock.elapsedTime * 6) > -0.3 ? 1 : 0
    if (v !== last.current) ref.current?.setProperties({ opacity: v }), (last.current = v)
  })
  return <Container ref={ref} width={8} height={15} marginLeft={1} backgroundColor="#D5D9E3" />
}
