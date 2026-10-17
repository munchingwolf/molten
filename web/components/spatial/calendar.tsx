"use client"

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Text, withOpacity, type ContainerProperties, type VanillaContainer } from "@react-three/uikit"
import { ChevronLeft, ChevronRight } from "@react-three/uikit-lucide"

const C = { panel: "#15171E", border: "#323745", line: "#242833", row: "#1B1E27", hover: "#262A35", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2", onAccent: "#06221B" }
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const LONG_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const CELL = 40
const GAP = 4

type CalEvent = { date: string; title: string; time?: string }
type Props = {
  /** selected day, "YYYY-MM-DD" */
  value?: string
  onChange?: (date: string) => void
  /** month shown first, "YYYY-MM" (defaults to the selected or current month) */
  month?: string
  events?: CalEvent[]
  /** 0 = Sunday, 1 = Monday */
  weekStartsOn?: number
  accent?: string
}

const pad = (n: number) => String(n).padStart(2, "0")
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
function parse(s: string | undefined): Date | null {
  const m = s?.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/)
  return m ? new Date(+m[1], +m[2] - 1, m[3] ? +m[3] : 1) : null
}

function sampleEvents(): CalEvent[] {
  const t = new Date()
  const at = (day: number) => iso(new Date(t.getFullYear(), t.getMonth(), day))
  return [
    { date: iso(t), title: "Demo day", time: "6:30 PM" },
    { date: iso(t), title: "Studio walkthrough", time: "3:00 PM" },
    { date: at(3), title: "Design review", time: "10:00 AM" },
    { date: at(9), title: "Sprint planning", time: "9:30 AM" },
    { date: at(22), title: "Quest playtest", time: "2:00 PM" },
    { date: at(27), title: "Launch prep", time: "11:00 AM" },
  ]
}

