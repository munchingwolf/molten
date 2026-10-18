"use client"

import { memo, useEffect, useMemo, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { CanvasTexture, ExtrudeGeometry, SRGBColorSpace, Shape, type Group } from "three"
import { Container, Text, withOpacity, type VanillaContainer } from "@react-three/uikit"
import { Files, GitBranch, Search, Blocks, CircleCheck } from "@react-three/uikit-lucide"

type CodeFile = { name: string; code: string }
type Props = {
  files?: CodeFile[]
  /** Index of the open tab. */
  value?: number
  onChange?: (index: number) => void
  project?: string
  accent?: string
  /** Type the first file out on mount. */
  typing?: boolean
}

const PX = 0.002
const W = 680 // px -> 1.36 m
const H = 440
const LINE_H = 19
const FS = 12.5

const DEFAULT_FILES: CodeFile[] = [
  {
    name: "Hero.tsx",
    code: `import { useState } from "react"
import { Container, Text } from "@react-three/uikit"

export function Hero({ title = "Ship in 3D" }) {
  const [count, setCount] = useState(0)
  return (
    <Container padding={24} gap={12}>
      <Text fontSize={32}>{title}</Text>
      <Button onClick={() => setCount(count + 1)}>
        Clicked {count} times
      </Button>
    </Container>
  )
}`,
  },
  {
    name: "page.tsx",
    code: `// app/page.tsx - the landing page
import { Canvas } from "@react-three/fiber"
import { XR, createXRStore } from "@react-three/xr"
import { Hero } from "./Hero"

const store = createXRStore()

export default function Page() {
  return (
    <Canvas camera={{ position: [0, 1.6, 2] }}>
      <XR store={store}>
        <Hero title="Spatial" />
      </XR>
    </Canvas>
  )
}`,
  },
  {
    name: "api.ts",
    code: `type Stats = { visitors: number; growth: number }

export async function getStats(): Promise<Stats> {
  const res = await fetch("/api/stats", { cache: "no-store" })
  if (!res.ok) throw new Error("Request failed")
  const data: Stats = await res.json()
  return { ...data, growth: data.growth * 100 }
}`,
  },
]

// ---------- tokenizer ----------
type Tok = { t: string; c: string }
const C = {
  plain: "#D5D9E3",
  punct: "#8A90A0",
  comment: "#5C6372",
  keyword: "#B9A4F5",
  string: "#9FE7D2",
  number: "#F2B48A",
  fn: "#E8DFA6",
  type: "#86C5FF",
  tag: "#7C9CFF",
  attr: "#D7B98E",
}
const KW = new Set("import from export default function const let return async await if else throw new type interface true false null typeof as".split(" "))
const RE = /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`]*`)|(=>)|(<\/?[A-Za-z][\w.]*|\/?>)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+)|([^\s])/g

function tokenize(line: string): Tok[] {
  const out: Tok[] = []
  const jsx = line.includes("<")
  for (const m of line.matchAll(RE)) {
    const s = m[0]
    let c = C.punct
    if (m[1]) c = C.comment
    else if (m[2]) c = C.string
    else if (m[3]) c = C.keyword
    else if (m[4]) c = C.tag
    else if (m[5]) c = C.number
    else if (m[6]) {
      const next = line[(m.index ?? 0) + s.length]
      const after = line[(m.index ?? 0) + s.length + 1]
      if (KW.has(s)) c = C.keyword
      else if (next === "(") c = C.fn
      else if (jsx && next === "=" && after !== "=" && after !== ">") c = C.attr
      else if (/^[A-Z]/.test(s)) c = C.type
      else c = C.plain
    } else if (m[7]) {
      // whitespace: glue onto the previous token so rows stay short
      if (out.length) out[out.length - 1].t += s
      else out.push({ t: s, c: C.plain })
      continue
    }
    const prev = out[out.length - 1]
    if (prev && prev.c === c && !/^\s+$/.test(prev.t)) prev.t += s
    else out.push({ t: s, c })
  }
  return out
}

