"use client"

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Text, type ContainerProperties, type VanillaContainer } from "@react-three/uikit"
import { ChevronLeft, ChevronRight } from "@react-three/uikit-lucide"

const C = { panel: "#15171E", border: "#323745", row: "#1B1E27", hover: "#262A35", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2", onAccent: "#06221B" }
const BTN = 38

type Props = {
  /** current page, 1-based */
  value?: number
  onChange?: (page: number) => void
  total?: number
  accent?: string
}

/** Page list with first/last, the neighbours of the current page, and gaps: 1 ... 5 6 7 ... 12. */
function pages(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const lo = Math.max(2, Math.min(current - 1, total - 4))
  const hi = Math.min(total - 1, Math.max(current + 1, 5))
  const mid = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
  return [1, ...(lo > 2 ? ["gap" as const] : []), ...mid, ...(hi < total - 1 ? ["gap" as const] : []), total]
}

/** Pagination: prev / next chevrons, numbered pages with gaps, and a page caption. */
export default function Pagination({ value, onChange, total = 12, accent = C.accent }: Props) {
  const count = Math.max(1, Math.round(total) || 1)
  const [inner, setInner] = useState(1)
  const page = Math.min(count, Math.max(1, Math.round(value ?? inner)))
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })

  const go = (p: number) => {
    const n = Math.min(count, Math.max(1, p))
    if (n === page) return
    if (value === undefined) setInner(n)
    onChange?.(n)
  }

  return (
    <Container
      ref={panel}
      {...enter}
      pixelSize={0.002}
      flexDirection="column"
      alignItems="center"
      gap={8}
      padding={10}
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={16}
    >
      <Container flexDirection="row" alignItems="center" gap={4}>
        <Arrow disabled={page === 1} onPress={() => go(page - 1)}>
          <ChevronLeft width={18} height={18} color={page === 1 ? C.faint : C.text} />
        </Arrow>
        {pages(page, count).map((p, i) =>
          p === "gap" ? (
            <Container key={`gap-${i}`} width={22} height={BTN} alignItems="center" justifyContent="center">
              <Text fontSize={14} color={C.faint}>
                ...
              </Text>
            </Container>
          ) : (
            <PageButton key={`${p}-${p === page}`} page={p} active={p === page} accent={accent} onPress={() => go(p)} />
          ),
        )}
        <Arrow disabled={page === count} onPress={() => go(page + 1)}>
          <ChevronRight width={18} height={18} color={page === count ? C.faint : C.text} />
        </Arrow>
      </Container>
      <Text fontSize={11} color={C.faint}>
        {`Page ${page} of ${count}`}
      </Text>
    </Container>
  )
}

function PageButton({ page, active, accent, onPress }: { page: number; active: boolean; accent: string; onPress: () => void }) {
  // the active page pops when it becomes active
  const [ref, s] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, active ? { transformScaleX: 0.75, transformScaleY: 0.75 } : {})
  return (
    <Container ref={ref} {...s}>
      <Press
        width={BTN}
        height={BTN}
        borderRadius={10}
        alignItems="center"
        justifyContent="center"
        backgroundColor={active ? accent : C.row}
        hover={{ backgroundColor: active ? accent : C.hover }}
        onClick={onPress}
      >
        <Text fontSize={14} fontWeight={active ? "bold" : "medium"} color={active ? C.onAccent : C.text}>
          {String(page)}
        </Text>
      </Press>
    </Container>
  )
}

function Arrow({ disabled, onPress, children }: { disabled: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Press
      width={BTN}
      height={BTN}
      borderRadius={10}
      alignItems="center"
      justifyContent="center"
      borderWidth={1}
      borderColor={C.border}
      opacity={disabled ? 0.5 : 1}
      hover={{ backgroundColor: disabled ? undefined : C.hover }}
      onClick={() => !disabled && onPress()}
    >
      {children}
    </Press>
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
