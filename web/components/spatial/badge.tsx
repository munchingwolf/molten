"use client"

import { useEffect, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import type { Group } from "three"
import { Container, Text } from "@react-three/uikit"
import { Bell, Mail, MessageSquare, ShoppingCart } from "@react-three/uikit-lucide"

const PX = 0.002 // metres per uikit pixel
const TILE = 48 // px (9.6 cm)
const ICONS = { bell: Bell, mail: Mail, message: MessageSquare, cart: ShoppingCart }

type Props = {
  /** Number on the badge. 0 hides it (unless `dot`). */
  count?: number
  /** Above this it reads "99+". */
  max?: number
  /** Show a plain dot instead of a number. */
  dot?: boolean
  icon?: keyof typeof ICONS
  /** Badge colour. */
  color?: string
  onPress?: () => void
}

/** Notification badge floating 8 mm in front of an icon tile; pops whenever the count changes. */
export default function Badge({ count = 3, max = 99, dot = false, icon = "bell", color = "#F2B48A", onPress }: Props) {
  const n = Math.max(0, Math.round(Number.isFinite(count) ? count : 0))
  const visible = dot || n > 0
  const pop = useRef<Group>(null)
  const s = useRef({ x: 0, v: 0 })
  const invalidate = useThree((st) => st.invalidate)
  const Glyph = ICONS[icon] ?? Bell

  // Every new count squashes the badge, then the spring overshoots it back to size.
  useEffect(() => {
    if (visible) s.current.x = Math.min(s.current.x, 0.35)
    invalidate()
  }, [n, visible, invalidate])

  useFrame((state, dt) => {
    const k = s.current
    const target = visible ? 1 : 0
    if (k.x === target && k.v === 0) return
    const d = Math.min(dt, 1 / 30)
    k.v += ((target - k.x) * 320 - k.v * 14) * d
    k.x += k.v * d
    if (Math.abs(target - k.x) < 1e-3 && Math.abs(k.v) < 1e-2) {
      k.x = target
      k.v = 0
    }
    if (pop.current) {
      pop.current.scale.setScalar(Math.max(0.001, k.x))
      pop.current.visible = k.x > 0.01
    }
    state.invalidate()
  })

  return (
    <group>
      <Container
        pixelSize={PX}
        width={TILE}
        height={TILE}
        borderRadius={14}
        alignItems="center"
        justifyContent="center"
        backgroundColor="#15171E"
        borderWidth={1.5}
        borderColor="#323745"
        borderBend={0.4}
        color="#EEF0F4"
        hover={{ borderColor: color, transformTranslateZ: 3 }}
        active={{ transformScaleX: 0.92, transformScaleY: 0.92 }}
        onClick={() => onPress?.()}
      >
        <Glyph width={22} height={22} />
      </Container>
      <group ref={pop} position={[(TILE / 2 - 4) * PX, (TILE / 2 - 4) * PX, 0.008]} scale={0.001}>
        <Container
          pixelSize={PX}
          height={dot ? 14 : 22}
          minWidth={dot ? 14 : 22}
          paddingX={dot ? 0 : 6}
          borderRadius={dot ? 7 : 11}
          alignItems="center"
          justifyContent="center"
          backgroundColor={color}
          borderWidth={2}
          borderColor="#0B0C10"
          pointerEvents="none"
        >
          {!dot && (
            <Text fontSize={12} fontWeight="bold" color="#2A1406">
              {n > max ? `${max}+` : `${n}`}
            </Text>
          )}
        </Container>
      </group>
    </group>
  )
}
