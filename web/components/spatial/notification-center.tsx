"use client"

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Text, withOpacity, type ContainerProperties, type VanillaContainer } from "@react-three/uikit"
import { AtSign, BellOff, MessageSquare, Rocket, TriangleAlert, UserPlus, X } from "@react-three/uikit-lucide"

const C = { panel: "#15171E", border: "#323745", line: "#242833", row: "#1B1E27", hover: "#262A35", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2", onAccent: "#06221B" }
const KINDS = {
  deploy: { icon: Rocket, color: "#9FE7D2" },
  mention: { icon: AtSign, color: "#8EC9F0" },
  invite: { icon: UserPlus, color: "#B9B4F5" },
  alert: { icon: TriangleAlert, color: "#F2B48A" },
  comment: { icon: MessageSquare, color: "#B9B4F5" },
}

type Note = { id: string; title: string; body?: string; time?: string; kind?: keyof typeof KINDS; unread?: boolean }
type Props = {
  items?: Note[]
  onSelect?: (item: Note) => void
  onDismiss?: (item: Note) => void
  onClearAll?: () => void
  accent?: string
}

const SAMPLE: Note[] = [
  { id: "n1", kind: "deploy", title: "Deploy succeeded", body: "spatial-web is live on production", time: "2m", unread: true },
  { id: "n2", kind: "mention", title: "Leo mentioned you", body: "Can you check the grab bar on Quest?", time: "14m", unread: true },
  { id: "n3", kind: "invite", title: "Ava invited you", body: "Join the Night Studio workspace", time: "1h" },
  { id: "n4", kind: "alert", title: "Storage almost full", body: "92% of 10 GB used", time: "3h" },
]

/** Notification center: tap to mark read, X to dismiss (slides away), Clear all, and an empty state. */
export default function NotificationCenter({ items = SAMPLE, onSelect, onDismiss, onClearAll, accent = C.accent }: Props) {
  const [list, setList] = useState(items)
  const [read, setRead] = useState<string[]>([])
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })
  const unread = list.filter((n) => n.unread && !read.includes(n.id)).length

  return (
    <Container
      ref={panel}
      {...enter}
      pixelSize={0.002}
      width={340}
      flexDirection="column"
      padding={14}
      gap={10}
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={20}
      overflow="hidden"
    >
      <Container flexDirection="row" alignItems="center" gap={8} paddingX={4}>
        <Text fontSize={16} fontWeight="semi-bold" color={C.text}>
          Notifications
        </Text>
        {unread > 0 ? (
          <Container height={20} minWidth={20} paddingX={6} borderRadius={10} backgroundColor={accent} alignItems="center" justifyContent="center">
            <Text fontSize={11} fontWeight="bold" color={C.onAccent}>
              {String(unread)}
            </Text>
          </Container>
        ) : null}
        <Container flexGrow={1} />
        {list.length > 0 ? (
          <Press
            height={32}
            paddingX={10}
            borderRadius={8}
            alignItems="center"
            hover={{ backgroundColor: C.hover }}
            onClick={() => {
              setList([])
              onClearAll?.()
            }}
          >
            <Text fontSize={12} fontWeight="semi-bold" color={C.muted}>
              Clear all
            </Text>
          </Press>
        ) : null}
      </Container>

      {list.length === 0 ? (
        <Container height={160} flexDirection="column" alignItems="center" justifyContent="center" gap={8}>
          <Container width={48} height={48} borderRadius={14} backgroundColor={C.row} alignItems="center" justifyContent="center">
            <BellOff width={22} height={22} color={C.faint} />
          </Container>
          <Text fontSize={14} fontWeight="semi-bold" color={C.text}>
            {"You're all caught up"}
          </Text>
          <Text fontSize={12} color={C.faint}>
            New notifications will show up here
          </Text>
        </Container>
      ) : (
        <Container flexDirection="column" gap={6}>
          {list.map((n) => (
            <Row
              key={n.id}
              n={n}
              unread={!!n.unread && !read.includes(n.id)}
              accent={accent}
              onPress={() => {
                setRead((r) => [...r, n.id])
                onSelect?.(n)
              }}
              onGone={() => {
                setList((l) => l.filter((x) => x.id !== n.id))
                onDismiss?.(n)
              }}
            />
          ))}
        </Container>
      )}
    </Container>
  )
}

function Row({ n, unread, accent, onPress, onGone }: { n: Note; unread: boolean; accent: string; onPress: () => void; onGone: () => void }) {
  const [leaving, setLeaving] = useState(false)
  const [down, setDown] = useState(false)
  const gone = useRef(false) // the X's click bubbles to the row; don't count it as opening
  const k = leaving ? 0.9 : down ? 0.98 : 1
  const [ref, s] = useSpring({ transformTranslateX: leaving ? 120 : 0, transformScaleX: k, transformScaleY: k })
  const kind = KINDS[n.kind ?? "comment"] ?? KINDS.comment
  const Icon = kind.icon
  const dismiss = () => {
    if (gone.current) return
    gone.current = true
    setLeaving(true)
    setTimeout(onGone, 220)
  }
  return (
    <Container
      ref={ref}
      {...s}
      flexDirection="row"
      alignItems="flex-start"
      gap={12}
      padding={12}
      minHeight={64}
      borderRadius={14}
      backgroundColor={unread ? withOpacity(accent, 0.06) : C.row}
      borderWidth={1}
      borderColor={unread ? withOpacity(accent, 0.25) : C.line}
      hover={{ backgroundColor: C.hover }}
      cursor="pointer"
      onActiveChange={setDown}
      onClick={() => !gone.current && onPress()}
    >
      <Container width={34} height={34} borderRadius={10} backgroundColor={withOpacity(kind.color, 0.15)} alignItems="center" justifyContent="center">
        <Icon width={17} height={17} color={kind.color} />
      </Container>
      <Container flexDirection="column" flexGrow={1} flexShrink={1} gap={2}>
        <Container flexDirection="row" alignItems="center" gap={6}>
          <Text flexShrink={1} fontSize={13} fontWeight="semi-bold" color={C.text}>
            {n.title}
          </Text>
          {unread ? <Container width={6} height={6} borderRadius={3} backgroundColor={accent} /> : null}
        </Container>
        {n.body ? (
          <Text fontSize={12} color={C.muted}>
            {n.body}
          </Text>
        ) : null}
        {n.time ? (
          <Text fontSize={11} color={C.faint}>
            {`${n.time} ago`}
          </Text>
        ) : null}
      </Container>
      <Press width={32} height={32} borderRadius={9} alignItems="center" justifyContent="center" hover={{ backgroundColor: withOpacity("#FFFFFF", 0.08) }} onClick={dismiss}>
        <X width={15} height={15} color={C.muted} />
      </Press>
    </Container>
  )
}

/** Pressable Container: lifts toward you on hover, dips on press. */
function Press({ children, ...props }: ContainerProperties) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const k = down ? 0.92 : 1
  const [ref, s] = useSpring({ transformTranslateZ: hover && !down ? 3 : 0, transformScaleX: k, transformScaleY: k })
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
