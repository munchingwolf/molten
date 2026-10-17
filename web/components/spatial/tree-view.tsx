"use client"

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Text, withOpacity, type VanillaContainer } from "@react-three/uikit"
import { AudioLines, Box, ChevronRight, Grid3x3, Layers, Lightbulb, Mountain, PanelLeft, Sun } from "@react-three/uikit-lucide"

const C = { panel: "#15171E", border: "#323745", line: "#242833", row: "#1B1E27", hover: "#262A35", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2" }
const ICONS = { layers: Layers, mountain: Mountain, sun: Sun, grid: Grid3x3, panel: PanelLeft, audio: AudioLines, light: Lightbulb, box: Box }
const ROW = 44
const INDENT = 18

type Node = { id: string; label: string; icon?: keyof typeof ICONS; children?: Node[] }
type Props = {
  items?: Node[]
  /** id of the selected node */
  value?: string
  onChange?: (id: string) => void
  onSelect?: (node: Node) => void
  onToggle?: (id: string, open: boolean) => void
  /** ids open on first render */
  defaultExpanded?: string[]
  title?: string
  accent?: string
}

const SAMPLE: Node[] = [
  {
    id: "scene",
    label: "Scene",
    icon: "layers",
    children: [
      { id: "env", label: "Environment", icon: "mountain", children: [{ id: "sky", label: "Sky dome", icon: "sun" }, { id: "floor", label: "Grid floor", icon: "grid" }] },
      {
        id: "ui",
        label: "Interface",
        icon: "panel",
        children: [
          { id: "sidebar", label: "Sidebar nav", icon: "box" },
          { id: "palette", label: "Command palette", icon: "box" },
          { id: "toolbar", label: "Toolbar", icon: "box" },
        ],
      },
      { id: "audio", label: "Audio", icon: "audio", children: [{ id: "pads", label: "Drum pads", icon: "box" }, { id: "mixer", label: "Mixer strip", icon: "box" }] },
      { id: "key", label: "Key light", icon: "light" },
    ],
  },
]

const count = (ns: Node[]): number => ns.reduce((n, x) => n + 1 + count(x.children ?? []), 0)

/** Expandable tree (outline, layers, folders): tap a branch to open or close it, tap any node to select it. */
export default function TreeView({ items = SAMPLE, value, onChange, onSelect, onToggle, defaultExpanded = ["scene"], title = "Outline", accent = C.accent }: Props) {
  const [open, setOpen] = useState<string[]>(defaultExpanded)
  const [inner, setInner] = useState("")
  const selected = value ?? inner
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })

  const press = (n: Node) => {
    if (n.children) {
      const isOpen = open.includes(n.id)
      setOpen(isOpen ? open.filter((x) => x !== n.id) : [...open, n.id])
      onToggle?.(n.id, !isOpen)
    }
    if (value === undefined) setInner(n.id)
    onChange?.(n.id)
    onSelect?.(n)
  }

  const rows: React.ReactNode[] = []
  const walk = (ns: Node[], depth: number) => {
    for (const n of ns) {
      const isOpen = !!n.children && open.includes(n.id)
      rows.push(<TreeRow key={n.id} node={n} depth={depth} open={isOpen} selected={n.id === selected} accent={accent} onPress={() => press(n)} />)
      if (isOpen) walk(n.children!, depth + 1)
    }
  }
  walk(items, 0)

  return (
    <Container
      ref={panel}
      {...enter}
      pixelSize={0.002}
      width={280}
      flexDirection="column"
      padding={10}
      gap={6}
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={20}
    >
      <Container flexDirection="row" alignItems="center" paddingX={8} height={32}>
        <Text flexGrow={1} fontSize={14} fontWeight="semi-bold" color={C.text}>
          {title}
        </Text>
        <Text fontSize={11} color={C.faint}>
          {`${count(items)} objects`}
        </Text>
      </Container>
      <Container flexDirection="column">{rows}</Container>
    </Container>
  )
}

function TreeRow({ node, depth, open, selected, accent, onPress }: { node: Node; depth: number; open: boolean; selected: boolean; accent: string; onPress: () => void }) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const k = down ? 0.97 : 1
  // rows slide down out of their parent when it opens
  const [ref, s] = useSpring({ transformTranslateY: 0, transformTranslateZ: hover && !down ? 3 : 0, transformScaleX: k, transformScaleY: k }, { transformTranslateY: depth ? -10 : 0 })
  const [chev, rot] = useSpring({ transformRotateZ: open ? -90 : 0 })
  const Icon = (node.icon && ICONS[node.icon]) || Box
  return (
    <Container
      ref={ref}
      {...s}
      height={ROW}
      flexDirection="row"
      alignItems="center"
      paddingRight={10}
      borderRadius={10}
      cursor="pointer"
      backgroundColor={selected ? withOpacity(accent, 0.13) : withOpacity("#FFFFFF", 0)}
      hover={{ backgroundColor: selected ? withOpacity(accent, 0.17) : withOpacity("#FFFFFF", 0.05) }}
      onHoverChange={setHover}
      onActiveChange={setDown}
      onClick={onPress}
    >
      {Array.from({ length: depth }, (_, i) => (
        <Container key={i} width={INDENT} height={ROW} alignItems="center">
          <Container width={1} height={ROW} backgroundColor={C.line} />
        </Container>
      ))}
      <Container ref={chev} {...rot} width={24} height={24} alignItems="center" justifyContent="center">
        {node.children ? <ChevronRight width={14} height={14} color={C.muted} /> : null}
      </Container>
      <Icon width={16} height={16} color={selected ? accent : C.muted} marginRight={10} />
      <Text flexGrow={1} fontSize={13} fontWeight={selected ? "semi-bold" : "medium"} color={selected || node.children ? C.text : C.muted}>
        {node.label}
      </Text>
      {node.children ? (
        <Text fontSize={11} color={C.faint}>
          {String(node.children.length)}
        </Text>
      ) : null}
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
