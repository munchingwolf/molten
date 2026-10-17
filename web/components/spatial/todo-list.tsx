"use client"

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Input, Text, withOpacity, type ContainerProperties, type VanillaContainer } from "@react-three/uikit"
import { Check, Plus } from "@react-three/uikit-lucide"

const C = { panel: "#15171E", deep: "#101218", border: "#323745", line: "#242833", row: "#1B1E27", hover: "#262A35", track: "#2A2E3A", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2", onAccent: "#06221B" }
const W = 300

type Todo = { id: string; label: string; done?: boolean; meta?: string }
type Props = {
  /** the list */
  value?: Todo[]
  onChange?: (items: Todo[]) => void
  onToggle?: (item: Todo) => void
  title?: string
  accent?: string
}

const SAMPLE: Todo[] = [
  { id: "t1", label: "Review Quest build", done: true, meta: "9:30" },
  { id: "t2", label: "Record the demo video", meta: "5:45" },
  { id: "t3", label: "Polish the mixer strip", done: true, meta: "Design" },
  { id: "t4", label: "Wire voice to the inspector", meta: "AI" },
  { id: "t5", label: "Submit before 6:30 PM", meta: "Today" },
]

/** To-do list: tap a row to check it off, a springy progress bar, and a field to add tasks. */
export default function TodoList({ value, onChange, onToggle, title = "Today", accent = C.accent }: Props) {
  const [inner, setInner] = useState(SAMPLE)
  const [draft, setDraft] = useState("")
  const items = value ?? inner
  const done = items.filter((i) => i.done).length
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })
  const [bar, fill] = useSpring({ width: items.length ? (done / items.length) * W : 0 }, { width: 0 })

  const commit = (next: Todo[]) => {
    if (value === undefined) setInner(next)
    onChange?.(next)
  }
  const toggle = (item: Todo) => {
    commit(items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))
    onToggle?.({ ...item, done: !item.done })
  }
  const add = () => {
    const label = draft.trim()
    if (!label) return
    commit([...items, { id: `t-${Date.now()}`, label }])
    setDraft("")
  }

  return (
    <Container
      ref={panel}
      {...enter}
      pixelSize={0.002}
      width={W + 36}
      flexDirection="column"
      padding={18}
      gap={14}
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={20}
    >
      <Container flexDirection="column" gap={10}>
        <Container flexDirection="row" alignItems="flex-end">
          <Text flexGrow={1} fontSize={18} fontWeight="semi-bold" color={C.text}>
            {title}
          </Text>
          <Text fontSize={12} fontWeight="semi-bold" color={done === items.length && items.length ? accent : C.muted}>
            {done === items.length && items.length ? "All done" : `${done} of ${items.length} done`}
          </Text>
        </Container>
        <Container width={W} height={6} borderRadius={3} backgroundColor={C.track}>
          <Container ref={bar} {...fill} height={6} borderRadius={3} backgroundColor={accent} />
        </Container>
      </Container>

      <Container flexDirection="column" gap={2}>
        {items.map((item) => (
          <Row key={item.id} item={item} accent={accent} onPress={() => toggle(item)} />
        ))}
      </Container>

      <Container flexDirection="row" alignItems="center" gap={8}>
        <Container flexGrow={1} height={44} paddingX={14} borderRadius={12} backgroundColor={C.deep} borderWidth={1} borderColor={C.border} alignItems="center">
          <Input width="100%" fontSize={13} color={C.text} value={draft} placeholder="Add a task..." placeholderStyle={{ color: C.faint }} onValueChange={setDraft} />
        </Container>
        <Press
          width={44}
          height={44}
          borderRadius={12}
          alignItems="center"
          justifyContent="center"
          backgroundColor={draft.trim() ? accent : C.row}
          hover={{ backgroundColor: draft.trim() ? accent : C.hover }}
          onClick={add}
        >
          <Plus width={18} height={18} color={draft.trim() ? C.onAccent : C.muted} />
        </Press>
      </Container>
    </Container>
  )
}

function Row({ item, accent, onPress }: { item: Todo; accent: string; onPress: () => void }) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const k = down ? 0.97 : 1
  const [ref, s] = useSpring({ transformTranslateZ: hover && !down ? 3 : 0, transformScaleX: k, transformScaleY: k })
  return (
    <Container
      ref={ref}
      {...s}
      height={48}
      flexDirection="row"
      alignItems="center"
      gap={12}
      paddingX={10}
      borderRadius={12}
      cursor="pointer"
      backgroundColor={withOpacity("#FFFFFF", 0)}
      hover={{ backgroundColor: withOpacity("#FFFFFF", 0.05) }}
      onHoverChange={setHover}
      onActiveChange={setDown}
      onClick={onPress}
    >
      <Box done={!!item.done} accent={accent} />
      <Text flexGrow={1} flexShrink={1} fontSize={14} fontWeight="medium" color={item.done ? C.faint : C.text}>
        {item.label}
      </Text>
      {item.meta ? (
        <Container height={22} paddingX={8} borderRadius={6} backgroundColor={C.row} alignItems="center">
          <Text fontSize={11} color={C.muted}>
            {item.meta}
          </Text>
        </Container>
      ) : null}
    </Container>
  )
}

/** Checkbox square; the tick pops in with a spring. */
function Box({ done, accent }: { done: boolean; accent: string }) {
  const [ref, s] = useSpring({ transformScaleX: done ? 1 : 0, transformScaleY: done ? 1 : 0 })
  return (
    <Container width={24} height={24} borderRadius={8} borderWidth={done ? 0 : 1.5} borderColor={C.border} alignItems="center" justifyContent="center">
      <Container ref={ref} {...s} positionType="absolute" width={24} height={24} borderRadius={8} backgroundColor={accent} alignItems="center" justifyContent="center">
        <Check width={15} height={15} color={C.onAccent} />
      </Container>
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
