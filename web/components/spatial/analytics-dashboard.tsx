// Ported from pmndrs/uikit examples/dashboard (MIT, © 2024 Bela Bohlender), a 3D port of the shadcn/ui dashboard, and refined for Spatial.
"use client"

import { useEffect, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Image, Text, withOpacity, type ContainerProperties, type VanillaContainer } from "@react-three/uikit"
import { Activity, ArrowDownRight, ArrowUpRight, Check, CreditCard, DollarSign, Download, Users } from "@react-three/uikit-lucide"

const C = { panel: "#15171E", deep: "#101218", border: "#323745", line: "#242833", card: "#1B1E27", hover: "#262A35", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2", up: "#86E0A6", down: "#F0A6B8" }
const RANGES = ["7d", "30d", "90d"]
const PLOT = 128 // bar plot height in px

type Props = {
  /** selected range: 0 = 7 days, 1 = 30 days, 2 = 90 days */
  value?: number
  onChange?: (range: number) => void
  title?: string
  accent?: string
}

type Kpi = { label: string; icon: typeof DollarSign; prefix: string; values: number[]; deltas: string[]; down?: boolean[]; base: number }
const KPIS: Kpi[] = [
  { label: "Revenue", icon: DollarSign, prefix: "$", values: [11284, 45231, 132940], deltas: ["+4.2% vs last week", "+20.1% vs last month", "+12.6% vs last quarter"], base: 5200 },
  { label: "Subscriptions", icon: Users, prefix: "+", values: [612, 2350, 6890], deltas: ["+11.0% vs last week", "+180.1% vs last month", "+48.3% vs last quarter"], base: 260 },
  { label: "Sales", icon: CreditCard, prefix: "+", values: [3108, 12234, 35112], deltas: ["+6.4% vs last week", "+19.0% vs last month", "-2.4% vs last quarter"], down: [false, false, true], base: 1400 },
  { label: "Active now", icon: Activity, prefix: "", values: [573, 573, 573], deltas: ["+201 since last hour", "+201 since last hour", "+201 since last hour"], base: 90 },
]
const LABELS = [
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  ["18", "21", "24", "27", "30", "3", "6", "9", "12", "15"],
  ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9", "W10", "W11", "W12"],
]
const SUBTITLE = ["Oct 11 - Oct 17, 2026", "Sep 18 - Oct 17, 2026", "Jul 20 - Oct 17, 2026"]
const PEOPLE = [
  { name: "Olivia Martin", email: "olivia.martin@email.com", img: 64 },
  { name: "Jackson Lee", email: "jackson.lee@email.com", img: 91 },
  { name: "Isabella Nguyen", email: "isabella.nguyen@email.com", img: 1027 },
  { name: "William Kim", email: "will@email.com", img: 1005 },
  { name: "Sofia Davis", email: "sofia.davis@email.com", img: 65 },
  { name: "Noah Patel", email: "noah.patel@email.com", img: 338 },
]
const AMOUNTS = [1999, 39, 299, 99, 39, 549, 1240, 89]
const SALES_COUNT = [61, 265, 812]
const TINTS = ["#B9B4F5", "#8EC9F0", "#F2B48A", "#9FE7D2", "#F0A6B8", "#86E0A6"]

// deterministic "random" so every range/metric has its own stable series
const noise = (i: number, seed: number) => {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453
  return x - Math.floor(x)
}
const fmt = (n: number) => n.toLocaleString("en-US")
const short = (n: number) => (n >= 1000 ? `${+(n / 1000).toFixed(1)}k` : `${Math.round(n)}`)

/** Analytics dashboard: range tabs, four KPI cards, a springy bar chart and recent sales. Tap a range to change all data, tap a KPI to chart it, hover a bar for its value. */
export default function AnalyticsDashboard({ value, onChange, title = "Dashboard", accent = C.accent }: Props) {
  const [inner, setInner] = useState(1)
  const range = Math.max(0, Math.min(2, Math.round(value ?? inner)))
  const [metric, setMetric] = useState(0)
  const [bar, setBar] = useState<number | null>(null)
  const [pickedSale, setPickedSale] = useState<number | null>(null)
  const [saved, setSaved] = useState(false)
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })

  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 1600)
    return () => clearTimeout(t)
  }, [saved])

  const pickRange = (i: number) => {
    if (value === undefined) setInner(i)
    setBar(null)
    onChange?.(i)
  }

  const kpi = KPIS[metric]
  const labels = LABELS[range]
  const scale = [1, 0.75, 4.2][range] // daily vs. 3-day vs. weekly buckets
  const series = labels.map((_, i) => Math.round(kpi.base * scale * (0.45 + 0.55 * noise(i, range * 7 + metric + 1))))
  const top = Math.max(...series)
  const step = Math.pow(10, Math.floor(Math.log10(top)))
  const max = Math.ceil(top / step) * step
  const ticks = [max, max / 2, 0]
  const sales = PEOPLE.map((p, i) => ({ ...p, amount: AMOUNTS[(i + range * 3) % AMOUNTS.length] * (range === 2 ? 2 : 1) }))
    .slice(range, range + 5)
    .concat(PEOPLE.slice(0, Math.max(0, range + 5 - PEOPLE.length)).map((p, i) => ({ ...p, amount: AMOUNTS[i] })))

  return (
    <Container
      ref={panel}
      {...enter}
      pixelSize={0.002}
      width={640}
      height={400}
      flexDirection="column"
      padding={14}
      gap={10}
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={20}
      overflow="hidden"
    >
      {/* header: title, range tabs, export */}
      <Container flexDirection="row" alignItems="center" gap={10} height={34} flexShrink={0} paddingX={2}>
        <Container flexDirection="column" flexGrow={1} gap={1}>
          <Text fontSize={17} fontWeight="semi-bold" color={C.text}>
            {title}
          </Text>
          <Text fontSize={11} color={C.faint}>
            {SUBTITLE[range]}
          </Text>
        </Container>
        <Container flexDirection="row" padding={3} gap={2} borderRadius={10} backgroundColor={C.deep} borderWidth={1} borderColor={C.line}>
          {RANGES.map((r, i) => {
            const on = i === range
            return (
              <Press
                key={r}
                width={46}
                height={26}
                borderRadius={7}
                alignItems="center"
                justifyContent="center"
                lift={1}
                backgroundColor={on ? withOpacity(accent, 0.16) : withOpacity("#FFFFFF", 0)}
                hover={{ backgroundColor: on ? withOpacity(accent, 0.2) : withOpacity("#FFFFFF", 0.05) }}
                onClick={() => pickRange(i)}
              >
                <Text fontSize={12} fontWeight="semi-bold" color={on ? accent : C.muted}>
                  {r.toUpperCase()}
                </Text>
              </Press>
            )
          })}
        </Container>
        <Press
          height={34}
          paddingX={12}
          gap={6}
          borderRadius={10}
          flexDirection="row"
          alignItems="center"
          backgroundColor={saved ? withOpacity(accent, 0.18) : accent}
          hover={{ backgroundColor: saved ? withOpacity(accent, 0.22) : "#B8F0E0" }}
          onClick={() => setSaved(true)}
        >
          {saved ? <Check width={14} height={14} color={accent} /> : <Download width={14} height={14} color={C.deep} />}
          <Text fontSize={12} fontWeight="semi-bold" color={saved ? accent : C.deep}>
            {saved ? "Exported" : "Export"}
          </Text>
        </Press>
      </Container>

      {/* KPI cards: tap one to chart it */}
      <Container flexDirection="row" gap={8} height={84} flexShrink={0}>
        {KPIS.map((k, i) => {
          const on = i === metric
          const down = k.down?.[range]
          const Icon = k.icon
          const Arrow = down ? ArrowDownRight : ArrowUpRight
          return (
            <Press
              key={k.label}
              flexGrow={1}
              flexBasis={0}
              flexDirection="column"
              justifyContent="space-between"
              padding={12}
              borderRadius={14}
              borderWidth={1}
              borderColor={on ? withOpacity(accent, 0.55) : C.line}
              backgroundColor={on ? withOpacity(accent, 0.07) : C.card}
              hover={{ backgroundColor: on ? withOpacity(accent, 0.1) : C.hover }}
              onClick={() => (setMetric(i), setBar(null))}
            >
              <Container flexDirection="row" alignItems="center" justifyContent="space-between">
                <Text fontSize={11} fontWeight="medium" color={on ? C.text : C.muted}>
                  {k.label}
                </Text>
                {i === 3 ? (
                  <Container width={7} height={7} borderRadius={4} backgroundColor={C.up} />
                ) : (
                  <Icon width={14} height={14} color={on ? accent : C.faint} />
                )}
              </Container>
              <Text fontSize={20} fontWeight="bold" color={C.text}>
                {`${k.prefix}${fmt(k.values[range])}`}
              </Text>
              <Container flexDirection="row" alignItems="center" gap={3}>
                {i === 3 ? null : <Arrow width={11} height={11} color={down ? C.down : C.up} />}
                <Text fontSize={10} color={down ? C.down : i === 3 ? C.muted : C.up}>
                  {k.deltas[range]}
                </Text>
              </Container>
            </Press>
          )
        })}
      </Container>

      {/* chart + recent sales */}
      <Container flexDirection="row" gap={8} flexGrow={1} minHeight={0}>
        <Container flexGrow={1} flexBasis={0} flexDirection="column" padding={12} gap={8} borderRadius={14} borderWidth={1} borderColor={C.line} backgroundColor={C.card}>
          <Container flexDirection="row" alignItems="center" gap={8}>
            <Text fontSize={13} fontWeight="semi-bold" color={C.text}>
              Overview
            </Text>
            <Container paddingX={7} height={18} borderRadius={6} alignItems="center" backgroundColor={withOpacity(accent, 0.14)}>
              <Text fontSize={10} fontWeight="semi-bold" color={accent}>
                {kpi.label}
              </Text>
            </Container>
            <Text flexGrow={1} textAlign="right" fontSize={11} color={bar === null ? C.faint : C.text}>
              {bar === null ? "Hover a bar" : `${labels[bar]}:  ${kpi.prefix === "$" ? "$" : ""}${fmt(series[bar])}`}
            </Text>
          </Container>
          <Container flexDirection="row" gap={8} flexGrow={1}>
            <Container width={30} height={PLOT + 22} flexDirection="column" alignItems="flex-end" justifyContent="space-between" paddingBottom={16}>
              {ticks.map((t, i) => (
                <Text key={i} fontSize={9} color={C.faint}>
                  {`${kpi.prefix === "$" ? "$" : ""}${short(t)}`}
                </Text>
              ))}
            </Container>
            <Container flexGrow={1} flexDirection="row" gap={range === 2 ? 5 : 8} height={PLOT + 22} borderBottomWidth={0}>
              {series.map((v, i) => (
                <Bar
                  key={`${range}-${metric}-${i}`}
                  label={labels[i]}
                  h={(v / max) * PLOT}
                  on={bar === i}
                  dim={bar !== null && bar !== i}
                  accent={accent}
                  tip={`${kpi.prefix === "$" ? "$" : ""}${short(v)}`}
                  onHover={(h) => setBar((b) => (h ? i : b === i ? null : b))}
                  delay={i * 0.035}
                />
              ))}
            </Container>
          </Container>
        </Container>

        <Container width={234} flexDirection="column" padding={12} gap={6} borderRadius={14} borderWidth={1} borderColor={C.line} backgroundColor={C.card}>
          <Container flexDirection="column" gap={1} flexShrink={0} marginBottom={2}>
            <Text fontSize={13} fontWeight="semi-bold" color={C.text}>
              Recent Sales
            </Text>
            <Text fontSize={10} color={C.faint}>
              {`You made ${SALES_COUNT[range]} sales this ${["week", "month", "quarter"][range]}.`}
            </Text>
          </Container>
          {sales.map((s, i) => {
            const sel = pickedSale === i
            return (
              <Press
                key={`${range}-${s.name}`}
                flexDirection="row"
                alignItems="center"
                gap={8}
                height={28}
                flexShrink={0}
                paddingX={4}
                marginX={-4}
                borderRadius={8}
                lift={1}
                backgroundColor={sel ? withOpacity(accent, 0.12) : withOpacity("#FFFFFF", 0)}
                hover={{ backgroundColor: sel ? withOpacity(accent, 0.16) : withOpacity("#FFFFFF", 0.04) }}
                onClick={() => setPickedSale(sel ? null : i)}
              >
                <Container width={26} height={26} borderRadius={13} backgroundColor={withOpacity(TINTS[i % TINTS.length], 0.25)} alignItems="center" justifyContent="center" overflow="hidden">
                  <Text fontSize={10} fontWeight="semi-bold" color={TINTS[i % TINTS.length]}>
                    {s.name
                      .split(" ")
                      .map((w) => w[0])
                      .join("")}
                  </Text>
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- uikit Image, not a DOM img */}
                  <Image positionType="absolute" positionTop={0} positionLeft={0} width={26} height={26} borderRadius={13} objectFit="cover" src={`https://picsum.photos/id/${s.img}/96/96`} />
                </Container>
                <Container flexDirection="column" flexGrow={1} flexShrink={1} gap={1}>
                  <Text fontSize={11} fontWeight="semi-bold" color={C.text}>
                    {s.name}
                  </Text>
                  <Text fontSize={9} color={C.faint}>
                    {s.email}
                  </Text>
                </Container>
                <Text fontSize={11} fontWeight="semi-bold" color={sel ? accent : C.text}>
                  {`+$${fmt(s.amount)}.00`}
                </Text>
              </Press>
            )
          })}
        </Container>
      </Container>
    </Container>
  )
}

