"use client"

import { useEffect, useMemo, useRef } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { CanvasTexture, ExtrudeGeometry, SRGBColorSpace, Shape, type Group } from "three"
import { Container, Text, withOpacity, type VanillaContainer } from "@react-three/uikit"
import { ArrowRight, ChevronLeft, ChevronRight, Layers, Lock, RotateCw, ShieldCheck, Star, Zap } from "@react-three/uikit-lucide"

type Props = {
  url?: string
  title?: string
  theme?: "light" | "dark"
  accent?: string
  /** Fires when the page's call-to-action is pressed. */
  onPress?: () => void
}

const PX = 0.002
const W = 640 // px -> 1.28 m
const H = 450
const THEMES = {
  dark: { chrome: "#12141B", bar: "#0D0F14", field: "#1A1D26", page: "#0B0D12", card: "#141720", cardHover: "#1B1F2B", border: "#262A35", ink: "#EEF0F5", muted: "#8A90A0", dim: "#555B6B" },
  light: { chrome: "#ECEEF2", bar: "#F6F7F9", field: "#FFFFFF", page: "#FFFFFF", card: "#F4F5F8", cardHover: "#ECEFF6", border: "#DDE0E7", ink: "#111218", muted: "#5B5F6D", dim: "#9AA0AD" },
}
const CARDS = [
  { Icon: Zap, title: "Instant", body: "Live in seconds" },
  { Icon: Layers, title: "Composable", body: "Snap pieces together" },
  { Icon: ShieldCheck, title: "Secure", body: "HTTPS by default" },
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

/** Browser frame on an aluminium slab: tab, address bar with lock and https://, and a live mini landing page whose
 * button and cards react to hover. The reload button spins and replays the page load. */
export default function BrowserWindow({ url = "spatial.dev", title = "Spatial - Build in 3D", theme = "dark", accent = "#7C9CFF", onPress }: Props) {
  const t = THEMES[theme] ?? THEMES.dark
  const host = url.replace(/^https?:\/\//, "")
  const { ref, handlers } = usePanelMotion(W, H, 0.45)
  const spinRef = useRef<VanillaContainer>(null)
  const barRef = useRef<VanillaContainer>(null)
  const pageRef = useRef<VanillaContainer>(null)
  const load = useRef({ t0: -1, at: -1 }) // t0 < 0 = request a (re)load on the next frame

  useFrame(({ clock }) => {
    const L = load.current
    const now = clock.elapsedTime
    if (L.t0 < 0) L.t0 = now
    const p = (now - L.t0) / 1.1
    if (p > 1.4 && L.at === -2) return
    spinRef.current?.setProperties({ transformRotateZ: p < 1 ? -p * 720 : 0 })
    barRef.current?.setProperties({ width: `${Math.min(100, p * 100)}%`, opacity: p < 1 ? 1 : Math.max(0, 1 - (p - 1) * 4) })
    pageRef.current?.setProperties({ opacity: Math.min(1, Math.max(0, (p - 0.35) * 2)), transformTranslateY: Math.max(0, 1 - p) * 10 })
    if (p > 1.4) L.at = -2
  })
  const reload = () => ((load.current.t0 = -1), (load.current.at = -1))

  return (
    <group ref={ref} {...handlers}>
      <Slab w={W} h={H} color={theme === "light" ? "#9EA3AD" : "#2A2E38"} />
      <Container pixelSize={PX} width={W} height={H} flexDirection="column" borderRadius={18} backgroundColor={t.chrome} borderWidth={1.5} borderColor={t.border} overflow="hidden">
        {/* tab strip */}
        <Container height={38} flexShrink={0} flexDirection="row" alignItems="flex-end" paddingX={14} gap={12}>
          <Container flexDirection="row" gap={7} height={38} alignItems="center">
            {["#F2665E", "#F5BE4F", "#5ACB6A"].map((c) => (
              <Container key={c} width={11} height={11} borderRadius={6} backgroundColor={c} />
            ))}
          </Container>
          <Container height={30} width={220} paddingX={12} flexDirection="row" alignItems="center" gap={8} backgroundColor={t.bar} borderTopLeftRadius={10} borderTopRightRadius={10}>
            <Container width={12} height={12} borderRadius={4} backgroundColor={accent} />
            <Text fontSize={12} color={t.ink} flexShrink={1}>{title.length > 26 ? title.slice(0, 25) + "..." : title}</Text>
          </Container>
        </Container>
        {/* address bar */}
        <Container height={42} flexShrink={0} flexDirection="row" alignItems="center" paddingX={12} gap={10} backgroundColor={t.bar}>
          <ChevronLeft width={16} height={16} color={t.muted} />
          <ChevronRight width={16} height={16} color={t.dim} />
          <Container
            width={28}
            height={28}
            borderRadius={8}
            alignItems="center"
            justifyContent="center"
            hover={{ backgroundColor: t.field }}
            cursor="pointer"
            onClick={reload}
          >
            <Container ref={spinRef} width={16} height={16}>
              <RotateCw width={15} height={15} color={t.muted} />
            </Container>
          </Container>
          <Container flexGrow={1} height={28} borderRadius={14} paddingX={12} flexDirection="row" alignItems="center" gap={7} backgroundColor={t.field} borderWidth={1} borderColor={t.border}>
            <Lock width={12} height={12} color="#9FE7D2" />
            <Text fontSize={12.5} color={t.dim}>https://</Text>
            <Text fontSize={12.5} color={t.ink} marginLeft={-6}>{host}</Text>
            <Container flexGrow={1} />
            <Star width={13} height={13} color={t.dim} />
          </Container>
        </Container>
        {/* page */}
        <Container flexGrow={1} flexDirection="column" backgroundColor={t.page} borderTopWidth={1} borderColor={t.border}>
          <Container ref={barRef} positionType="absolute" positionTop={0} positionLeft={0} height={2.5} width="0%" backgroundColor={accent} />
          <Container ref={pageRef} flexGrow={1} flexDirection="column" paddingX={32} paddingY={20} gap={14}>
            <Container flexDirection="row" alignItems="center" gap={8}>
              <Container width={16} height={16} borderRadius={5} backgroundColor={accent} />
              <Text fontSize={14} fontWeight="bold" color={t.ink}>{host.split(/[./]/)[0] || "site"}</Text>
              <Container flexGrow={1} />
              {["Docs", "Pricing", "Blog"].map((l) => (
                <Text key={l} fontSize={12} color={t.muted} hover={{ color: t.ink }} cursor="pointer" marginLeft={14}>{l}</Text>
              ))}
            </Container>
            <Container flexDirection="column" alignItems="center" gap={8} marginTop={10}>
              <Container paddingX={10} paddingY={3} borderRadius={999} backgroundColor={withOpacity(accent, 0.14)}>
                <Text fontSize={11} color={accent} fontWeight="medium">v2.0 is live</Text>
              </Container>
              <Text fontSize={30} fontWeight="bold" color={t.ink} letterSpacing={-0.8}>Ship the web in 3D</Text>
              <Text fontSize={13} color={t.muted}>Working components for the browser and the headset.</Text>
              <Container
                marginTop={6}
                height={36}
                paddingX={18}
                borderRadius={10}
                flexDirection="row"
                alignItems="center"
                gap={8}
                backgroundColor={t.ink}
                hover={{ backgroundColor: accent, transformTranslateY: -2 }}
                cursor="pointer"
                onClick={() => onPress?.()}
              >
                <Text fontSize={13} fontWeight="semi-bold" color={t.page}>Get started</Text>
                <ArrowRight width={14} height={14} color={t.page} />
              </Container>
            </Container>
            <Container flexDirection="row" gap={12} marginTop={8}>
              {CARDS.map(({ Icon, title: ct, body }) => (
                <Container
                  key={ct}
                  flexGrow={1}
                  flexBasis={0}
                  padding={12}
                  gap={6}
                  borderRadius={12}
                  flexDirection="column"
                  backgroundColor={t.card}
                  borderWidth={1}
                  borderColor={t.border}
                  hover={{ backgroundColor: t.cardHover, borderColor: accent, transformTranslateY: -4 }}
                  cursor="pointer"
                >
                  <Icon width={16} height={16} color={accent} />
                  <Text fontSize={13} fontWeight="semi-bold" color={t.ink}>{ct}</Text>
                  <Text fontSize={11} color={t.muted}>{body}</Text>
                </Container>
              ))}
            </Container>
          </Container>
        </Container>
      </Container>
    </group>
  )
}
