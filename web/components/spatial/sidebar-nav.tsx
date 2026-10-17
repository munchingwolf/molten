"use client"

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Text, withOpacity, type VanillaContainer } from "@react-three/uikit"
import { ChartColumn, Calendar, ChevronDown, Circle, FolderKanban, House, Inbox, Settings, Users } from "@react-three/uikit-lucide"

const C = { panel: "#15171E", border: "#323745", hover: "#262A35", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2", onAccent: "#06221B" }
const ICONS = { home: House, inbox: Inbox, projects: FolderKanban, calendar: Calendar, analytics: ChartColumn, team: Users, settings: Settings }
const ROW = 44
const GAP = 4

type Item = { id: string; label: string; icon?: keyof typeof ICONS; badge?: number }
type Props = {
  items?: Item[]
  /** id of the active item */
  value?: string
  onChange?: (id: string) => void
  onSelect?: (item: Item) => void
  title?: string
  subtitle?: string
  user?: string
  email?: string
  accent?: string
}

const SAMPLE: Item[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "inbox", label: "Inbox", icon: "inbox", badge: 12 },
  { id: "projects", label: "Projects", icon: "projects" },
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "analytics", label: "Analytics", icon: "analytics" },
  { id: "team", label: "Team", icon: "team", badge: 3 },
]

/** App sidebar: workspace header, icon nav with a springy active indicator, signed-in user footer. */
export default function SidebarNav({
  items = SAMPLE,
  value,
  onChange,
  onSelect,
  title = "Northwind",
  subtitle = "Pro workspace",
  user = "Maya Chen",
  email = "maya@northwind.app",
  accent = C.accent,
}: Props) {
  const [inner, setInner] = useState(items[0]?.id ?? "")
  const active = value ?? inner
  const index = Math.max(0, items.findIndex((i) => i.id === active))
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })
  const [bar, slide] = useSpring({ positionTop: index * (ROW + GAP) })

  const pick = (item: Item) => {
    if (value === undefined) setInner(item.id)
    onChange?.(item.id)
    onSelect?.(item)
  }

  return (
    <Container
      ref={panel}
      {...enter}
      pixelSize={0.002}
      width={260}
      flexDirection="column"
      padding={14}
      gap={14}
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={20}
    >
      <Container flexDirection="row" alignItems="center" gap={12} paddingX={4}>
        <Container width={36} height={36} borderRadius={10} backgroundColor={accent} alignItems="center" justifyContent="center">
          <Text fontSize={17} fontWeight="bold" color={C.onAccent}>
            {title.slice(0, 1).toUpperCase()}
          </Text>
        </Container>
        <Container flexDirection="column" flexGrow={1}>
          <Text fontSize={15} fontWeight="semi-bold" color={C.text}>
            {title}
          </Text>
          <Text fontSize={12} color={C.muted}>
            {subtitle}
          </Text>
        </Container>
        <ChevronDown width={16} height={16} color={C.faint} />
      </Container>

      <Container flexDirection="column" gap={GAP}>
        <Container
          ref={bar}
          {...slide}
          positionType="absolute"
          positionLeft={0}
          positionRight={0}
          height={ROW}
          borderRadius={12}
          backgroundColor={withOpacity(accent, 0.14)}
        >
          <Container positionType="absolute" positionLeft={0} positionTop={12} width={3} height={20} borderRadius={2} backgroundColor={accent} />
        </Container>
        {items.map((item) => (
          <NavRow key={item.id} item={item} active={item.id === active} accent={accent} onPress={() => pick(item)} />
        ))}
      </Container>

      <Container height={1} backgroundColor={C.border} />
      <Container flexDirection="row" alignItems="center" gap={10} paddingX={4}>
        <Container width={32} height={32} borderRadius={16} backgroundColor={C.hover} alignItems="center" justifyContent="center">
          <Text fontSize={12} fontWeight="semi-bold" color={C.text}>
            {initials(user)}
          </Text>
        </Container>
        <Container flexDirection="column" flexGrow={1} flexShrink={1}>
          <Text fontSize={13} fontWeight="medium" color={C.text}>
            {user}
          </Text>
          <Text fontSize={11} color={C.faint}>
            {email}
          </Text>
        </Container>
        <Settings width={16} height={16} color={C.muted} />
      </Container>
    </Container>
  )
}

function NavRow({ item, active, accent, onPress }: { item: Item; active: boolean; accent: string; onPress: () => void }) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const [ref, s] = useSpring({ transformTranslateX: hover && !down ? 3 : 0, transformScaleX: down ? 0.97 : 1, transformScaleY: down ? 0.97 : 1 })
  const Icon = (item.icon && ICONS[item.icon]) || Circle
  return (
    <Container
      ref={ref}
      {...s}
      height={ROW}
      flexDirection="row"
      alignItems="center"
      gap={12}
      paddingX={12}
      borderRadius={12}
      cursor="pointer"
      backgroundColor={withOpacity("#FFFFFF", 0)}
      hover={{ backgroundColor: withOpacity("#FFFFFF", active ? 0 : 0.05) }}
      onHoverChange={setHover}
      onActiveChange={setDown}
      onClick={onPress}
    >
      <Icon width={18} height={18} color={active ? accent : C.muted} />
      <Text flexGrow={1} fontSize={14} fontWeight={active ? "semi-bold" : "medium"} color={active ? C.text : C.muted}>
        {item.label}
      </Text>
      {item.badge ? (
        <Container minWidth={22} height={20} paddingX={6} borderRadius={10} alignItems="center" justifyContent="center" backgroundColor={active ? accent : C.hover}>
          <Text fontSize={11} fontWeight="semi-bold" color={active ? C.onAccent : C.text}>
            {String(item.badge)}
          </Text>
        </Container>
      ) : null}
    </Container>
  )
}

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

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
      if (Math.abs(to[k] - x[k]) < 0.01 && Math.abs(v[k]) < 0.05) (x[k] = to[k]), (v[k] = 0)
      moved = true
    }
    if (moved) ref.current?.setProperties({ ...x })
  })
  return [ref, s.current.x as T] as const
}