/** One chart column: the bar springs up from zero (staggered), hover brightens it and shows a value tag. */
function Bar({ label, h, on, dim, accent, tip, onHover, delay }: { label: string; h: number; on: boolean; dim: boolean; accent: string; tip: string; onHover: (h: boolean) => void; delay: number }) {
  const t = useRef(-delay)
  const [grown, setGrown] = useState(delay <= 0)
  useFrame((_, dt) => {
    if (grown) return
    t.current += dt
    if (t.current >= 0) setGrown(true)
  })
  const [ref, s] = useSpring({ height: grown ? Math.max(3, h) : 0 }, { height: 0 })
  return (
    <Container flexGrow={1} flexBasis={0} flexDirection="column" alignItems="center" gap={6} cursor="pointer" onHoverChange={onHover}>
      <Container flexGrow={1} width="100%" flexDirection="column" justifyContent="flex-end" alignItems="center">
        {on ? (
          <Container zIndex={5} marginBottom={4} paddingX={5} height={16} borderRadius={5} alignItems="center" backgroundColor={C.text} flexShrink={0}>
            <Text fontSize={9} fontWeight="bold" color={C.deep}>
              {tip}
            </Text>
          </Container>
        ) : null}
        <Container
          ref={ref}
          {...s}
          width="100%"
          borderTopRadius={4}
          borderBottomRadius={1}
          backgroundColor={on ? accent : withOpacity(accent, dim ? 0.35 : 0.7)}
        />
      </Container>
      <Text fontSize={9} color={on ? C.text : C.faint}>
        {label}
      </Text>
    </Container>
  )
}

