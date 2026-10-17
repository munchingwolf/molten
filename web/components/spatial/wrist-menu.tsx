"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Container, Text, withOpacity } from "@react-three/uikit"
import { BatteryMedium, Camera, Folder, House, LocateFixed, LogOut, Mic, Music, Search, Settings, Volume2 } from "@react-three/uikit-lucide"

const PX = 0.002 // metres per uikit pixel

type Icon = typeof House
// Labels pick an icon by their first word; anything else shows its first letter.
const ICONS: Record<string, Icon> = {
  home: House, recenter: LocateFixed, center: LocateFixed, mute: Mic, mic: Mic, voice: Mic, settings: Settings, library: Folder, files: Folder,
  exit: LogOut, leave: LogOut, quit: LogOut, music: Music, volume: Volume2, sound: Volume2, camera: Camera, capture: Camera, search: Search,
}

type Props = {
  /** Row labels, as an array or a comma-separated string. */
  items?: string[] | string
  onSelect?: (item: string) => void
  accent?: string
  /** Width in metres. */
  width?: number
}

/** Compact vertical menu sized for the wrist: clock header, icon rows, springs up as if you raised your arm. */
export default function WristMenu({ items = ["Home", "Recenter", "Mute mic", "Settings", "Exit"], onSelect, accent = "#9FE7D2", width = 0.24 }: Props) {
  const list = (typeof items === "string" ? items.split(",") : items).map((s) => s.trim()).filter(Boolean)
  const [active, setActive] = useState(0)
  const time = useClock()
  const p = useSpring(1, 0)
  const tint = useMemo(() => withOpacity(accent, 0.14), [accent])
  const ghost = useMemo(() => withOpacity("#EEF0F4", 0.06), [])

  const select = (i: number) => {
    setActive(i)
    onSelect?.(list[i])
  }

  return (
    <group rotation={[(1 - p) * -0.7, 0, 0]} scale={0.7 + 0.3 * p}>
      <Container
        pixelSize={PX}
        width={width / PX}
        opacity={Math.min(1, Math.max(0, p))}
        flexDirection="column"
        gap={2}
        padding={8}
        borderRadius={16}
        backgroundColor="#15171E"
        borderWidth={1.5}
        borderColor="#323745"
        borderBend={0.4}
      >
        <Container flexDirection="row" alignItems="center" justifyContent="space-between" paddingX={8} paddingTop={4} paddingBottom={8} marginBottom={4} borderBottomWidth={1} borderColor="#242833">
          <Text fontSize={16} fontWeight="bold" color="#EEF0F4">
            {time}
          </Text>
          <BatteryMedium width={16} height={16} color="#9AA0AD" />
        </Container>
        {list.map((label, i) => {
          const Glyph = ICONS[label.split(" ")[0].toLowerCase()]
          const on = i === active
          return (
            <Container
              key={`${i}-${label}`}
              height={32}
              flexDirection="row"
              alignItems="center"
              gap={9}
              paddingX={8}
              borderRadius={9}
              backgroundColor={on ? tint : undefined}
              color={on ? accent : "#C9CDD6"}
              hover={{ backgroundColor: on ? tint : ghost, color: on ? accent : "#EEF0F4" }}
              active={{ transformScaleX: 0.97, transformScaleY: 0.97 }}
              onClick={() => select(i)}
            >
              {Glyph ? (
                <Glyph width={15} height={15} />
              ) : (
                <Text fontSize={12} fontWeight="bold">
                  {label.slice(0, 1).toUpperCase()}
                </Text>
              )}
              <Text fontSize={12} fontWeight={on ? "semi-bold" : "normal"}>
                {label}
              </Text>
            </Container>
          )
        })}
      </Container>
    </group>
  )
}

/** "9:41"-style local time, refreshed every 15 s. */
function useClock() {
  const fmt = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M$/i, "")
  const [t, setT] = useState(fmt)
  useEffect(() => {
    const id = setInterval(() => setT(fmt()), 15000)
    return () => clearInterval(id)
  }, [])
  return t
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
