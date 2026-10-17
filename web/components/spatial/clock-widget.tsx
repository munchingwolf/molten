"use client"

import { useEffect, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Text, withOpacity, type ContainerProperties, type VanillaContainer } from "@react-three/uikit"

const C = { panel: "#15171E", border: "#323745", row: "#1B1E27", hover: "#262A35", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2" }
const DIGIT = 40 // fixed cell per digit so the time never jitters as numbers change width

type Zone = { label: string; timeZone?: string }
type Props = {
  /** IANA zone like "Europe/Lisbon"; empty = this device */
  timeZone?: string
  label?: string
  /** 12-hour clock with AM/PM */
  value?: boolean
  onChange?: (hour12: boolean) => void
  showSeconds?: boolean
  /** world clocks under the main time; tap one to make it the main clock */
  zones?: Zone[]
  onSelect?: (zone: Zone) => void
  accent?: string
}

type Parts = { h: number; m: number; s: number; weekday: string; month: string; day: string }
function partsIn(date: Date, timeZone?: string): Parts {
  const read = (tz?: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "long", month: "long", day: "numeric" }).formatToParts(date)
  let p: Intl.DateTimeFormatPart[]
  try {
    p = read(timeZone || undefined)
  } catch {
    p = read() // unknown zone name: fall back to this device
  }
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? ""
  return { h: +get("hour") % 24, m: +get("minute"), s: +get("second"), weekday: get("weekday"), month: get("month"), day: get("day") }
}

const two = (n: number) => String(n).padStart(2, "0")
const hhmm = (p: Parts, h12: boolean) => `${h12 ? p.h % 12 || 12 : two(p.h)}:${two(p.m)}`

/** Digital clock: big steady digits, blinking colon, date, and tappable world clocks. Tap the time to switch 12/24 h. */
export default function ClockWidget({
  timeZone,
  label,
  value,
  onChange,
  showSeconds = true,
  zones = [
    { label: "London", timeZone: "Europe/London" },
    { label: "New York", timeZone: "America/New_York" },
    { label: "Tokyo", timeZone: "Asia/Tokyo" },
  ],
  onSelect,
  accent = C.accent,
}: Props) {
  const [now, setNow] = useState(() => new Date())
  const [inner, setInner] = useState(false)
  const [main, setMain] = useState<Zone>({ label: label ?? "Local time", timeZone })
  const h12 = value ?? inner
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })

  useEffect(() => setMain({ label: label ?? "Local time", timeZone }), [label, timeZone])
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const p = partsIn(now, main.timeZone)
  const time = hhmm(p, h12)
  const blink = p.s % 2 === 0

  return (
    <Container
      ref={panel}
      {...enter}
      pixelSize={0.002}
      width={320}
      flexDirection="column"
      padding={20}
      gap={16}
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={22}
    >
      <Container flexDirection="row" alignItems="center" gap={8}>
        <Container width={8} height={8} borderRadius={4} backgroundColor={accent} />
        <Text flexGrow={1} fontSize={13} fontWeight="semi-bold" color={C.text}>
          {main.label}
        </Text>
        <Text fontSize={12} color={C.faint}>
          {`${p.weekday}, ${p.month} ${p.day}`}
        </Text>
      </Container>

      <Press
        flexDirection="row"
        alignItems="flex-end"
        justifyContent="center"
        paddingY={6}
        borderRadius={16}
        hover={{ backgroundColor: withOpacity("#FFFFFF", 0.04) }}
        onClick={() => {
          if (value === undefined) setInner(!h12)
          onChange?.(!h12)
        }}
      >
        {time.split("").map((ch, i) =>
          ch === ":" ? (
            <Text key={i} width={22} textAlign="center" fontSize={68} fontWeight="light" lineHeight={76} color={blink ? C.text : withOpacity(C.text, 0.25)}>
              :
            </Text>
          ) : (
            <Text key={i} width={DIGIT} textAlign="center" fontSize={68} fontWeight="light" lineHeight={76} color={C.text}>
              {ch}
            </Text>
          ),
        )}
        <Container flexDirection="column" alignItems="flex-start" marginLeft={8} marginBottom={14} gap={2}>
          {h12 ? (
            <Text fontSize={13} fontWeight="semi-bold" color={accent}>
              {p.h < 12 ? "AM" : "PM"}
            </Text>
          ) : null}
          {showSeconds ? (
            <Text width={28} fontSize={20} fontWeight="medium" color={C.muted}>
              {two(p.s)}
            </Text>
          ) : null}
        </Container>
      </Press>

      {zones.length ? (
        <Container flexDirection="row" gap={8}>
          {zones.map((z) => {
            const zp = partsIn(now, z.timeZone)
            return (
              <Press
                key={z.label}
                flexGrow={1}
                flexBasis={0}
                minHeight={60}
                flexDirection="column"
                justifyContent="center"
                gap={4}
                paddingX={12}
                borderRadius={12}
                backgroundColor={C.row}
                hover={{ backgroundColor: C.hover }}
                onClick={() => {
                  setMain(z)
                  onSelect?.(z)
                }}
              >
                <Text fontSize={11} color={C.faint}>
                  {z.label}
                </Text>
                <Text fontSize={16} fontWeight="semi-bold" color={C.text}>
                  {`${hhmm(zp, h12)}${h12 ? (zp.h < 12 ? " am" : " pm") : ""}`}
                </Text>
              </Press>
            )
          })}
        </Container>
      ) : null}
    </Container>
  )
}

/** Pressable Container: lifts toward you on hover, dips on press. */
function Press({ children, ...props }: ContainerProperties) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const k = down ? 0.95 : 1
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
