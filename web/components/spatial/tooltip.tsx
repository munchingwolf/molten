"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { Info } from "@react-three/uikit-lucide"

const PX = 0.002 // metres per uikit pixel

type Props = {
  text?: string
  /** 3D anchor the tooltip points at (any R3F nodes). Defaults to a small info button. */
  children?: ReactNode
  /** Height in metres above the origin where the bubble's arrow sits. */
  offset?: number
  /** Force it shown (true) or hidden (false). Omit: shows on hover, and a press pins it (hands have no hover). */
  open?: boolean
  /** Starts pinned open, so it reads at a glance before anyone points at it. */
  defaultOpen?: boolean
  accent?: string
}

/** Tooltip: a label bubble that springs up above its anchor on hover or press. */
export default function Tooltip({ text = "Pinch to grab, twist to rotate", children, offset = 0.05, open, defaultOpen = true, accent = "#9FE7D2" }: Props) {
  const [hover, setHover] = useState(false)
  const [pinned, setPinned] = useState(defaultOpen)
  const shown = open ?? (pinned || hover)
  const p = useSpring(shown ? 1 : 0, 0)

  return (
    <group>
      <group onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)} onClick={() => setPinned((v) => !v)}>
        {children ?? (
          <Container
            pixelSize={PX}
            width={36}
            height={36}
            borderRadius={18}
            alignItems="center"
            justifyContent="center"
            backgroundColor="#15171E"
            borderWidth={1.5}
            borderColor={shown ? accent : "#323745"}
            color={accent}
            hover={{ borderColor: accent, transformTranslateZ: 3 }}
            active={{ transformScaleX: 0.92, transformScaleY: 0.92 }}
          >
            <Info width={18} height={18} />
          </Container>
        )}
      </group>
      {p > 0.01 && (
        // Scales from the arrow tip, so the bubble grows out of the anchor.
        <group position={[0, offset + (1 - p) * -0.01, 0.004]} scale={0.75 + 0.25 * p}>
          <Container
            pixelSize={PX}
            anchorY="bottom"
            pointerEvents="none"
            opacity={Math.min(1, Math.max(0, p))}
            paddingBottom={6}
            flexDirection="column"
            alignItems="center"
          >
            <Container maxWidth={220} paddingX={12} paddingY={8} borderRadius={10} backgroundColor="#1B1E26" borderWidth={1.5} borderColor="#323745">
              <Text fontSize={13} color="#EEF0F4" textAlign="center" lineHeight="140%">
                {text}
              </Text>
            </Container>
            <Container positionType="absolute" positionBottom={1} width={10} height={10} backgroundColor="#1B1E26" transformRotateZ={45} />
          </Container>
        </group>
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
    if (Math.abs(target - k.x) < 1e-3 && Math.abs(k.v) < 1e-2) (k.x = target), (k.v = 0)
    tick((t) => t + 1)
    state.invalidate()
  })
  return s.current.x
}