function slice(toks: Tok[], n: number): Tok[] {
  const out: Tok[] = []
  let left = n
  for (const tk of toks) {
    if (left <= 0) break
    out.push(left >= tk.t.length ? tk : { t: tk.t.slice(0, left), c: tk.c })
    left -= tk.t.length
  }
  return out
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

/** A bevelled dark-aluminium slab sitting just behind a uikit panel of w x h px. */
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

/** Spring entrance, hover lift and a tilt toward the pointer; all on the group so uikit never re-lays out. */
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
    const lift = s.hover ? 0.025 : 0
    s.z += (lift - s.z) * k
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

// ---------- editor ----------
/** VS Code style IDE window on an aluminium slab: tabs, line numbers, TSX syntax colours, a minimap and a blinking caret.
 * On mount the first file types itself out line by line; tap a tab to switch files (value/onChange). */
export default function CodeEditor({ files = DEFAULT_FILES, value, onChange, project = "spatial-app", accent = "#7C9CFF", typing = true }: Props) {
  const list = files.length ? files : DEFAULT_FILES
  const [local, setLocal] = useState(0)
  const active = Math.min(Math.max(0, value ?? local), list.length - 1)
  const switched = useRef(false)
  const { ref, handlers } = usePanelMotion(W, H, 0.45)
  const file = list[active]

  return (
    <group ref={ref} {...handlers}>
      <Slab w={W} h={H} />
      <Container
        pixelSize={PX}
        width={W}
        height={H}
        flexDirection="column"
        borderRadius={18}
        backgroundColor="#0D0F14"
        borderWidth={1.5}
        borderColor="#2A2F3B"
        overflow="hidden"
      >
        {/* title bar */}
        <Container height={34} flexShrink={0} flexDirection="row" alignItems="center" paddingX={14} backgroundColor="#12141B">
          <Container flexDirection="row" gap={7} width={60}>
            {["#F2665E", "#F5BE4F", "#5ACB6A"].map((c) => (
              <Container key={c} width={11} height={11} borderRadius={6} backgroundColor={c} />
            ))}
          </Container>
          <Container flexGrow={1} flexDirection="row" justifyContent="center" gap={6}>
            <Text fontSize={12} color="#6B7182">{project}</Text>
            <Text fontSize={12} color="#4A5060">/</Text>
            <Text fontSize={12} fontWeight="medium" color="#C9CDD8">{file.name}</Text>
          </Container>
          <Container width={60} />
        </Container>
        <Container height={1} flexShrink={0} backgroundColor="#22262F" />
        <Container flexGrow={1} flexDirection="row" minHeight={0}>
          {/* activity bar */}
          <Container width={44} flexShrink={0} flexDirection="column" alignItems="center" paddingTop={12} gap={16} backgroundColor="#101219">
            <Files width={17} height={17} color="#D5D9E3" />
            <Search width={17} height={17} color="#555B6B" />
            <GitBranch width={17} height={17} color="#555B6B" />
            <Blocks width={17} height={17} color="#555B6B" />
          </Container>
          <Container width={1} backgroundColor="#22262F" />
          <Container flexGrow={1} flexDirection="column" minWidth={0}>
            {/* tabs */}
            <Container height={32} flexShrink={0} flexDirection="row" backgroundColor="#101219">
              {list.map((f, i) => {
                const on = i === active
                return (
                  <Container
                    key={f.name + i}
                    height={32}
                    paddingX={14}
                    flexDirection="row"
                    alignItems="center"
                    gap={7}
                    backgroundColor={on ? "#0D0F14" : "#101219"}
                    hover={{ backgroundColor: on ? "#0D0F14" : "#161922" }}
                    cursor="pointer"
                    onClick={() => {
                      switched.current = true
                      setLocal(i)
                      onChange?.(i)
                    }}
                  >
                    {on && <Container positionType="absolute" positionTop={0} positionLeft={0} positionRight={0} height={2} backgroundColor={accent} />}
                    <Text fontSize={9} fontWeight="bold" color={f.name.endsWith(".tsx") ? "#86C5FF" : "#E8DFA6"}>
                      {f.name.endsWith(".tsx") ? "TSX" : "TS"}
                    </Text>
                    <Text fontSize={12} color={on ? "#E8EAF0" : "#7A8091"}>{f.name}</Text>
                    <Text fontSize={11} color={on ? "#8A90A0" : "#3E4350"}>x</Text>
                  </Container>
                )
              })}
              <Container flexGrow={1} />
            </Container>
            <CodeBody key={active} code={file.code} animate={typing && !switched.current} accent={accent} />
          </Container>
        </Container>
      </Container>
    </group>
  )
}

function CodeBody({ code, animate, accent }: { code: string; animate: boolean; accent: string }) {
  const lines = useMemo(() => code.split("\n").map((l) => ({ text: l, toks: tokenize(l) })), [code])
  const total = useMemo(() => lines.reduce((n, l) => n + l.text.length + 1, 0), [lines])
  const [typed, setTyped] = useState(animate ? 0 : total)

  useEffect(() => {
    if (typed >= total) return
    // shortcut: 10 updates a second; only the row being typed re-renders (rows are memoised).
    const id = setTimeout(() => setTyped((t) => Math.min(total, t + 7)), 100)
    return () => clearTimeout(id)
  }, [typed, total])

  // which line is the caret on, and how much of it is visible
  let start = 0
  let cur = lines.length - 1
  for (let i = 0; i < lines.length; i++) {
    if (typed < start + lines[i].text.length + 1) {
      cur = i
      break
    }
    start += lines[i].text.length + 1
  }
  const done = typed >= total
  const curCol = done ? lines[lines.length - 1].text.length : Math.max(0, typed - start)
  const shownLines = done ? lines.length : cur + 1

  return (
    <>
      <Container flexGrow={1} flexDirection="row" minHeight={0} overflow="hidden">
        <Container flexGrow={1} flexDirection="column" paddingTop={8} minWidth={0} overflow="hidden">
          {lines.slice(0, shownLines).map((l, i) => {
            const isCur = i === (done ? lines.length - 1 : cur)
            return <Line key={i} num={i + 1} toks={l.toks} n={isCur ? curCol : l.text.length} active={isCur} accent={accent} />
          })}
        </Container>
        <Minimap lines={lines} shown={shownLines} />
      </Container>
      <Container height={24} flexShrink={0} flexDirection="row" alignItems="center" paddingX={12} gap={14} backgroundColor="#12141B">
        <Container flexDirection="row" alignItems="center" gap={5}>
          <GitBranch width={12} height={12} color={accent} />
          <Text fontSize={11} color="#C9CDD8">main</Text>
        </Container>
        <Container flexDirection="row" alignItems="center" gap={5}>
          <CircleCheck width={12} height={12} color="#9FE7D2" />
          <Text fontSize={11} color="#8A90A0">0 problems</Text>
        </Container>
        <Container flexGrow={1} />
        <Text fontSize={11} color="#8A90A0">{`Ln ${(done ? lines.length - 1 : cur) + 1}, Col ${curCol + 1}`}</Text>
        <Text fontSize={11} color="#8A90A0">UTF-8</Text>
        <Text fontSize={11} color="#C9CDD8">TypeScript JSX</Text>
      </Container>
    </>
  )
}

const Line = memo(function Line({ num, toks, n, active, accent }: { num: number; toks: Tok[]; n: number; active: boolean; accent: string }) {
  const shown = slice(toks, n)
  return (
    <Container height={LINE_H} flexShrink={0} flexDirection="row" alignItems="center" backgroundColor={withOpacity("#1A1E29", active ? 1 : 0)}>
      <Container width={46} flexShrink={0} paddingRight={16} flexDirection="row" justifyContent="flex-end">
        <Text fontSize={11.5} color={active ? "#C9CDD8" : "#454B5A"}>{String(num)}</Text>
      </Container>
      <Container flexDirection="row" alignItems="center">
        {shown.map((tk, i) => (
          <Text key={i} fontSize={FS} color={tk.c} whiteSpace="pre">
            {tk.t}
          </Text>
        ))}
        {active && <Caret accent={accent} />}
      </Container>
    </Container>
  )
})

function Caret({ accent }: { accent: string }) {
  const ref = useRef<VanillaContainer>(null)
  const last = useRef(1)
  useFrame(({ clock }) => {
    const v = Math.sin(clock.elapsedTime * 6.5) > -0.3 ? 1 : 0
    if (v !== last.current) ref.current?.setProperties({ opacity: v }), (last.current = v)
  })
  return <Container ref={ref} width={2} height={15} marginLeft={1} backgroundColor={accent} />
}

function Minimap({ lines, shown }: { lines: { text: string; toks: Tok[] }[]; shown: number }) {
  return (
    <Container width={64} flexShrink={0} flexDirection="column" paddingTop={10} paddingX={8} gap={2.5} borderLeftWidth={1} borderColor="#1C2029">
      <Container positionType="absolute" positionTop={6} positionLeft={4} positionRight={4} height={Math.max(30, lines.length * 5 + 8)} borderRadius={3} backgroundColor={withOpacity("#FFFFFF", 0.04)} />
      {lines.slice(0, shown).map((l, i) => {
        const indent = l.text.length - l.text.trimStart().length
        const len = l.text.trim().length
        const tone = l.toks.find((t) => t.c !== C.plain && t.c !== C.punct)?.c ?? C.plain
        return (
          <Container key={i} height={2.5} flexShrink={0} flexDirection="row">
            <Container width={indent * 0.9} />
            <Container width={Math.min(46 - indent * 0.9, len * 0.9)} height={2.5} borderRadius={1} backgroundColor={withOpacity(tone, len ? 0.55 : 0)} />
          </Container>
        )
      })}
    </Container>
  )
}
