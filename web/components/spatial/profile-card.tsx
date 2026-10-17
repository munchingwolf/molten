"use client"

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Text, withOpacity, type ContainerProperties, type VanillaContainer } from "@react-three/uikit"
import { Check, MapPin, MessageCircle, UserPlus } from "@react-three/uikit-lucide"

const C = { panel: "#15171E", border: "#323745", line: "#242833", row: "#1B1E27", hover: "#262A35", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2", onAccent: "#06221B", warm: "#F2B48A", avatar: "#B9B4F5" }

type Stat = { label: string; value: string }
type Props = {
  name?: string
  role?: string
  location?: string
  bio?: string
  stats?: Stat[]
  /** following this person */
  value?: boolean
  onChange?: (following: boolean) => void
  onMessage?: () => void
  online?: boolean
  accent?: string
}

/** Profile card: cover, avatar with presence dot, bio, stats and Follow / Message actions. */
export default function ProfileCard({
  name = "Maya Chen",
  role = "Product Designer at Northwind",
  location = "Lisbon, Portugal",
  bio = "Designs spatial tools for people who build in 3D.",
  stats = [
    { label: "Projects", value: "24" },
    { label: "Followers", value: "1.2k" },
    { label: "Following", value: "180" },
  ],
  value,
  onChange,
  onMessage,
  online = true,
  accent = C.accent,
}: Props) {
  const [inner, setInner] = useState(false)
  const following = value ?? inner
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })
  const toggle = () => {
    if (value === undefined) setInner(!following)
    onChange?.(!following)
  }
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <Container
      ref={panel}
      {...enter}
      pixelSize={0.002}
      width={300}
      flexDirection="column"
      alignItems="center"
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={22}
      overflow="hidden"
      paddingBottom={20}
    >
      <Container width="100%" height={84} backgroundColor={withOpacity(accent, 0.1)} overflow="hidden">
        <Container positionType="absolute" positionRight={-30} positionTop={-50} width={150} height={150} borderRadius={75} backgroundColor={withOpacity(C.warm, 0.22)} />
        <Container positionType="absolute" positionLeft={-20} positionTop={30} width={110} height={110} borderRadius={55} backgroundColor={withOpacity(C.avatar, 0.2)} />
      </Container>

      <Container marginTop={-42} width={84} height={84} borderRadius={42} borderWidth={4} borderColor={C.panel} backgroundColor={C.avatar} alignItems="center" justifyContent="center">
        <Text fontSize={28} fontWeight="bold" color="#0B0C10">
          {initials}
        </Text>
        {online ? (
          <Container positionType="absolute" positionRight={2} positionBottom={2} width={16} height={16} borderRadius={8} borderWidth={3} borderColor={C.panel} backgroundColor={accent} />
        ) : null}
      </Container>

      <Container flexDirection="column" alignItems="center" gap={4} paddingX={20} paddingTop={10}>
        <Text fontSize={19} fontWeight="semi-bold" color={C.text}>
          {name}
        </Text>
        <Text fontSize={13} color={C.muted}>
          {role}
        </Text>
        <Container flexDirection="row" alignItems="center" gap={5} marginTop={2}>
          <MapPin width={13} height={13} color={C.faint} />
          <Text fontSize={12} color={C.faint}>
            {location}
          </Text>
        </Container>
        <Text fontSize={13} color={C.text} textAlign="center" marginTop={8}>
          {bio}
        </Text>
      </Container>

      <Container flexDirection="row" width="100%" paddingX={20} marginTop={16}>
        {stats.map((s, i) => (
          <Container key={s.label} flexGrow={1} flexBasis={0} flexDirection="column" alignItems="center" gap={2} borderLeftWidth={i ? 1 : 0} borderColor={C.line}>
            <Text fontSize={17} fontWeight="semi-bold" color={C.text}>
              {s.value}
            </Text>
            <Text fontSize={11} color={C.faint}>
              {s.label}
            </Text>
          </Container>
        ))}
      </Container>

      <Container flexDirection="row" width="100%" gap={10} paddingX={20} marginTop={18}>
        <Press
          flexGrow={1}
          height={44}
          borderRadius={12}
          flexDirection="row"
          gap={8}
          alignItems="center"
          justifyContent="center"
          backgroundColor={following ? withOpacity(accent, 0) : accent}
          borderWidth={1.5}
          borderColor={following ? C.border : accent}
          hover={{ backgroundColor: following ? C.hover : withOpacity(accent, 0.88) }}
          onClick={toggle}
        >
          {following ? <Check width={17} height={17} color={C.text} /> : <UserPlus width={17} height={17} color={C.onAccent} />}
          <Text fontSize={14} fontWeight="semi-bold" color={following ? C.text : C.onAccent}>
            {following ? "Following" : "Follow"}
          </Text>
        </Press>
        <Press
          flexGrow={1}
          height={44}
          borderRadius={12}
          flexDirection="row"
          gap={8}
          alignItems="center"
          justifyContent="center"
          backgroundColor={C.row}
          borderWidth={1.5}
          borderColor={C.border}
          hover={{ backgroundColor: C.hover }}
          onClick={onMessage}
        >
          <MessageCircle width={17} height={17} color={C.text} />
          <Text fontSize={14} fontWeight="semi-bold" color={C.text}>
            Message
          </Text>
        </Press>
      </Container>
    </Container>
  )
}

/** Pressable Container: lifts toward you on hover, dips on press. */
function Press({ children, ...props }: ContainerProperties) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const k = down ? 0.95 : 1
  const [ref, s] = useSpring({ transformTranslateZ: hover && !down ? 4 : 0, transformScaleX: k, transformScaleY: k })
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
      if (Math.abs(to[k] - x[k]) < 0.01 && Math.abs(v[k]) < 0.05) (x[k] = to[k]), (v[k] = 0)
      moved = true
    }
    if (moved) ref.current?.setProperties({ ...x })
  })
  return [ref, s.current.x as T] as const
}
