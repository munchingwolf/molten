"use client"

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Text, withOpacity, type VanillaContainer } from "@react-three/uikit"
import { Circle, ClipboardPaste, Copy, CopyPlus, PencilLine, Scissors, Share, Trash2 } from "@react-three/uikit-lucide"

const C = { panel: "#15171E", border: "#323745", line: "#242833", hover: "#262A35", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2", danger: "#F0A6B8" }
const ICONS = { cut: Scissors, copy: Copy, paste: ClipboardPaste, duplicate: CopyPlus, rename: PencilLine, share: Share, delete: Trash2 }

type Item = { id: string; label: string; icon?: keyof typeof ICONS; shortcut?: string; danger?: boolean; disabled?: boolean }
type Props = {
  /** menu rows; "-" draws a divider */
  items?: (Item | "-")[]
  title?: string
  onSelect?: (item: Item) => void
  accent?: string
}

const SAMPLE: (Item | "-")[] = [
  { id: "cut", label: "Cut", icon: "cut", shortcut: "Ctrl X" },
  { id: "copy", label: "Copy", icon: "copy", shortcut: "Ctrl C" },
  { id: "paste", label: "Paste", icon: "paste", shortcut: "Ctrl V", disabled: true },
  "-",
  { id: "duplicate", label: "Duplicate", icon: "duplicate", shortcut: "Ctrl D" },
  { id: "rename", label: "Rename", icon: "rename", shortcut: "F2" },
  { id: "share", label: "Share", icon: "share" },
  "-",
  { id: "delete", label: "Delete", icon: "delete", shortcut: "Del", danger: true },
]

/** Context menu: icon rows with shortcuts, dividers, disabled and destructive items. Pops open from its top-left corner. */
export default function ContextMenu({ items = SAMPLE, title = "Drum pads", onSelect, accent = C.accent }: Props) {
  const [last, setLast] = useState<string | null>(null)
  const [panel, enter] = useSpring(
    { transformScaleX: 1, transformScaleY: 1, transformTranslateZ: 0 },
    { transformScaleX: 0.85, transformScaleY: 0.85, transformTranslateZ: -10 },
  )

  return (
    <Container
      ref={panel}
      {...enter}
      transformOriginX="left"
      transformOriginY="top"
      pixelSize={0.002}
      width={240}
      flexDirection="column"
      padding={6}
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={16}
    >
      {title ? (
        <Text fontSize={11} fontWeight="semi-bold" letterSpacing={0.5} color={C.faint} paddingX={12} paddingTop={6} paddingBottom={4}>
          {title.toUpperCase()}
        </Text>
      ) : null}
      {items.map((item, i) =>
        item === "-" ? (
          <Container key={`div-${i}`} height={1} marginY={5} marginX={8} backgroundColor={C.line} />
        ) : (
          <Row
            key={item.id}
            item={item}
            flash={last === item.id}
            accent={accent}
            onPress={() => {
              setLast(item.id)
              onSelect?.(item)
            }}
          />
        ),
      )}
    </Container>
  )
}

function Row({ item, flash, accent, onPress }: { item: Item; flash: boolean; accent: string; onPress: () => void }) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const off = !!item.disabled
  const k = down && !off ? 0.97 : 1
  const [ref, s] = useSpring({ transformTranslateX: hover && !off ? 2 : 0, transformScaleX: k, transformScaleY: k })
  const Icon = (item.icon && ICONS[item.icon]) || Circle
  const tone = off ? C.faint : item.danger ? C.danger : C.text
  return (
    <Container
      ref={ref}
      {...s}
      height={44}
      flexDirection="row"
      alignItems="center"
      gap={12}
      paddingX={12}
      borderRadius={10}
      cursor={off ? undefined : "pointer"}
      opacity={off ? 0.55 : 1}
      backgroundColor={flash ? withOpacity(accent, 0.12) : withOpacity("#FFFFFF", 0)}
      hover={{ backgroundColor: off ? undefined : item.danger ? withOpacity(C.danger, 0.14) : C.hover }}
      onHoverChange={setHover}
      onActiveChange={setDown}
      onClick={() => !off && onPress()}
    >
      <Icon width={16} height={16} color={off ? C.faint : item.danger ? C.danger : C.muted} />
      <Text flexGrow={1} fontSize={14} fontWeight="medium" color={tone}>
        {item.label}
      </Text>
      {item.shortcut ? (
        <Text fontSize={11} color={C.faint}>
          {item.shortcut}
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
