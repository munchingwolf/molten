"use client"

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Text, type VanillaContainer } from "@react-three/uikit"

const C = { panel: "#15171E", border: "#323745", row: "#1B1E27", hover: "#262A35", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2" }
const COLORS = ["#B9B4F5", "#F2B48A", "#8EC9F0", "#F0A6B8", "#E8D58F", "#A8D8B9"]

type Person = { name: string; color?: string }
type Props = {
  people?: Person[]
  /** avatars shown before the +N chip */
  max?: number
  /** avatar diameter in px (44 px = 8.8 cm) */
  size?: number
  caption?: string
  onSelect?: (person: Person) => void
  accent?: string
}

const SAMPLE: Person[] = ["Maya Chen", "Leo Park", "Ava Ruiz", "Evan Kong", "Danny Lee", "Noor Haddad", "Sam Okafor", "Iris Tan"].map((name) => ({ name }))

const initials = (n: string) =>
  n
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

/** Overlapping presence avatars: hover one to lift it and see the name, tap +N to fan out everyone. */
export default function AvatarGroup({ people = SAMPLE, max = 5, size = 44, caption = "viewing this board", onSelect, accent = C.accent }: Props) {
  const [open, setOpen] = useState(false)
  const [hot, setHot] = useState<string | null>(null)
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })
  const limit = Math.max(1, Math.round(max) || 1)
  const shown = open ? people : people.slice(0, limit)
  const extra = people.length - shown.length
  const d = Math.max(28, size)

  return (
    <Container
      ref={panel}
      {...enter}
      pixelSize={0.002}
      flexDirection="row"
      alignItems="center"
      gap={14}
      paddingY={10}
      paddingLeft={12}
      paddingRight={18}
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={18}
    >
      <Container flexDirection="row" alignItems="center">
        {shown.map((p, i) => (
          <Avatar
            key={p.name}
            person={p}
            color={p.color ?? COLORS[i % COLORS.length]}
            size={d}
            first={i === 0}
            spread={open}
            onHover={(h) => setHot(h ? p.name : (n) => (n === p.name ? null : n))}
            onPress={() => onSelect?.(p)}
          />
        ))}
        {extra > 0 || open ? (
          <Avatar
            person={{ name: open ? "Less" : `+${extra}` }}
            label={open ? "-" : `+${extra}`}
            color={C.row}
            text={C.text}
            size={d}
            first={false}
            spread={open}
            onHover={() => {}}
            onPress={() => setOpen(!open)}
          />
        ) : null}
      </Container>
      <Container flexDirection="column" gap={2} display={open && !hot ? "none" : "flex"}>
        <Text fontSize={14} fontWeight="semi-bold" color={hot ? accent : C.text}>
          {hot ?? `${people.length} people`}
        </Text>
        <Text fontSize={11} color={C.faint}>
          {hot ? "tap to open profile" : caption}
        </Text>
      </Container>
    </Container>
  )
}

function Avatar({
  person,
  label,
  color,
  text = "#0B0C10",
  size,
  first,
  spread,
  onHover,
  onPress,
}: {
  person: Person
  label?: string
  color: string
  text?: string
  size: number
  first: boolean
  spread: boolean
  onHover: (h: boolean) => void
  onPress: () => void
}) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const k = down ? 0.92 : hover ? 1.12 : 1
  const [ref, s] = useSpring({
    marginLeft: first ? 0 : spread ? -size * 0.06 : -size * 0.3,
    transformTranslateY: hover && !down ? -6 : 0,
    transformTranslateZ: hover ? 8 : 0,
    transformScaleX: k,
    transformScaleY: k,
  })
  return (
    <Container
      ref={ref}
      {...s}
      width={size}
      height={size}
      borderRadius={size / 2}
      borderWidth={3}
      borderColor={C.panel}
      backgroundColor={color}
      alignItems="center"
      justifyContent="center"
      cursor="pointer"
      onHoverChange={(h: boolean) => {
        setHover(h)
        onHover(h)
      }}
      onActiveChange={setDown}
      onClick={onPress}
    >
      <Text fontSize={Math.round(size * 0.33)} fontWeight="bold" color={text}>
        {label ?? initials(person.name)}
      </Text>
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
      if (Math.abs(to[k] - x[k]) < 0.01 && Math.abs(v[k]) < 0.05) (x[k] = to[k]), (v[k] = 0)
      moved = true
    }
    if (moved) ref.current?.setProperties({ ...x })
  })
  return [ref, s.current.x as T] as const
}
