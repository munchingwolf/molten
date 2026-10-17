"use client"

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Input, Text, withOpacity, type ContainerProperties, type VanillaContainer } from "@react-three/uikit"
import { Clock, Mic, Search, X } from "@react-three/uikit-lucide"

const C = { panel: "#15171E", deep: "#101218", border: "#323745", row: "#1B1E27", hover: "#262A35", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2", onAccent: "#06221B" }

type Props = {
  value?: string
  onChange?: (query: string) => void
  /** fired when a recent search chip is tapped */
  onSubmit?: (query: string) => void
  /** fired by the mic button with the new listening state */
  onMic?: (listening: boolean) => void
  placeholder?: string
  recent?: string[]
  accent?: string
}

/** Search field with clear and voice buttons, a focus ring, and one-tap recent searches (typing is slow in a headset). */
export default function SearchBar({
  value,
  onChange,
  onSubmit,
  onMic,
  placeholder = "Search components, files, people",
  recent = ["drum pads", "dashboard", "glass panels"],
  accent = C.accent,
}: Props) {
  const [inner, setInner] = useState("")
  const [focus, setFocus] = useState(false)
  const [listening, setListening] = useState(false)
  const query = value ?? inner
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })

  const set = (q: string) => {
    if (value === undefined) setInner(q)
    onChange?.(q)
  }

  return (
    <Container ref={panel} {...enter} pixelSize={0.002} width={360} flexDirection="column" gap={10}>
      <Container
        height={56}
        flexDirection="row"
        alignItems="center"
        gap={10}
        paddingLeft={18}
        paddingRight={6}
        backgroundColor={C.panel}
        borderWidth={1.5}
        borderColor={focus || listening ? accent : C.border}
        borderRadius={16}
      >
        <Search width={18} height={18} color={focus ? accent : C.muted} />
        <Input
          flexGrow={1}
          fontSize={15}
          color={C.text}
          value={query}
          placeholder={listening ? "Listening..." : placeholder}
          placeholderStyle={{ color: listening ? accent : C.faint }}
          onValueChange={set}
          onFocusChange={setFocus}
        />
        {query ? (
          <Press width={32} height={32} borderRadius={9} alignItems="center" justifyContent="center" backgroundColor={C.row} hover={{ backgroundColor: C.hover }} onClick={() => set("")}>
            <X width={15} height={15} color={C.muted} />
          </Press>
        ) : null}
        <MicButton
          listening={listening}
          accent={accent}
          onPress={() => {
            setListening(!listening)
            onMic?.(!listening)
          }}
        />
      </Container>

      {recent.length ? (
        <Container flexDirection="row" alignItems="center" gap={6} paddingX={6} flexWrap="wrap">
          <Text fontSize={11} fontWeight="semi-bold" color={C.faint} marginRight={4}>
            RECENT
          </Text>
          {recent.map((r) => (
            <Press
              key={r}
              height={32}
              paddingX={10}
              gap={6}
              flexDirection="row"
              alignItems="center"
              borderRadius={8}
              backgroundColor={query === r ? withOpacity(accent, 0.14) : C.panel}
              borderWidth={1}
              borderColor={query === r ? withOpacity(accent, 0.5) : C.border}
              hover={{ backgroundColor: C.hover }}
              onClick={() => {
                set(r)
                onSubmit?.(r)
              }}
            >
              <Clock width={12} height={12} color={C.faint} />
              <Text fontSize={12} fontWeight="medium" color={C.text}>
                {r}
              </Text>
            </Press>
          ))}
        </Container>
      ) : null}
    </Container>
  )
}

function MicButton({ listening, accent, onPress }: { listening: boolean; accent: string; onPress: () => void }) {
  const ring = useRef<VanillaContainer>(null)
  // breathing ring while listening
  useFrame(({ clock }) => {
    if (!listening || !ring.current) return
    const p = (clock.elapsedTime * 1.4) % 1
    ring.current.setProperties({ transformScaleX: 1 + p * 0.5, transformScaleY: 1 + p * 0.5, opacity: 1 - p })
  })
  return (
    <Container width={44} height={44} alignItems="center" justifyContent="center">
      {listening ? <Container ref={ring} positionType="absolute" width={44} height={44} borderRadius={12} borderWidth={2} borderColor={accent} /> : null}
      <Press width={44} height={44} borderRadius={12} alignItems="center" justifyContent="center" backgroundColor={listening ? accent : C.row} hover={{ backgroundColor: listening ? accent : C.hover }} onClick={onPress}>
        <Mic width={18} height={18} color={listening ? C.onAccent : C.text} />
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
