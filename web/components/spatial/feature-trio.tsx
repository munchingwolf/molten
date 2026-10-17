"use client"

import { useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import type { Group } from "three"
import { Container, Text } from "@react-three/uikit"
import { Layers, ShieldCheck, Zap } from "@react-three/uikit-lucide"

type Feature = { title: string; body: string }
type Props = {
  heading?: string
  features?: Feature[]
  accent?: string
  theme?: "light" | "dark"
  /** Index of the highlighted card. */
  value?: number
  onChange?: (index: number) => void
}

const CARD_W = 270 // px at pixelSize 0.002 → 54 cm
const CARD_H = 300
const PX = 0.002
const GAP = 0.6 // m between card centres
const YAW = 0.2 // rad: outer cards turn toward the viewer, a shallow arc
const ICONS = [Zap, Layers, ShieldCheck]
const THEMES = {
  light: { panel: "#FFFFFF", border: "#E4E6EC", ink: "#111218", muted: "#5B5F6D", tile: "#F1F2F6" },
  dark: { panel: "#121419", border: "#262A34", ink: "#F3F4F8", muted: "#9A9FAC", tile: "#1C1F27" },
}
const DEFAULTS: Feature[] = [
  { title: "Instant", body: "Every component works the moment you drop it in. No setup, no glue code." },
  { title: "Composable", body: "Snap pieces into frames: rows, grids or a curved wall around you." },
  { title: "Yours to ship", body: "Export clean React code you own, for the web and the headset." },
]

const easeOutBack = (x: number) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2

/**
 * Entrance (rise + scale-up with a soft overshoot, staggered by `delay`), hover lift and a tilt toward the pointer.
 * Everything moves the group, so uikit never re-lays out and it stays smooth in a headset.
 */
function useCardMotion(delay: number, liftZ: number, w: number, h: number) {
  const ref = useRef<Group>(null)
  const m = useRef({ born: -1, z: 0, rx: 0, ry: 0, tx: 0, ty: 0 })
  useFrame((state, dt) => {
    const g = ref.current
    if (!g) return
    const s = m.current
    const now = state.clock.elapsedTime
    if (s.born < 0) s.born = now
    const p = Math.min(1, Math.max(0, (now - s.born - delay) / 0.8))
    const e = p === 1 ? 1 : easeOutBack(p)
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 10)
    s.z += (liftZ - s.z) * k
    s.rx += (s.tx - s.rx) * k
    s.ry += (s.ty - s.ry) * k
    g.position.set(0, (1 - e) * -0.06, s.z - (1 - e) * 0.1)
    g.rotation.set(s.rx, s.ry, 0)
    g.scale.setScalar(0.92 + 0.08 * e)
    if (p < 1 || Math.abs(s.tx - s.rx) + Math.abs(s.ty - s.ry) + Math.abs(liftZ - s.z) > 1e-4) state.invalidate()
  })
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const g = ref.current
    if (!g) return
    const p = g.worldToLocal(e.point.clone())
    m.current.tx = -(p.y / (h / 2)) * 0.07
    m.current.ty = (p.x / (w / 2)) * 0.09
  }
  const onPointerOut = () => ((m.current.tx = 0), (m.current.ty = 0))
  return { ref, onPointerMove, onPointerOut }
}

/** Three feature cards on a shallow arc. They rise in one after another; hover lifts and tilts a card; tap highlights it (value/onChange). */
export default function FeatureTrio({ heading = "Why teams build with Spatial", features = DEFAULTS, accent = "#7C9CFF", theme = "light", value, onChange }: Props) {
  const t = THEMES[theme] ?? THEMES.light
  const [local, setLocal] = useState(0)
  const active = value ?? local
  const pick = (i: number) => (setLocal(i), onChange?.(i))
  const items = features.slice(0, 3)
  const title = useCardMotion(0, 0, 900 * PX, 60 * PX)

  return (
    <group>
      <group position={[0, (CARD_H / 2 + 56) * PX, 0]}>
        <group ref={title.ref}>
          <Container pixelSize={PX} width={900} justifyContent="center">
            <Text fontSize={34} fontWeight="bold" color={t.ink} letterSpacing={-0.6}>{heading}</Text>
          </Container>
        </group>
      </group>
      {items.map((f, i) => {
        const side = i - (items.length - 1) / 2
        return (
          <group key={i} position={[side * GAP, 0, Math.abs(side) * 0.06]} rotation={[0, -side * YAW, 0]}>
            <Card i={i} f={f} t={t} accent={accent} on={i === active} onPick={() => pick(i)} />
          </group>
        )
      })}
    </group>
  )
}

function Card({ i, f, t, accent, on, onPick }: { i: number; f: Feature; t: (typeof THEMES)["light"]; accent: string; on: boolean; onPick: () => void }) {
  const [hover, setHover] = useState(false)
  const motion = useCardMotion(0.12 + i * 0.09, hover || on ? 0.035 : 0, CARD_W * PX, CARD_H * PX)
  const Icon = ICONS[i % ICONS.length]
  return (
    <group
      ref={motion.ref}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => (setHover(false), motion.onPointerOut())}
      onPointerMove={motion.onPointerMove}
    >
      <Container
        pixelSize={PX}
        width={CARD_W}
        height={CARD_H}
        flexDirection="column"
        gap={14}
        padding={26}
        borderRadius={24}
        backgroundColor={t.panel}
        borderWidth={on ? 2.5 : 1.5}
        borderColor={on ? accent : hover ? t.muted : t.border}
        cursor="pointer"
        onClick={onPick}
      >
        <Container width={52} height={52} borderRadius={14} backgroundColor={on ? accent : t.tile} alignItems="center" justifyContent="center">
          <Icon width={26} height={26} color={on ? "#FFFFFF" : t.ink} />
        </Container>
        <Text fontSize={24} fontWeight="bold" color={t.ink} marginTop={10}>{f.title}</Text>
        <Text fontSize={16} color={t.muted}>{f.body}</Text>
      </Container>
    </group>
  )
}
