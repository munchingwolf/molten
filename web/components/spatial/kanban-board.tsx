"use client"

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Text, withOpacity, type ContainerProperties, type VanillaContainer } from "@react-three/uikit"
import { CircleCheck } from "@react-three/uikit-lucide"

const C = { panel: "#15171E", deep: "#101218", border: "#323745", line: "#242833", card: "#1B1E27", hover: "#262A35", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2" }
const TAGS: Record<string, string> = { Design: "#B9B4F5", Docs: "#8EC9F0", Bug: "#F0A6B8", Audio: "#F2B48A", XR: "#8EC9F0", AI: "#B9B4F5" }
const DOTS = ["#9AA0AD", "#F2B48A", "#9FE7D2"]

type Card = { id: string; title: string; tag?: string; assignee?: string }
type Column = { id: string; title: string; cards: Card[] }
type Props = {
  /** the board's columns and cards */
  value?: Column[]
  onChange?: (columns: Column[]) => void
  /** fired when a tap moves a card to the next column */
  onMove?: (card: Card, toColumnId: string) => void
  title?: string
  accent?: string
}

const SAMPLE: Column[] = [
  {
    id: "todo",
    title: "To do",
    cards: [
      { id: "c1", title: "Design onboarding", tag: "Design", assignee: "Maya Chen" },
      { id: "c2", title: "Write API docs", tag: "Docs", assignee: "Leo Park" },
      { id: "c3", title: "Fix pinch drag", tag: "Bug", assignee: "Ava Ruiz" },
    ],
  },
  {
    id: "doing",
    title: "In progress",
    cards: [
      { id: "c4", title: "Voice commands", tag: "AI", assignee: "Evan Kong" },
      { id: "c5", title: "Mixer strip", tag: "Audio", assignee: "Danny Lee" },
    ],
  },
  {
    id: "done",
    title: "Done",
    cards: [
      { id: "c6", title: "Grab bar", tag: "XR", assignee: "Evan Kong" },
      { id: "c7", title: "Night theme", tag: "Design", assignee: "Danny Lee" },
    ],
  },
]

const initials = (n = "") =>
  n
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

/** Three-column kanban board. Tap a card to move it to the next column (Done wraps back to the first). */
export default function KanbanBoard({ value, onChange, onMove, title = "Sprint 14", accent = C.accent }: Props) {
  const [inner, setInner] = useState(SAMPLE)
  const cols = value ?? inner
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })
  const total = cols.reduce((n, c) => n + c.cards.length, 0)
  const done = cols[cols.length - 1]?.cards.length ?? 0

  const move = (ci: number, card: Card) => {
    const to = (ci + 1) % cols.length
    const next = cols.map((c, i) =>
      i === ci ? { ...c, cards: c.cards.filter((k) => k.id !== card.id) } : i === to ? { ...c, cards: [...c.cards, card] } : c,
    )
    if (value === undefined) setInner(next)
    onChange?.(next)
    onMove?.(card, cols[to].id)
  }

  return (
    <Container
      ref={panel}
      {...enter}
      pixelSize={0.002}
      flexDirection="column"
      padding={14}
      gap={12}
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={20}
    >
      <Container flexDirection="row" alignItems="center" gap={10} paddingX={4}>
        <Container flexDirection="column" flexGrow={1}>
          <Text fontSize={16} fontWeight="semi-bold" color={C.text}>
            {title}
          </Text>
          <Text fontSize={11} color={C.faint}>
            Tap a card to move it along
          </Text>
        </Container>
        <Text fontSize={12} fontWeight="semi-bold" color={accent}>
          {`${done}/${total} done`}
        </Text>
      </Container>

      <Container flexDirection="row" gap={8} alignItems="flex-start">
        {cols.map((col, ci) => (
          <Container key={col.id} width={108} flexDirection="column" gap={8} padding={8} borderRadius={14} backgroundColor={C.deep} minHeight={220}>
            <Container flexDirection="row" alignItems="center" gap={6} paddingX={4} height={24}>
              <Container width={8} height={8} borderRadius={4} backgroundColor={DOTS[Math.min(ci, DOTS.length - 1)]} />
              <Text flexGrow={1} fontSize={12} fontWeight="semi-bold" color={C.text}>
                {col.title}
              </Text>
              <Text fontSize={11} color={C.faint}>
                {String(col.cards.length)}
              </Text>
            </Container>
            {col.cards.map((card) => (
              <CardView key={card.id} card={card} done={ci === cols.length - 1} accent={accent} onPress={() => move(ci, card)} />
            ))}
            {col.cards.length === 0 ? (
              <Container height={56} borderRadius={12} borderWidth={1} borderColor={C.line} alignItems="center" justifyContent="center">
                <Text fontSize={11} color={C.faint}>
                  No cards
                </Text>
              </Container>
            ) : null}
          </Container>
        ))}
      </Container>
    </Container>
  )
}

function CardView({ card, done, accent, onPress }: { card: Card; done: boolean; accent: string; onPress: () => void }) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const k = down ? 0.95 : hover ? 1.03 : 1
  // starts small so a card that just moved pops into its new column
  const [ref, s] = useSpring(
    { transformTranslateZ: hover && !down ? 6 : 0, transformScaleX: k, transformScaleY: k },
    { transformScaleX: 0.8, transformScaleY: 0.8 },
  )
  const tag = card.tag ? TAGS[card.tag] ?? C.muted : null
  return (
    <Container
      ref={ref}
      {...s}
      flexDirection="column"
      gap={8}
      padding={10}
      minHeight={44}
      borderRadius={12}
      backgroundColor={C.card}
      borderWidth={1}
      borderColor={hover ? withOpacity(accent, 0.5) : C.line}
      cursor="pointer"
      onHoverChange={setHover}
      onActiveChange={setDown}
      onClick={onPress}
    >
      <Container flexDirection="row" gap={6} alignItems="flex-start">
        {done ? <CircleCheck width={14} height={14} color={accent} marginTop={1} /> : null}
        <Text flexShrink={1} fontSize={12} fontWeight="medium" color={done ? C.muted : C.text}>
          {card.title}
        </Text>
      </Container>
      <Container flexDirection="row" alignItems="center" justifyContent="space-between">
        {tag ? (
          <Container height={18} paddingX={6} borderRadius={5} backgroundColor={withOpacity(tag, 0.16)} alignItems="center">
            <Text fontSize={10} fontWeight="semi-bold" color={tag}>
              {card.tag!}
            </Text>
          </Container>
        ) : (
          <Container />
        )}
        {card.assignee ? (
          <Container width={22} height={22} borderRadius={11} backgroundColor={C.hover} alignItems="center" justifyContent="center">
            <Text fontSize={9} fontWeight="semi-bold" color={C.text}>
              {initials(card.assignee)}
            </Text>
          </Container>
        ) : null}
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
