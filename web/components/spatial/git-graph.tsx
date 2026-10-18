"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { CanvasTexture, Color, CubicBezierCurve3, ExtrudeGeometry, LineCurve3, Object3D, SRGBColorSpace, Shape, TubeGeometry, Vector3, type Group, type InstancedMesh } from "three"
import { Container, Text, withOpacity } from "@react-three/uikit"
import { GitBranch, GitCommitHorizontal } from "@react-three/uikit-lucide"

type Props = {
  /** Seconds between new commits (0 = frozen). */
  interval?: number
  repo?: string
  accent?: string
}

const PX = 0.002
const W = 540 // px -> 1.08 m
const ROWS = 8
const ROW_H = 30
const TOP = 52
const H = TOP + ROWS * ROW_H + 44
const LANE_X = [36, 64, 92]
const MINT = "#9FE7D2"
const AMBER = "#F2B48A"
const BRANCHES = ["main", "feature/hero", "fix/caret"]
const AUTHORS = ["ek", "maya", "jon", "ari"]
const SCRIPT: { l: number; m: string; merge?: number }[] = [
  { l: 1, m: "feat: hero scene in 3D" },
  { l: 0, m: "chore: bump three to 0.186" },
  { l: 1, m: "feat: glass pricing cards" },
  { l: 2, m: "fix: caret blink in editor" },
  { l: 0, m: "Merge feature/hero into main", merge: 1 },
  { l: 2, m: "fix: tab focus ring" },
  { l: 0, m: "Merge fix/caret into main", merge: 2 },
  { l: 1, m: "feat: deploy success burst" },
  { l: 1, m: "refactor: share panel motion" },
  { l: 0, m: "docs: template format" },
]
type Commit = { id: number; l: number; m: string; merge?: number; hash: string; who: string }
const make = (id: number): Commit => {
  const s = SCRIPT[id % SCRIPT.length]
  const hash = ((id * 2654435761) >>> 0).toString(16).padStart(8, "0").slice(0, 7)
  return { id, ...s, hash, who: AUTHORS[(id * 7) % AUTHORS.length] }
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

const gx = (lane: number) => (LANE_X[lane] - W / 2) * PX
const gy = (row: number) => (H / 2 - (TOP + row * ROW_H + ROW_H / 2)) * PX
const GZ = 0.006

/** Git history on an aluminium slab: branch lanes as 3D tubes, commit dots and merge curves. A new commit slides in
 * every few seconds; hover a commit (dot or row) to read its message. */
export default function GitGraph({ interval = 3, repo = "spatial/web", accent = "#7C9CFF" }: Props) {
  const colors = [accent, MINT, AMBER]
  const [head, setHead] = useState(ROWS + 1) // id of the newest commit
  const [hover, setHover] = useState<number | null>(null)
  const { ref, handlers } = usePanelMotion(W, H, 0.5)
  const born = useRef(new Map<number, number>())

  useEffect(() => {
    if (!interval) return
    const id = setInterval(() => setHead((h) => h + 1), interval * 1000)
    return () => clearInterval(id)
  }, [interval])

  const commits = useMemo(() => Array.from({ length: ROWS }, (_, i) => make(head - i)), [head])

  // tubes: one rail per lane + a curve for every merge in view
  const tubes = useMemo(() => {
    const out: { geo: TubeGeometry; c: string }[] = []
    for (let l = 0; l < 3; l++) {
      const curve = new LineCurve3(new Vector3(gx(l), gy(-0.4), GZ), new Vector3(gx(l), gy(ROWS - 0.6), GZ))
      out.push({ geo: new TubeGeometry(curve, 1, l ? 0.0016 : 0.0022, 6), c: colors[l] })
    }
    commits.forEach((c, row) => {
      if (c.merge === undefined) return
      const a = new Vector3(gx(c.merge), gy(row + 1), GZ)
      const b = new Vector3(gx(c.l), gy(row), GZ)
      const curve = new CubicBezierCurve3(a, new Vector3(a.x, (a.y + b.y) / 2 + 0.01, GZ + 0.004), new Vector3(b.x, (a.y + b.y) / 2 - 0.01, GZ + 0.004), b)
      out.push({ geo: new TubeGeometry(curve, 16, 0.002, 6), c: colors[c.merge] })
    })
    return out
  }, [commits]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => tubes.forEach((t) => t.geo.dispose()), [tubes])

  const dots = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  useEffect(() => {
    const m = dots.current
    if (!m) return
    const col = new Color()
    commits.forEach((c, i) => m.setColorAt(i, col.set(colors[c.l])))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [commits]) // eslint-disable-line react-hooks/exhaustive-deps

  // per-instance spring: new commits pop in, rows slide down, the hovered one swells
  const ys = useRef(new Map<number, number>())
  useFrame(({ clock }, dt) => {
    const m = dots.current
    if (!m) return
    const now = clock.elapsedTime
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 10)
    commits.forEach((c, i) => {
      if (!born.current.has(c.id)) born.current.set(c.id, now)
      const age = now - born.current.get(c.id)!
      const pop = Math.min(1, age / 0.5)
      const y = gy(i)
      const py = ys.current.get(c.id)
      const ny = py === undefined ? y + (i === 0 ? 0.03 : 0) : py + (y - py) * k
      ys.current.set(c.id, ny)
      const s = 0.0075 * (pop < 1 ? 1 + 2.70158 * (pop - 1) ** 3 + 1.70158 * (pop - 1) ** 2 : 1) * (hover === i ? 1.5 : 1)
      dummy.position.set(gx(c.l), ny, GZ + 0.002)
      dummy.scale.setScalar(Math.max(0.0001, s))
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })

  const h = hover !== null ? commits[hover] : commits[0]
  return (
    <group ref={ref} {...handlers}>
      <Slab w={W} h={H} />
      {tubes.map((t, i) => (
        <mesh key={i} geometry={t.geo}>
          <meshBasicMaterial color={t.c} toneMapped={false} transparent opacity={0.85} />
        </mesh>
      ))}
      <instancedMesh
        ref={dots}
        args={[undefined, undefined, ROWS]}
        frustumCulled={false}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => e.instanceId !== undefined && setHover(e.instanceId)}
        onPointerOut={() => setHover(null)}
      >
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <Container pixelSize={PX} width={W} height={H} flexDirection="column" borderRadius={18} backgroundColor="#0D0F14" borderWidth={1.5} borderColor="#2A2F3B" overflow="hidden">
        <Container height={TOP} flexShrink={0} flexDirection="row" alignItems="center" paddingX={18} gap={10}>
          <GitBranch width={15} height={15} color={accent} />
          <Text fontSize={14} fontWeight="semi-bold" color="#EEF0F5">{repo}</Text>
          <Container flexGrow={1} />
          {BRANCHES.map((b, i) => (
            <Container key={b} flexDirection="row" alignItems="center" gap={5} paddingX={8} paddingY={3} borderRadius={999} backgroundColor={withOpacity(colors[i], 0.12)}>
              <Container width={6} height={6} borderRadius={3} backgroundColor={colors[i]} />
              <Text fontSize={10.5} color={colors[i]}>{b}</Text>
            </Container>
          ))}
        </Container>
        <Container flexDirection="column">
          {commits.map((c, i) => (
            <Container
              key={c.id}
              height={ROW_H}
              flexShrink={0}
              flexDirection="row"
              alignItems="center"
              paddingLeft={118}
              paddingRight={18}
              gap={10}
              backgroundColor={withOpacity("#FFFFFF", hover === i ? 0.05 : 0)}
              onPointerOver={() => setHover(i)}
              onPointerOut={() => setHover(null)}
            >
              <Text fontSize={11.5} color={hover === i ? "#EEF0F5" : "#7A8091"}>{c.hash}</Text>
              <Text fontSize={12} color={hover === i ? "#EEF0F5" : "#B8BDC9"} flexGrow={1} flexShrink={1}>
                {c.m.length > 34 ? c.m.slice(0, 33) + "..." : c.m}
              </Text>
              {i === 0 && (
                <Container paddingX={7} paddingY={2} borderRadius={6} backgroundColor={withOpacity(accent, 0.16)}>
                  <Text fontSize={10} color={accent}>HEAD</Text>
                </Container>
              )}
              <Text fontSize={11} color="#555B6B">{c.who}</Text>
            </Container>
          ))}
        </Container>
        <Container flexGrow={1} />
        <Container height={44} flexShrink={0} flexDirection="row" alignItems="center" paddingX={18} gap={8} backgroundColor="#12141B">
          <GitCommitHorizontal width={14} height={14} color={colors[h.l]} />
          <Text fontSize={12} fontWeight="medium" color="#EEF0F5">{h.m}</Text>
          <Container flexGrow={1} />
          <Text fontSize={11} color="#8A90A0">{`${h.who} on ${BRANCHES[h.l]}`}</Text>
        </Container>
      </Container>
    </group>
  )
}
