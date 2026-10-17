"use client"

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Text, type ContainerProperties, type VanillaContainer } from "@react-three/uikit"
import { ChevronRight, House } from "@react-three/uikit-lucide"

const C = { panel: "#15171E", border: "#323745", hover: "#262A35", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2" }

type Props = {
  items?: string[]
  /** index of the current crumb (defaults to the last) */
  value?: number
  onChange?: (index: number) => void
  onSelect?: (item: string, index: number) => void
  accent?: string
}

/** Breadcrumb bar. Tap a crumb to go back to it; crumbs you left stay faint so you can step forward again. */
export default function Breadcrumbs({ items = ["Home", "Projects", "Spatial", "Studio"], value, onChange, onSelect, accent = C.accent }: Props) {
  const [inner, setInner] = useState(items.length - 1)
  const current = Math.min(items.length - 1, Math.max(0, value ?? inner))
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })

  const go = (i: number) => {
    if (value === undefined) setInner(i)
    onChange?.(i)
    onSelect?.(items[i], i)
  }

  return (
    <Container
      ref={panel}
      {...enter}
      pixelSize={0.002}
      flexDirection="row"
      alignItems="center"
      gap={2}
      padding={4}
      height={52}
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={14}
    >
      {items.map((label, i) => {
        const here = i === current
        const ahead = i > current
        return (
          <Container key={`${i}-${label}`} flexDirection="row" alignItems="center" gap={2}>
            {i > 0 ? <ChevronRight width={14} height={14} color={C.faint} opacity={ahead ? 0.5 : 1} /> : null}
            <Press
              height={44}
              paddingX={10}
              borderRadius={10}
              flexDirection="row"
              alignItems="center"
              gap={6}
              hover={{ backgroundColor: here ? undefined : C.hover }}
              opacity={ahead ? 0.45 : 1}
              onClick={() => !here && go(i)}
            >
              {i === 0 ? <House width={16} height={16} color={here ? accent : C.muted} /> : null}
              <Text fontSize={14} fontWeight={here ? "semi-bold" : "medium"} color={here ? C.text : C.muted}>
                {label}
              </Text>
            </Press>
          </Container>
        )
      })}
    </Container>
  )
}

/** Pressable Container: lifts toward you on hover, dips on press. */
function Press({ children, ...props }: ContainerProperties) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const k = down ? 0.94 : 1
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
