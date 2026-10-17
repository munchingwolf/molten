"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Container, Text, withOpacity } from "@react-three/uikit"
import { BellRing, CircleCheck, Info, TriangleAlert, X } from "@react-three/uikit-lucide"

const PX = 0.002 // metres per uikit pixel

type Props = {
  message?: string
  description?: string
  variant?: "success" | "info" | "warning"
  /** Seconds before it dismisses itself. Pointing at it pauses the countdown. */
  duration?: number
  accent?: string
  /** Width in metres. */
  width?: number
  /** Controlled visibility. Omit and it shows on mount (and whenever `message` changes), then leaves a "Show toast" chip. */
  open?: boolean
  onClose?: () => void
}

const ICONS = { success: CircleCheck, info: Info, warning: TriangleAlert }

/** Toast that pops up from below, counts down along its bottom edge and dismisses itself. */
export default function Toast({
  message = "Scene saved",
  description = "Synced to your headset",
  variant = "success",
  duration = 4,
  accent = "#9FE7D2",
  width = 0.44,
  open,
  onClose,
}: Props) {
  const [inner, setInner] = useState(true)
  const [left, setLeft] = useState(1) // countdown fraction, quantised so it re-renders ~60 times per toast
  const hovered = useRef(false)
  const elapsed = useRef(0)
  const fired = useRef(false)
  const shown = open ?? inner
  const p = useSpring(shown ? 1 : 0, 0)
  const main = variant === "warning" ? "#F2B48A" : accent
  const tint = useMemo(() => withOpacity(main, 0.16), [main])
  const closeTint = useMemo(() => withOpacity("#EEF0F4", 0.08), [])
  const Icon = ICONS[variant] ?? CircleCheck

  // A new message (or reopening) restarts the countdown.
  useEffect(() => {
    elapsed.current = 0
    fired.current = false
    setLeft(1)
    if (open === undefined) setInner(true)
  }, [message, open])

  const dismiss = () => {
    if (fired.current) return
    fired.current = true
    hovered.current = false // no pointerout arrives once it unmounts
    if (open === undefined) setInner(false)
    onClose?.()
  }

  useFrame((state, dt) => {
    if (!shown || fired.current) return
    if (!hovered.current) elapsed.current += Math.min(dt, 0.1)
    const f = Math.max(0, 1 - elapsed.current / Math.max(0.5, duration))
    const q = Math.ceil(f * 60) / 60
    if (q !== left) setLeft(q)
    if (f <= 0) dismiss()
    state.invalidate()
  })

  return (
    <group>
      {p > 0.01 && (
        <group scale={0.85 + 0.15 * p} position={[0, (1 - p) * -0.05, 0]}>
          <Container
            pixelSize={PX}
            width={width / PX}
            opacity={Math.min(1, Math.max(0, p))}
            flexDirection="row"
            alignItems="center"
            gap={12}
            paddingY={12}
            paddingLeft={12}
            paddingRight={8}
            borderRadius={16}
            backgroundColor="#15171E"
            borderWidth={1.5}
            borderColor="#323745"
            borderBend={0.4}
            overflow="hidden"
            onPointerOver={() => (hovered.current = true)}
            onPointerOut={() => (hovered.current = false)}
          >
            <Container width={34} height={34} flexShrink={0} borderRadius={11} backgroundColor={tint} alignItems="center" justifyContent="center" color={main}>
              <Icon width={18} height={18} />
            </Container>
            <Container flexDirection="column" flexGrow={1} flexShrink={1} gap={2}>
              <Text fontSize={14} fontWeight="semi-bold" color="#EEF0F4">
                {message}
              </Text>
              {description ? (
                <Text fontSize={12} color="#9AA0AD">
                  {description}
                </Text>
              ) : null}
            </Container>
            <Container
              width={30}
              height={30}
              flexShrink={0}
              borderRadius={9}
              alignItems="center"
              justifyContent="center"
              color="#9AA0AD"
              hover={{ backgroundColor: closeTint, color: "#EEF0F4" }}
              active={{ transformScaleX: 0.9, transformScaleY: 0.9 }}
              onClick={dismiss}
            >
              <X width={15} height={15} />
            </Container>
            <Container positionType="absolute" positionBottom={0} positionLeft={0} height={3} width={`${left * 100}%`} backgroundColor={main} />
          </Container>
        </group>
      )}
      {!shown && open === undefined && p < 0.3 && (
        <Container
          pixelSize={PX}
          flexDirection="row"
          alignItems="center"
          gap={8}
          height={36}
          paddingX={14}
          borderRadius={12}
          backgroundColor="#15171E"
          borderWidth={1.5}
          borderColor="#323745"
          color="#9AA0AD"
          hover={{ borderColor: main, color: "#EEF0F4" }}
          onClick={() => {
            elapsed.current = 0
            fired.current = false
            setLeft(1)
            setInner(true)
          }}
        >
          <BellRing width={16} height={16} />
          <Text fontSize={13}>Show toast</Text>
        </Container>
      )}
    </group>
  )
}

/** Damped spring toward `target` (slight overshoot); re-renders only while it moves. */
function useSpring(target: number, from = target) {
  const s = useRef({ x: from, v: 0 })
  const [, tick] = useState(0)
  const invalidate = useThree((st) => st.invalidate)
  useEffect(() => invalidate(), [target, invalidate])
  useFrame((state, dt) => {
    const k = s.current
    if (k.x === target && k.v === 0) return
    const d = Math.min(dt, 1 / 30)
    k.v += ((target - k.x) * 170 - k.v * 18) * d
    k.x += k.v * d
    if (Math.abs(target - k.x) < 1e-3 && Math.abs(k.v) < 1e-2) {
      k.x = target
      k.v = 0
    }
    tick((t) => t + 1)
    state.invalidate()
  })
  return s.current.x
}
