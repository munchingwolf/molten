"use client"

import { useEffect, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Text, withOpacity, type VanillaContainer } from "@react-three/uikit"
import { CircleAlert, GitCommitHorizontal, GitMerge, MessageSquare, Rocket, Tag } from "@react-three/uikit-lucide"

const C = { panel: "#15171E", border: "#323745", line: "#242833", hover: "#262A35", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2" }
const KINDS = {
  merge: { icon: GitMerge, color: "#B9B4F5" },
  deploy: { icon: Rocket, color: "#9FE7D2" },
  comment: { icon: MessageSquare, color: "#8EC9F0" },
  issue: { icon: CircleAlert, color: "#F0A6B8" },
  release: { icon: Tag, color: "#F2B48A" },
  commit: { icon: GitCommitHorizontal, color: "#9AA0AD" },
}

type Activity = { id: string; actor: string; action: string; time?: string; kind?: keyof typeof KINDS }
type Props = {
  items?: Activity[]
  title?: string
  onSelect?: (item: Activity) => void
  accent?: string
}

const SAMPLE: Activity[] = [
  { id: "a1", kind: "merge", actor: "Maya Chen", action: "merged Studio v2 into main", time: "12m" },
  { id: "a2", kind: "deploy", actor: "Production", action: "deploy succeeded on spatial.app", time: "18m" },
  { id: "a3", kind: "comment", actor: "Leo Park", action: "commented on Grab bar feel", time: "1h" },
  { id: "a4", kind: "issue", actor: "Ava Ruiz", action: "opened Pinch drag drops on fast moves", time: "2h" },
  { id: "a5", kind: "release", actor: "Evan Kong", action: "tagged release v0.9", time: "4h" },
]

/** Vertical activity feed with typed icons on a connecting rail. Entries cascade in; tap one to select it. */
export default function ActivityTimeline({ items = SAMPLE, title = "Activity", onSelect, accent = C.accent }: Props) {
  const [picked, setPicked] = useState<string | null>(null)
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })

  return (
    <Container
      ref={panel}
      {...enter}
      pixelSize={0.002}
      width={330}
      flexDirection="column"
      padding={14}
      gap={10}
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={20}
    >
      <Container flexDirection="row" alignItems="center" paddingX={6}>
        <Text flexGrow={1} fontSize={16} fontWeight="semi-bold" color={C.text}>
          {title}
        </Text>
        <Text fontSize={12} color={C.faint}>
          Today
        </Text>
      </Container>
      <Container flexDirection="column">
        {items.map((e, i) => (
          <Entry
            key={e.id}
            e={e}
            index={i}
            last={i === items.length - 1}
            selected={e.id === picked}
            accent={accent}
            onPress={() => {
              setPicked(e.id)
              onSelect?.(e)
            }}
          />
        ))}
      </Container>
    </Container>
  )
}

function Entry({ e, index, last, selected, accent, onPress }: { e: Activity; index: number; last: boolean; selected: boolean; accent: string; onPress: () => void }) {
  const [shown, setShown] = useState(false)
  const [down, setDown] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 80 + index * 70)
    return () => clearTimeout(t)
  }, [index])
  const k = down ? 0.98 : 1
  const [ref, s] = useSpring({ transformTranslateX: shown ? 0 : -16, transformScaleX: k, transformScaleY: k }, { transformTranslateX: -16 })
  const kind = KINDS[e.kind ?? "commit"] ?? KINDS.commit
  const Icon = kind.icon
  return (
    <Container
      ref={ref}
      {...s}
      flexDirection="row"
      gap={12}
      paddingX={6}
      paddingTop={6}
      borderRadius={12}
      cursor="pointer"
      backgroundColor={selected ? withOpacity(accent, 0.08) : withOpacity("#FFFFFF", 0)}
      hover={{ backgroundColor: selected ? withOpacity(accent, 0.12) : withOpacity("#FFFFFF", 0.04) }}
      onActiveChange={setDown}
      onClick={onPress}
    >
      <Container flexDirection="column" alignItems="center" width={30}>
        <Container width={30} height={30} borderRadius={15} backgroundColor={withOpacity(kind.color, 0.16)} alignItems="center" justifyContent="center">
          <Icon width={15} height={15} color={kind.color} />
        </Container>
        {last ? null : <Container width={2} flexGrow={1} minHeight={14} marginTop={4} borderRadius={1} backgroundColor={C.line} />}
      </Container>
      <Container flexDirection="column" flexGrow={1} flexShrink={1} gap={2} paddingBottom={14} minHeight={50}>
        <Container flexDirection="row" alignItems="center">
          <Text flexGrow={1} fontSize={13} fontWeight="semi-bold" color={C.text}>
            {e.actor}
          </Text>
          {e.time ? (
            <Text fontSize={11} color={C.faint}>
              {e.time}
            </Text>
          ) : null}
        </Container>
        <Text fontSize={13} color={C.muted}>
          {e.action}
        </Text>
      </Container>
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
