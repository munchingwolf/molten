"use client"

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Text, withOpacity, type ContainerProperties, type VanillaContainer } from "@react-three/uikit"
import { Cloud, CloudLightning, CloudRain, CloudSnow, CloudSun, Droplets, MapPin, Sun, Wind } from "@react-three/uikit-lucide"

const C = { panel: "#15171E", border: "#323745", row: "#1B1E27", hover: "#262A35", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2", warm: "#F2B48A", sky: "#8EC9F0" }
const SKY = {
  sunny: { icon: Sun, color: C.warm, label: "Sunny" },
  partly: { icon: CloudSun, color: C.warm, label: "Partly cloudy" },
  cloudy: { icon: Cloud, color: C.muted, label: "Cloudy" },
  rain: { icon: CloudRain, color: C.sky, label: "Light rain" },
  storm: { icon: CloudLightning, color: C.sky, label: "Thunderstorms" },
  snow: { icon: CloudSnow, color: "#DDE6F2", label: "Snow" },
}
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

type Sky = keyof typeof SKY
type Hour = { time: string; temp: number; condition?: Sky }
type Props = {
  location?: string
  /** current temperature in °C */
  temperature?: number
  condition?: Sky
  high?: number
  low?: number
  wind?: number
  humidity?: number
  uv?: number
  hourly?: Hour[]
  unit?: "C" | "F"
  onUnitChange?: (unit: "C" | "F") => void
  onSelect?: (hour: Hour) => void
  accent?: string
}

/** Weather card: big temperature, conditions, wind / humidity / UV, and an hourly strip you can tap through. */
export default function WeatherWidget({
  location = "Lisbon",
  temperature = 21,
  condition = "partly",
  high = 24,
  low = 16,
  wind = 12,
  humidity = 64,
  uv = 5,
  hourly = [
    { time: "15:00", temp: 22, condition: "sunny" },
    { time: "16:00", temp: 22, condition: "partly" },
    { time: "17:00", temp: 20, condition: "cloudy" },
    { time: "18:00", temp: 18, condition: "rain" },
  ],
  unit,
  onUnitChange,
  onSelect,
  accent = C.accent,
}: Props) {
  const [innerUnit, setUnit] = useState<"C" | "F">("C")
  const u = unit ?? innerUnit
  const [hour, setHour] = useState(-1) // -1 = now
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })
  const deg = (c: number) => `${Math.round(u === "F" ? (c * 9) / 5 + 32 : c)}°`
  const strip: Hour[] = [{ time: "Now", temp: temperature, condition }, ...hourly]
  const cur = strip[hour + 1] ?? strip[0]
  const sky = SKY[cur.condition ?? condition] ?? SKY.partly
  const Icon = sky.icon
  const today = new Date()

  const pickUnit = (n: "C" | "F") => {
    if (unit === undefined) setUnit(n)
    onUnitChange?.(n)
  }

  return (
    <Container
      ref={panel}
      {...enter}
      pixelSize={0.002}
      width={310}
      flexDirection="column"
      padding={20}
      gap={16}
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={22}
    >
      <Container flexDirection="row" alignItems="flex-start">
        <Container flexDirection="column" flexGrow={1} gap={2}>
          <Container flexDirection="row" alignItems="center" gap={5}>
            <MapPin width={14} height={14} color={C.text} />
            <Text fontSize={16} fontWeight="semi-bold" color={C.text}>
              {location}
            </Text>
          </Container>
          <Text fontSize={12} color={C.muted}>
            {`${DAYS[today.getDay()]}, ${MONTHS[today.getMonth()]} ${today.getDate()}`}
          </Text>
        </Container>
        <Container flexDirection="row" padding={3} gap={2} borderRadius={10} backgroundColor={C.row}>
          {(["C", "F"] as const).map((n) => (
            <Press
              key={n}
              width={34}
              height={30}
              borderRadius={8}
              alignItems="center"
              justifyContent="center"
              backgroundColor={u === n ? C.hover : withOpacity(C.hover, 0)}
              onClick={() => pickUnit(n)}
            >
              <Text fontSize={12} fontWeight="semi-bold" color={u === n ? C.text : C.faint}>
                {`°${n}`}
              </Text>
            </Press>
          ))}
        </Container>
      </Container>

      <Container flexDirection="row" alignItems="center" justifyContent="space-between">
        <Container flexDirection="column">
          <Text fontSize={64} fontWeight="light" color={C.text} lineHeight={68}>
            {deg(cur.temp)}
          </Text>
          <Text fontSize={14} fontWeight="medium" color={C.text}>
            {sky.label}
          </Text>
          <Text fontSize={12} color={C.muted}>
            {`H ${deg(high)}   L ${deg(low)}`}
          </Text>
        </Container>
        <Bob key={cur.time}>
          <Icon width={72} height={72} color={sky.color} />
        </Bob>
      </Container>

      <Container flexDirection="row" gap={8}>
        <Stat icon={Wind} value={`${wind} km/h`} label="Wind" />
        <Stat icon={Droplets} value={`${humidity}%`} label="Humidity" />
        <Stat icon={Sun} value={String(uv)} label="UV index" />
      </Container>

      <Container flexDirection="row" gap={4}>
        {strip.map((h, i) => {
          const s = SKY[h.condition ?? "partly"] ?? SKY.partly
          const HIcon = s.icon
          const on = i - 1 === hour
          return (
            <Press
              key={h.time}
              flexGrow={1}
              flexBasis={0}
              height={84}
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              gap={6}
              borderRadius={12}
              backgroundColor={on ? withOpacity(accent, 0.12) : withOpacity("#FFFFFF", 0)}
              borderWidth={1}
              borderColor={on ? withOpacity(accent, 0.45) : withOpacity("#FFFFFF", 0)}
              hover={{ backgroundColor: on ? withOpacity(accent, 0.16) : C.row }}
              onClick={() => {
                setHour(i - 1)
                onSelect?.(h)
              }}
            >
              <Text fontSize={11} fontWeight="medium" color={on ? C.text : C.muted}>
                {h.time}
              </Text>
              <HIcon width={20} height={20} color={s.color} />
              <Text fontSize={13} fontWeight="semi-bold" color={C.text}>
                {deg(h.temp)}
              </Text>
            </Press>
          )
        })}
      </Container>
    </Container>
  )
}

function Stat({ icon: Icon, value, label }: { icon: typeof Wind; value: string; label: string }) {
  return (
    <Container flexGrow={1} flexBasis={0} flexDirection="column" gap={4} padding={10} borderRadius={12} backgroundColor={C.row}>
      <Icon width={14} height={14} color={C.muted} />
      <Text fontSize={14} fontWeight="semi-bold" color={C.text}>
        {value}
      </Text>
      <Text fontSize={10} color={C.faint}>
        {label}
      </Text>
    </Container>
  )
}

/** Pops the condition icon in when the hour changes, then floats it gently. */
function Bob({ children }: { children: React.ReactNode }) {
  const [ref, s] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.6, transformScaleY: 0.6 })
  const bob = useRef<VanillaContainer>(null)
  const [still] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches)
  useFrame(({ clock }) => !still && bob.current?.setProperties({ transformTranslateY: Math.sin(clock.elapsedTime * 1.6) * 3 }))
  return (
    <Container ref={ref} {...s}>
      <Container ref={bob}>{children}</Container>
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
