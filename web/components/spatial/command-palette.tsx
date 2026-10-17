"use client"

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Input, Text, withOpacity, type ContainerProperties, type VanillaContainer } from "@react-three/uikit"
import { Circle, Command, CornerDownLeft, FilePlus, FolderOpen, Moon, Rocket, Search, Settings, Sparkles, Users } from "@react-three/uikit-lucide"

const C = { panel: "#15171E", deep: "#101218", border: "#323745", line: "#242833", row: "#1B1E27", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2" }
const ICONS = { ai: Sparkles, file: FilePlus, open: FolderOpen, deploy: Rocket, invite: Users, theme: Moon, settings: Settings }

type Cmd = { id: string; label: string; group?: string; icon?: keyof typeof ICONS; shortcut?: string }
type Props = {
  items?: Cmd[]
  /** the search query */
  value?: string
  onChange?: (query: string) => void
  onSelect?: (item: Cmd) => void
  placeholder?: string
  accent?: string
}

const SAMPLE: Cmd[] = [
  { id: "ask", label: "Ask AI to build a panel", group: "Suggestions", icon: "ai", shortcut: "Ctrl J" },
  { id: "new", label: "New file", group: "Suggestions", icon: "file", shortcut: "Ctrl N" },
  { id: "open", label: "Open project", group: "Suggestions", icon: "open", shortcut: "Ctrl O" },
  { id: "deploy", label: "Deploy to production", group: "Actions", icon: "deploy" },
  { id: "invite", label: "Invite teammate", group: "Actions", icon: "invite" },
  { id: "theme", label: "Toggle dark mode", group: "Actions", icon: "theme", shortcut: "Ctrl T" },
  { id: "settings", label: "Open settings", group: "Actions", icon: "settings", shortcut: "Ctrl ," },
]

/** Command palette: search field plus a grouped, live-filtered command list. Tap a row to run it. */
export default function CommandPalette({ items = SAMPLE, value, onChange, onSelect, placeholder = "Type a command or search", accent = C.accent }: Props) {
  const [inner, setInner] = useState("")
  const [focused, setFocused] = useState(false)
  const [hot, setHot] = useState<string | null>(null)
  const query = value ?? inner
  const q = query.trim().toLowerCase()
  const shown = items.filter((i) => !q || i.label.toLowerCase().includes(q) || (i.group ?? "").toLowerCase().includes(q))
  const activeId = shown.some((i) => i.id === hot) ? hot : shown[0]?.id
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })

  const type = (v: string) => {
    if (value === undefined) setInner(v)
    onChange?.(v)
  }

  return (
    <Container
      ref={panel}
      {...enter}
      pixelSize={0.002}
      width={360}
      flexDirection="column"
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={focused ? withOpacity(accent, 0.6) : C.border}
      borderRadius={20}
      overflow="hidden"
    >
      <Container height={56} flexDirection="row" alignItems="center" gap={12} paddingX={18} borderBottomWidth={1} borderColor={C.line}>
        <Search width={18} height={18} color={focused ? accent : C.muted} />
        <Input
          flexGrow={1}
          fontSize={15}
          color={C.text}
          value={query}
          placeholder={placeholder}
          placeholderStyle={{ color: C.faint }}
          onValueChange={type}
          onFocusChange={setFocused}
        />
        <Container height={24} paddingX={8} borderRadius={6} backgroundColor={C.row} alignItems="center" justifyContent="center">
          <Text fontSize={11} fontWeight="semi-bold" color={C.muted}>
            Esc
          </Text>
        </Container>
      </Container>

      <Container flexDirection="column" padding={8} gap={2} maxHeight={320} overflow="scroll" scrollbarWidth={0}>
        {shown.length === 0 ? (
          <Container height={120} flexDirection="column" alignItems="center" justifyContent="center" gap={6}>
            <Text fontSize={14} fontWeight="medium" color={C.text}>
              {`No results for "${query.trim()}"`}
            </Text>
            <Text fontSize={12} color={C.faint}>
              Try deploy, settings or theme
            </Text>
          </Container>
        ) : (
          shown.map((item, i) => {
            const Icon = (item.icon && ICONS[item.icon]) || Circle
            const active = item.id === activeId
            const header = item.group && item.group !== shown[i - 1]?.group
            return (
              <Container key={item.id} flexDirection="column">
                {header ? (
                  <Text fontSize={11} fontWeight="semi-bold" color={C.faint} letterSpacing={1} paddingX={12} paddingTop={i === 0 ? 6 : 12} paddingBottom={6}>
                    {item.group!.toUpperCase()}
                  </Text>
                ) : null}
                <Press
                  height={44}
                  flexDirection="row"
                  alignItems="center"
                  gap={12}
                  paddingX={12}
                  borderRadius={12}
                  backgroundColor={active ? withOpacity(accent, 0.12) : withOpacity("#FFFFFF", 0)}
                  onPointerOver={() => setHot(item.id)}
                  onClick={() => onSelect?.(item)}
                >
                  <Icon width={18} height={18} color={active ? accent : C.muted} />
                  <Text flexGrow={1} fontSize={14} fontWeight="medium" color={active ? C.text : C.muted}>
                    {item.label}
                  </Text>
                  {active ? (
                    <CornerDownLeft width={16} height={16} color={accent} />
                  ) : item.shortcut ? (
                    <Text fontSize={11} color={C.faint}>
                      {item.shortcut}
                    </Text>
                  ) : null}
                </Press>
              </Container>
            )
          })
        )}
      </Container>

      <Container height={40} flexDirection="row" alignItems="center" gap={8} paddingX={18} backgroundColor={C.deep} borderTopWidth={1} borderColor={C.line}>
        <Command width={14} height={14} color={C.faint} />
        <Text flexGrow={1} fontSize={12} color={C.faint}>
          Tap a command to run it
        </Text>
        <Text fontSize={12} color={C.faint}>
          {`${shown.length} result${shown.length === 1 ? "" : "s"}`}
        </Text>
      </Container>
    </Container>
  )
}

/** Pressable Container: lifts toward you on hover, dips on press. */
function Press({ children, ...props }: ContainerProperties) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const k = down ? 0.97 : 1
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
