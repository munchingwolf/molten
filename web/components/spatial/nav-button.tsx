"use client"

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import type { Group } from "three"
import { Container, Text } from "@react-three/uikit"
import { ArrowRight } from "@react-three/uikit-lucide"

type Props = {
  /** Scene to go to: its name, a number (1 = first), "next" or "back". */
  to?: string
  label?: string
  color?: string
  onPress?: (to: string) => void
}

/**
 * A link between scenes, like a site's nav button: press it and the experience moves to scene `to`.
 * It fires `window.dispatchEvent(new CustomEvent("spatial:go", { detail: { to } }))`; Spatial's Studio (Play mode) and
 * launched apps switch scenes on it. In your own app, listen for "spatial:go" or use onPress.
 */
export default function NavButton({ to = "next", label = "Enter", color = "#9FE7D2", onPress }: Props) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const g = useRef<Group>(null)
  const born = useRef(-1)

  useFrame((state, dt) => {
    const o = g.current
    if (!o) return
    if (born.current < 0) born.current = state.clock.elapsedTime
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 14)
    const target = down ? 0.95 : hover ? 1.05 : 1
    const s = o.scale.x + (target - o.scale.x) * k
    o.scale.setScalar(s)
    o.position.z += ((hover && !down ? 0.02 : 0) - o.position.z) * k
    if (Math.abs(target - s) > 1e-4) state.invalidate()
  })

  const go = () => {
    window.dispatchEvent(new CustomEvent("spatial:go", { detail: { to } }))
    onPress?.(to)
  }

  return (
    <group ref={g}>
      <Container
        pixelSize={0.002}
        flexDirection="row"
        alignItems="center"
        gap={12}
        paddingX={28}
        height={64}
        borderRadius={32}
        backgroundColor={hover ? color : "#15171E"}
        borderWidth={2}
        borderColor={color}
        cursor="pointer"
        onPointerOver={() => setHover(true)}
        onPointerOut={() => (setHover(false), setDown(false))}
        onPointerDown={() => setDown(true)}
        onPointerUp={() => setDown(false)}
        onClick={go}
      >
        <Text fontSize={24} fontWeight="semi-bold" color={hover ? "#0B0C10" : "#EEF0F4"}>{label}</Text>
        <ArrowRight width={24} height={24} color={hover ? "#0B0C10" : color} />
      </Container>
    </group>
  )
}