/** Month calendar: tap a day to select it, chevrons to change month, event dots and the selected day's agenda below. */
export default function Calendar({ value, onChange, month, events, weekStartsOn = 1, accent = C.accent }: Props) {
  const today = iso(new Date())
  const [inner, setInner] = useState(today)
  const selected = value ?? inner
  const start = parse(month) ?? parse(selected) ?? new Date()
  const [view, setView] = useState({ y: start.getFullYear(), m: start.getMonth(), dir: 0 })
  const [list] = useState(() => events ?? sampleEvents())
  const evts = events ?? list
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })

  const ws = ((Math.round(weekStartsOn) % 7) + 7) % 7
  const offset = (new Date(view.y, view.m, 1).getDay() - ws + 7) % 7
  const cells = Array.from({ length: 42 }, (_, i) => new Date(view.y, view.m, 1 - offset + i))
  const shift = (d: number) => setView((v) => ({ y: v.m + d < 0 ? v.y - 1 : v.m + d > 11 ? v.y + 1 : v.y, m: (v.m + d + 12) % 12, dir: d }))
  const pick = (d: Date) => {
    const s = iso(d)
    if (value === undefined) setInner(s)
    onChange?.(s)
    if (d.getMonth() !== view.m) setView({ y: d.getFullYear(), m: d.getMonth(), dir: d < cells[offset] ? -1 : 1 })
  }
  const jumpToday = () => {
    const t = new Date()
    setView({ y: t.getFullYear(), m: t.getMonth(), dir: 0 })
    if (value === undefined) setInner(today)
    onChange?.(today)
  }

  const sel = parse(selected)
  const agenda = evts.filter((e) => e.date === selected)

  return (
    <Container
      ref={panel}
      {...enter}
      pixelSize={0.002}
      width={CELL * 7 + GAP * 6 + 36}
      flexDirection="column"
      padding={18}
      gap={12}
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={20}
      overflow="hidden"
    >
      <Container flexDirection="row" alignItems="center" gap={6}>
        <Text flexGrow={1} fontSize={17} fontWeight="semi-bold" color={C.text}>
          {`${MONTHS[view.m]} ${view.y}`}
        </Text>
        <Press height={36} paddingX={12} borderRadius={10} alignItems="center" justifyContent="center" backgroundColor={C.row} hover={{ backgroundColor: C.hover }} onClick={jumpToday}>
          <Text fontSize={12} fontWeight="semi-bold" color={C.text}>
            Today
          </Text>
        </Press>
        <Press width={36} height={36} borderRadius={10} alignItems="center" justifyContent="center" backgroundColor={C.row} hover={{ backgroundColor: C.hover }} onClick={() => shift(-1)}>
          <ChevronLeft width={18} height={18} color={C.text} />
        </Press>
        <Press width={36} height={36} borderRadius={10} alignItems="center" justifyContent="center" backgroundColor={C.row} hover={{ backgroundColor: C.hover }} onClick={() => shift(1)}>
          <ChevronRight width={18} height={18} color={C.text} />
        </Press>
      </Container>

      <Container flexDirection="row" gap={GAP}>
        {Array.from({ length: 7 }, (_, i) => (
          <Text key={i} width={CELL} textAlign="center" fontSize={11} fontWeight="semi-bold" color={C.faint}>
            {DAYS[(i + ws) % 7]}
          </Text>
        ))}
      </Container>

      <Grid key={`${view.y}-${view.m}`} from={view.dir * 28}>
        {cells.map((d) => {
          const s = iso(d)
          const isSel = s === selected
          const inMonth = d.getMonth() === view.m
          const has = evts.some((e) => e.date === s)
          return (
            <Press
              key={s}
              width={CELL}
              height={CELL}
              borderRadius={12}
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              backgroundColor={isSel ? accent : withOpacity("#FFFFFF", 0)}
              hover={{ backgroundColor: isSel ? accent : C.hover }}
              borderWidth={s === today && !isSel ? 1.5 : 0}
              borderColor={withOpacity(accent, 0.7)}
              onClick={() => pick(d)}
            >
              <Text fontSize={14} fontWeight={isSel || s === today ? "semi-bold" : "medium"} color={isSel ? C.onAccent : inMonth ? C.text : C.faint}>
                {String(d.getDate())}
              </Text>
              <Container width={4} height={4} marginTop={2} borderRadius={2} backgroundColor={has ? (isSel ? C.onAccent : accent) : withOpacity("#FFFFFF", 0)} />
            </Press>
          )
        })}
      </Grid>

      <Container height={1} backgroundColor={C.line} />
      <Container flexDirection="column" gap={6} minHeight={64}>
        <Text fontSize={13} fontWeight="semi-bold" color={C.text}>
          {sel ? `${LONG_DAYS[sel.getDay()]}, ${MONTHS[sel.getMonth()].slice(0, 3)} ${sel.getDate()}` : "No day selected"}
        </Text>
        {agenda.length === 0 ? (
          <Text fontSize={12} color={C.faint}>
            Nothing scheduled
          </Text>
        ) : (
          agenda.slice(0, 3).map((e, i) => (
            <Container key={i} flexDirection="row" alignItems="center" gap={10}>
              <Container width={3} height={18} borderRadius={2} backgroundColor={accent} />
              <Text flexGrow={1} fontSize={13} color={C.text}>
                {e.title}
              </Text>
              {e.time ? (
                <Text fontSize={12} color={C.muted}>
                  {e.time}
                </Text>
              ) : null}
            </Container>
          ))
        )}
      </Container>
    </Container>
  )
}

/** The day grid; remounts per month so it slides in from the direction you paged. */
function Grid({ from, children }: { from: number; children: React.ReactNode }) {
  const [ref, s] = useSpring({ transformTranslateX: 0 }, { transformTranslateX: from })
  return (
    <Container ref={ref} {...s} flexDirection="row" flexWrap="wrap" gap={GAP}>
      {children}
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
