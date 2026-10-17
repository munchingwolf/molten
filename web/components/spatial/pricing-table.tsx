"use client"

import { useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import type { Group } from "three"
import { Container, Text } from "@react-three/uikit"
import { Check } from "@react-three/uikit-lucide"

type Tier = { name: string; monthly: number; blurb: string; features: string[] }
type Props = {
  tiers?: Tier[]
  /** Show yearly prices (2 months free). */
  yearly?: boolean
  currency?: string
  accent?: string
  theme?: "light" | "dark"
  /** Index of the selected tier. */
  value?: number
  onChange?: (index: number) => void
  onPress?: (index: number) => void
}

const COL_W = 260 // px at pixelSize 0.002 -> 52 cm
const COL_H = 420
const STEP = 0.56 // m between column centres
const THEMES = {
  light: { panel: "#FFFFFF", border: "#E4E6EC", ink: "#111218", muted: "#5B5F6D", soft: "#F1F2F6", onInk: "#FFFFFF" },
  dark: { panel: "#121419", border: "#262A34", ink: "#F3F4F8", muted: "#9A9FAC", soft: "#1C1F27", onInk: "#0B0C10" },
}
const DEFAULTS: Tier[] = [
  { name: "Starter", monthly: 0, blurb: "For trying things out", features: ["10 components", "1 scene", "Web export"] },
  { name: "Pro", monthly: 19, blurb: "For makers who ship", features: ["Every component", "Unlimited scenes", "Headset launch", "Voice editing"] },
  { name: "Team", monthly: 49, blurb: "For studios and classes", features: ["Everything in Pro", "Shared libraries", "Live co-editing", "Priority support"] },
]

const easeOutBack = (x: number) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2

/**
 * Entrance (rise + scale-up with a soft overshoot, staggered by `delay`), hover lift and a tilt toward the pointer.
 * Everything moves the group, so uikit never re-lays out and it stays smooth in a headset.
 */
function useCardMotion(delay: number, liftZ: number, w: number, h: number, base = 1) {
  const ref = useRef<Group>(null)
  const m = useRef({ born: -1, z: 0, rx: 0, ry: 0, tx: 0, ty: 0, s: base })
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
    s.s += (base - s.s) * k
    s.rx += (s.tx - s.rx) * k
    s.ry += (s.ty - s.ry) * k
    g.position.set(0, (1 - e) * -0.06, s.z - (1 - e) * 0.1)
    g.rotation.set(s.rx, s.ry, 0)
    g.scale.setScalar(s.s * (0.92 + 0.08 * e))
    if (p < 1 || Math.abs(s.tx - s.rx) + Math.abs(s.ty - s.ry) + Math.abs(liftZ - s.z) + Math.abs(base - s.s) > 1e-4) state.invalidate()
  })
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const g = ref.current
    if (!g) return
    const p = g.worldToLocal(e.point.clone())
    m.current.tx = -(p.y / (h / 2)) * 0.06
    m.current.ty = (p.x / (w / 2)) * 0.08
  }
  const onPointerOut = () => ((m.current.tx = 0), (m.current.ty = 0))
  return { ref, onPointerMove, onPointerOut }
}

/** Three pricing tiers that rise in one after another; the middle one is raised as "Most popular". Tap a tier to select it (value/onChange); its button fires onPress. */
export default function PricingTable({ tiers = DEFAULTS, yearly = false, currency = "$", accent = "#7C9CFF", theme = "light", value, onChange, onPress }: Props) {
  const t = THEMES[theme] ?? THEMES.light
  const [local, setLocal] = useState(1)
  const active = value ?? local
  const cols = tiers.slice(0, 3)
  return (
    <group>
      {cols.map((tier, i) => (
        <group key={tier.name} position={[(i - (cols.length - 1) / 2) * STEP, 0, 0]}>
          <Column
            i={i}
            tier={tier}
            featured={i === 1}
            on={i === active}
            price={yearly ? tier.monthly * 10 : tier.monthly}
            per={yearly ? "/yr" : "/mo"}
            currency={currency}
            t={t}
            accent={accent}
            onPick={() => (setLocal(i), onChange?.(i))}
            onBuy={() => onPress?.(i)}
          />
        </group>
      ))}
    </group>
  )
}

function Column({ i, tier, featured, on, price, per, currency, t, accent, onPick, onBuy }: {
  i: number; tier: Tier; featured: boolean; on: boolean; price: number; per: string; currency: string
  t: (typeof THEMES)["light"]; accent: string; onPick: () => void; onBuy: () => void
}) {
  const [hover, setHover] = useState(false)
  const motion = useCardMotion(i * 0.09, (featured ? 0.05 : 0) + (hover ? 0.025 : 0), COL_W * 0.002, COL_H * 0.002, featured ? 1.04 : 1)
  return (
    <group
      ref={motion.ref}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => (setHover(false), motion.onPointerOut())}
      onPointerMove={motion.onPointerMove}
    >
      <Container
        pixelSize={0.002}
        width={COL_W}
        height={COL_H}
        flexDirection="column"
        gap={12}
        padding={26}
        borderRadius={26}
        backgroundColor={t.panel}
        borderWidth={on ? 2.5 : 1.5}
        borderColor={on ? accent : t.border}
        cursor="pointer"
        onClick={onPick}
      >
        <Container flexDirection="row" justifyContent="space-between" alignItems="center">
          <Text fontSize={20} fontWeight="bold" color={t.ink}>{tier.name}</Text>
          {featured && (
            <Container paddingX={10} paddingY={4} borderRadius={999} backgroundColor={accent}>
              <Text fontSize={12} fontWeight="semi-bold" color="#FFFFFF">Most popular</Text>
            </Container>
          )}
        </Container>
        <Text fontSize={14} color={t.muted}>{tier.blurb}</Text>
        <Container flexDirection="row" alignItems="flex-end" gap={4} marginTop={6}>
          <Text fontSize={46} fontWeight="bold" color={t.ink} letterSpacing={-1}>{price === 0 ? "Free" : `${currency}${price}`}</Text>
          {price > 0 && <Text fontSize={16} color={t.muted} marginBottom={9}>{per}</Text>}
        </Container>
        <Container height={1.5} backgroundColor={t.border} marginY={6} />
        <Container flexDirection="column" gap={10} flexGrow={1}>
          {tier.features.map((f) => (
            <Container key={f} flexDirection="row" gap={10} alignItems="center">
              <Container width={20} height={20} borderRadius={10} backgroundColor={on ? accent : t.soft} alignItems="center" justifyContent="center">
                <Check width={12} height={12} color={on ? "#FFFFFF" : t.ink} />
              </Container>
              <Text fontSize={15} color={t.ink}>{f}</Text>
            </Container>
          ))}
        </Container>
        <Container
          height={46}
          borderRadius={13}
          alignItems="center"
          justifyContent="center"
          backgroundColor={on ? t.ink : t.soft}
          hover={{ backgroundColor: accent }}
          cursor="pointer"
          onClick={onBuy}
        >
          <Text fontSize={16} fontWeight="semi-bold" color={on ? t.onInk : t.ink}>{tier.monthly === 0 ? "Start free" : "Choose plan"}</Text>
        </Container>
      </Container>
    </group>
  )
}
