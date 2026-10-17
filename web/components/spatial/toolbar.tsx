"use client"

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, type ContainerProperties, type VanillaContainer } from "@react-three/uikit"
import { Circle, Frame, Hand, MessageSquare, MousePointer2, PenTool, Redo2, Square, Type, Undo2 } from "@react-three/uikit-lucide"

const C = { panel: "#15171E", border: "#323745", line: "#242833", hover: "#262A35", text: "#EEF0F4", muted: "#9AA0AD", accent: "#9FE7D2", onAccent: "#06221B" }
const ICONS = { select: MousePointer2, hand: Hand, frame: Frame, shape: Square, pen: PenTool, text: Type, comment: MessageSquare, undo: Undo2, redo: Redo2 }
const BTN = 40 // 8 cm: roomy for a fingertip, keeps the bar under 75 cm
const GAP = 4

type Tool = { id: string; icon?: keyof typeof ICONS; label?: string }
type Props = {
  /** pickable tools (one is active at a time) */
  tools?: Tool[]
  /** one-shot buttons after the divider, e.g. undo / redo */
  actions?: Tool[]
  /** id of the active tool */
  value?: string
  onChange?: (id: string) => void
  /** fired by action buttons */
  onPress?: (id: string) => void
  orientation?: "horizontal" | "vertical"
  accent?: string
}

const TOOLS: Tool[] = [
  { id: "select", icon: "select", label: "Select" },
  { id: "hand", icon: "hand", label: "Pan" },
  { id: "shape", icon: "shape", label: "Shape" },
  { id: "pen", icon: "pen", label: "Pen" },
  { id: "text", icon: "text", label: "Text" },
  { id: "comment", icon: "comment", label: "Comment" },
]
const ACTIONS: Tool[] = [
  { id: "undo", icon: "undo", label: "Undo" },
  { id: "redo", icon: "redo", label: "Redo" },
]

/** Floating tool bar: pick one tool (the highlight springs across), plus undo / redo actions. */
export default function Toolbar({ tools = TOOLS, actions = ACTIONS, value, onChange, onPress, orientation = "horizontal", accent = C.accent }: Props) {
  const [inner, setInner] = useState(tools[0]?.id ?? "")
  const active = value ?? inner
  const index = Math.max(0, tools.findIndex((t) => t.id === active))
  const row = orientation !== "vertical"
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })
  const step = index * (BTN + GAP)
  const [pill, slide] = useSpring({ positionLeft: row ? step : 0, positionTop: row ? 0 : step })

  const pick = (id: string) => {
    if (value === undefined) setInner(id)
    onChange?.(id)
  }

  return (
    <Container
      ref={panel}
      {...enter}
      pixelSize={0.002}
      flexDirection={row ? "row" : "column"}
      alignItems="center"
      gap={8}
      padding={6}
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={16}
    >
      <Container flexDirection={row ? "row" : "column"} gap={GAP}>
        <Container ref={pill} {...slide} positionType="absolute" width={BTN} height={BTN} borderRadius={12} backgroundColor={accent} />
        {tools.map((t) => {
          const Icon = (t.icon && ICONS[t.icon]) || Circle
          const on = t.id === active
          return (
            <Press key={t.id} hover={{ backgroundColor: on ? undefined : C.hover }} onClick={() => pick(t.id)}>
              <Icon width={19} height={19} color={on ? C.onAccent : C.text} />
            </Press>
          )
        })}
      </Container>
      {actions.length ? <Container width={row ? 1 : 28} height={row ? 28 : 1} backgroundColor={C.line} /> : null}
      {actions.length ? (
        <Container flexDirection={row ? "row" : "column"} gap={GAP}>
          {actions.map((a) => {
            const Icon = (a.icon && ICONS[a.icon]) || Circle
            return (
              <Press key={a.id} hover={{ backgroundColor: C.hover }} onClick={() => onPress?.(a.id)}>
                <Icon width={19} height={19} color={C.muted} />
              </Press>
            )
          })}
        </Container>
      ) : null}
    </Container>
  )
}

/** Icon button: lifts toward you on hover, dips on press. */
function Press({ children, ...props }: ContainerProperties) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const k = down ? 0.88 : 1
  const [ref, s] = useSpring({ transformTranslateZ: hover && !down ? 4 : 0, transformScaleX: k, transformScaleY: k })
  return (
    <Container
      ref={ref}
      width={BTN}
      height={BTN}
      borderRadius={12}
      alignItems="center"
      justifyContent="center"
      cursor="pointer"
      {...props}
      {...s}
      onHoverChange={setHover}
      onActiveChange={setDown}
    >
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
