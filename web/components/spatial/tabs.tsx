"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Container, Text, withOpacity } from "@react-three/uikit"

const PX = 0.002 // metres per uikit pixel
const PAD = 4

type Props = {
  /** Selected tab index. Omit to let the tabs manage it. */
  value?: number
  onChange?: (index: number) => void
  /** Tab labels, as an array or a comma-separated string. */
  items?: string[] | string
  accent?: string
  /** Total width in metres. */
  width?: number
}

/** Segmented tabs: a mint pill springs to the tab you poke, pinch or click. */
export default function Tabs({ value, onChange, items = ["Overview", "Library", "Settings"], accent = "#9FE7D2", width = 0.42 }: Props) {
  const list = (typeof items === "string" ? items.split(",") : items).map((s) => s.trim()).filter(Boolean)
  const n = Math.max(1, list.length)
  const [inner, setInner] = useState(0)
  const active = Math.min(n - 1, Math.max(0, Math.round(value ?? inner)))
  const tabW = (width / PX - PAD * 2 - 3) / n // 3 = both borders
  const x = useSpring(active * tabW)
  const hoverTint = useMemo(() => withOpacity("#EEF0F4", 0.06), [])

  const select = (i: number) => {
    if (value === undefined) setInner(i)
    onChange?.(i)
  }

  return (
    <Container
      pixelSize={PX}
      width={width / PX}
      height={40}
      padding={PAD}
      flexDirection="row"
      borderRadius={14}
      backgroundColor="#15171E"
      borderWidth={1.5}
      borderColor="#323745"
      borderBend={0.3}
    >
      {/* Sliding indicator: one pill that springs between tabs instead of each tab lighting up on its own. */}
      <Container
        positionType="absolute"
        positionTop={PAD}
        positionLeft={PAD + x}
        width={tabW}
        height={40 - PAD * 2 - 3}
        borderRadius={10}
        backgroundColor={accent}
      />
      {list.map((label, i) => (
        <Container
          key={`${i}-${label}`}
          width={tabW}
          height="100%"
          alignItems="center"
          justifyContent="center"
          borderRadius={10}
          color={i === active ? "#06221B" : "#9AA0AD"}
          hover={i === active ? {} : { backgroundColor: hoverTint, color: "#EEF0F4" }}
          onClick={() => select(i)}
        >
          <Text fontSize={13} fontWeight="semi-bold">
            {label}
          </Text>
        </Container>
      ))}
    </Container>
  )
}

/** Damped spring toward `target` (slight overshoot); re-renders only while it moves. */
function useSpring(target: number) {
  const s = useRef({ x: target, v: 0 })
  const [, tick] = useState(0)
  const invalidate = useThree((st) => st.invalidate)
  useEffect(() => invalidate(), [target, invalidate])
  useFrame((state, dt) => {
    const k = s.current
    if (k.x === target && k.v === 0) return
    const d = Math.min(dt, 1 / 30)
    k.v += ((target - k.x) * 170 - k.v * 18) * d
    k.x += k.v * d
    if (Math.abs(target - k.x) < 0.05 && Math.abs(k.v) < 0.5) {
      k.x = target
      k.v = 0
    }
    tick((t) => t + 1)
    state.invalidate()
  })
  return s.current.x
}