/** Pressable Container: lifts toward you on hover, dips on press. */
function Press({ children, lift = 3, ...props }: ContainerProperties & { lift?: number }) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const k = down ? 0.97 : 1
  const [ref, s] = useSpring({ transformTranslateZ: hover && !down ? lift : 0, transformScaleX: k, transformScaleY: k })
  return (
    <Container ref={ref} cursor="pointer" {...props} {...s} onHoverChange={setHover} onActiveChange={setDown}>
      {children}
    </Container>
  )
}

/** uikit has no CSS transitions: spring numeric props toward `to` each frame. Spread the returned values on the Container too. */
function useSpring<T extends Record<string, number>>(to: T, from: Partial<T> = {}) {
  const ref = useRef<VanillaContainer>(null)
  const s = useRef<{ x: Record<string, number>; v: Record<string, number> }>(null)
  if (!s.current) s.current = { x: { ...to, ...from }, v: {} }
  useFrame((_, dt) => {
    const { x, v } = s.current!
    const h = Math.min(dt, 1 / 30)
    let moved = false
    for (const k in to) {
      if (x[k] === to[k] && !v[k]) continue
      v[k] = (v[k] ?? 0) + ((to[k] - x[k]) * 320 - (v[k] ?? 0) * 24) * h
      x[k] += v[k] * h
      if (Math.abs(to[k] - x[k]) < 0.01 && Math.abs(v[k]) < 0.05) {
        x[k] = to[k]
        v[k] = 0
      }
      moved = true
    }
    if (moved) ref.current?.setProperties({ ...x })
  })
  return [ref, s.current.x as T] as const
}
