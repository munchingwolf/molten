"use client"
// Built for Spatial; chime via Tone.js (MIT).

import { useEffect, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Text, withOpacity, type ContainerProperties, type VanillaContainer } from "@react-three/uikit"
import { Flag, Moon, Pause, Play, RotateCcw, Sun } from "@react-three/uikit-lucide"
import * as Tone from "tone"

const C = { panel: "#15171E", deep: "#101218", border: "#323745", line: "#242833", row: "#1B1E27", hover: "#262A35", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2", good: "#86E0A6", bad: "#F0A6B8", sun: "#F2C46B", moon: "#B9B4F5" }
const TABS = ["Clock", "World", "Timer", "Stopwatch"]
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const PRESETS = [1, 5, 10, 25]
const DONE = ["C6", "E6", "G6", "C7", "G6", "C7"]
const MIN = 60000

type City = { label: string; timeZone?: string }
type Props = {
  title?: string
  /** active tab: 0 Clock, 1 World, 2 Timer, 3 Stopwatch */
  value?: number
  onChange?: (tab: number) => void
  /** world clocks; leave timeZone empty for this device */
  cities?: City[]
  hour12?: boolean
  accent?: string
}

const CITIES: City[] = [
  { label: "Local time" },
  { label: "New York", timeZone: "America/New_York" },
  { label: "London", timeZone: "Europe/London" },
  { label: "Tokyo", timeZone: "Asia/Tokyo" },
  { label: "Sydney", timeZone: "Australia/Sydney" },
]

// --- time helpers -----------------------------------------------------------

type Parts = { y: number; mo: number; d: number; h: number; m: number; s: number; wd: string }
const FMT = new Map<string, Intl.DateTimeFormat>()
function fmt(tz?: string) {
  const key = tz ?? ""
  let f = FMT.get(key)
  if (!f) {
    const opts: Intl.DateTimeFormatOptions = { hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "long" }
    try {
      f = new Intl.DateTimeFormat("en-US", { ...opts, timeZone: tz || undefined })
    } catch {
      f = new Intl.DateTimeFormat("en-US", opts) // unknown zone name: fall back to this device
    }
    FMT.set(key, f)
  }
  return f
}
function partsIn(ms: number, tz?: string): Parts {
  const p = fmt(tz).formatToParts(ms)
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "0"
  return { y: +get("year"), mo: +get("month"), d: +get("day"), h: +get("hour") % 24, m: +get("minute"), s: +get("second"), wd: get("weekday") }
}
const utc = (p: Parts) => Date.UTC(p.y, p.mo - 1, p.d, p.h, p.m)
const two = (n: number) => String(n).padStart(2, "0")
const hhmm = (p: Parts, h12: boolean) => `${h12 ? p.h % 12 || 12 : two(p.h)}:${two(p.m)}`
const dateLine = (p: Parts) => `${p.wd}, ${MONTHS[p.mo - 1]} ${p.d}`
function offsetLabel(min: number) {
  if (!min) return "Same time"
  const a = Math.abs(min)
  return `${min > 0 ? "+" : "−"}${Math.floor(a / 60)}${a % 60 ? `:${two(a % 60)}` : ""}h`
}
/** mm:ss (or h:mm:ss) of a countdown, rounded up so it reads 0:00 only at the end */
function countdown(ms: number) {
  const t = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(t / 3600)
  return h ? `${h}:${two(Math.floor(t / 60) % 60)}:${two(t % 60)}` : `${two(Math.floor(t / 60))}:${two(t % 60)}`
}
/** mm:ss.cc of a stopwatch */
const split = (ms: number) => `${two(Math.min(99, Math.floor(ms / MIN)))}:${two(Math.floor(ms / 1000) % 60)}.${two(Math.floor(ms / 10) % 100)}`

/** Re-render whenever the wall clock crosses a `step` boundary (Date.now based, so it never drifts). */
function useTick(step: number, on = true) {
  const [now, setNow] = useState(() => Date.now())
  const last = useRef(Math.floor(now / step))
  useFrame(() => {
    if (!on) return
    const n = Date.now()
    const k = Math.floor(n / step)
    if (k !== last.current) {
      last.current = k
      setNow(n)
    }
  })
  return on ? Date.now() : now
}

// --- state kept by the hub so timers survive tab switches ------------------

type TimerState = { dur: number; rem: number; endAt: number; run: boolean; done: boolean }
type WatchState = { run: boolean; start: number; acc: number; laps: number[] }
const elapsed = (w: WatchState, now = Date.now()) => w.acc + (w.run ? now - w.start : 0)
const remaining = (t: TimerState, now = Date.now()) => (t.run ? Math.max(0, t.endAt - now) : t.rem)

/** A complete Clock app in one panel: live clock (digital or analog), world clocks, a countdown timer with a chime, and a lap stopwatch. */
export default function TimeHub({ title = "Clock", value, onChange, cities = CITIES, hour12 = false, accent = C.accent }: Props) {
  const [inner, setInner] = useState(0)
  const tab = Math.max(0, Math.min(3, Math.round(value ?? inner)))
  const setTab = (i: number) => {
    if (value === undefined) setInner(i)
    onChange?.(i)
  }
  const [main, setMain] = useState<City>(cities[0] ?? CITIES[0])
  const [h12, setH12] = useState(hour12)
  const [analog, setAnalog] = useState(false)
  const [timer, setTimer] = useState<TimerState>({ dur: 5 * MIN, rem: 5 * MIN, endAt: 0, run: false, done: false })
  const [watch, setWatch] = useState<WatchState>({ run: false, start: 0, acc: 0, laps: [] })
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })
  useEffect(() => setH12(hour12), [hour12])

  const synth = useRef<Tone.PolySynth | null>(null)
  useEffect(
    () => () => {
      synth.current?.dispose()
      synth.current = null
    },
    [],
  )
  const chime = (notes: string[], gap: number, len: number) => {
    if (Tone.getContext().state !== "running") return // never start audio without a gesture
    synth.current ??= new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sine" }, envelope: { attack: 0.005, decay: 0.4, sustain: 0.05, release: 0.6 }, volume: -12 }).toDestination()
    const t = Tone.now()
    notes.forEach((n, i) => synth.current?.triggerAttackRelease(n, len, t + i * gap))
  }

  // The timer finishes here, not in its tab, so it still rings while you look at another tab.
  const live = useRef(timer)
  live.current = timer
  useFrame(() => {
    const t = live.current
    if (t.run && Date.now() >= t.endAt) {
      live.current = { ...t, run: false, rem: 0, done: true }
      setTimer(live.current)
      chime(DONE, 0.14, 0.5)
    }
  })

  const timerApi = {
    toggle: () => {
      void Tone.start() // tap = user gesture, so the done chime is allowed to play later
      const now = Date.now()
      setTimer((t) => {
        if (t.run) return { ...t, run: false, rem: Math.max(0, t.endAt - now) }
        const rem = t.done || t.rem <= 0 ? t.dur : t.rem
        return { ...t, run: true, done: false, rem, endAt: now + rem }
      })
    },
    reset: () => setTimer((t) => ({ ...t, run: false, done: false, rem: t.dur })),
    preset: (min: number) => setTimer({ dur: min * MIN, rem: min * MIN, endAt: 0, run: false, done: false }),
    nudge: (d: number) =>
      setTimer((t) => {
        const now = Date.now()
        const rem = Math.max(1000, Math.min(180 * MIN, remaining(t, now) + d))
        const dur = Math.max(rem, Math.min(180 * MIN, Math.max(MIN, t.dur + d)))
        return { ...t, dur, rem, endAt: now + rem, done: false }
      }),
  }
  const watchApi = {
    toggle: () => {
      const now = Date.now()
      setWatch((w) => (w.run ? { ...w, run: false, acc: elapsed(w, now) } : { ...w, run: true, start: now }))
    },
    lapOrReset: () => {
      const now = Date.now()
      setWatch((w) => {
        if (!w.run) return { run: false, start: 0, acc: 0, laps: [] }
        const done = w.laps.reduce((a, b) => a + b, 0)
        return { ...w, laps: [...w.laps, elapsed(w, now) - done] }
      })
    },
  }

  const busy = [false, false, timer.run, watch.run]

  return (
    <Container
      ref={panel}
      {...enter}
      pixelSize={0.002}
      width={360}
      height={440}
      flexDirection="column"
      padding={14}
      gap={10}
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={22}
      overflow="hidden"
    >
      <Container flexDirection="row" alignItems="center" gap={8} paddingX={6} height={24}>
        <Text flexGrow={1} fontSize={16} fontWeight="semi-bold" color={C.text}>
          {title}
        </Text>
        <Container width={6} height={6} borderRadius={3} backgroundColor={accent} />
        <Text fontSize={12} color={C.muted}>
          {main.label}
        </Text>
      </Container>

      <Container flexDirection="row" height={36} padding={3} gap={3} borderRadius={12} backgroundColor={C.deep} borderWidth={1} borderColor={C.line}>
        {TABS.map((t, i) => (
          <Press
            key={t}
            flexGrow={1}
            flexBasis={0}
            height={28}
            borderRadius={9}
            flexDirection="row"
            alignItems="center"
            justifyContent="center"
            gap={5}
            lift={1}
            backgroundColor={i === tab ? C.hover : withOpacity("#FFFFFF", 0)}
            hover={{ backgroundColor: i === tab ? C.hover : withOpacity("#FFFFFF", 0.04) }}
            onClick={() => setTab(i)}
          >
            <Text fontSize={12} fontWeight="semi-bold" color={i === tab ? C.text : C.muted}>
              {t}
            </Text>
            {busy[i] ? <Container width={5} height={5} borderRadius={3} backgroundColor={accent} /> : null}
          </Press>
        ))}
      </Container>

      <Container flexGrow={1} flexDirection="column">
        {tab === 0 ? <ClockTab zone={main} h12={h12} onToggle12={() => setH12(!h12)} analog={analog} setAnalog={setAnalog} accent={accent} /> : null}
        {tab === 1 ? (
          <WorldTab
            cities={cities}
            main={main}
            h12={h12}
            accent={accent}
            onPick={(c) => {
              setMain(c)
              setTab(0)
            }}
          />
        ) : null}
        {tab === 2 ? <TimerTab t={timer} api={timerApi} accent={accent} h12={h12} /> : null}
        {tab === 3 ? <WatchTab w={watch} api={watchApi} accent={accent} /> : null}
      </Container>
    </Container>
  )
}

// --- Clock ------------------------------------------------------------------

function ClockTab({ zone, h12, onToggle12, analog, setAnalog, accent }: { zone: City; h12: boolean; onToggle12: () => void; analog: boolean; setAnalog: (a: boolean) => void; accent: string }) {
  const now = useTick(1000)
  const p = partsIn(now, zone.timeZone)
  const off = Math.round((utc(p) - utc(partsIn(now))) / MIN)
  return (
    <Container flexGrow={1} flexDirection="column" gap={8}>
      <Container flexDirection="row" alignItems="center" justifyContent="space-between" paddingX={4}>
        <Text fontSize={12} color={C.faint}>
          {zone.timeZone ? `${zone.label} · ${offsetLabel(off)}` : "This device"}
        </Text>
        <Container flexDirection="row" padding={2} gap={2} borderRadius={9} backgroundColor={C.deep} borderWidth={1} borderColor={C.line}>
          {["Digital", "Analog"].map((m, i) => {
            const on = analog === (i === 1)
            return (
              <Press key={m} height={24} paddingX={10} borderRadius={7} alignItems="center" justifyContent="center" lift={1} backgroundColor={on ? C.hover : withOpacity("#FFFFFF", 0)} onClick={() => setAnalog(i === 1)}>
                <Text fontSize={11} fontWeight="semi-bold" color={on ? C.text : C.muted}>
                  {m}
                </Text>
              </Press>
            )
          })}
        </Container>
      </Container>

      {analog ? (
        <Container flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center" gap={12}>
          <Dial size={208} zone={zone.timeZone} accent={accent} />
          <Container flexDirection="row" alignItems="center" gap={8}>
            <Digits text={`${hhmm(p, h12)}:${two(p.s)}`} size={18} color={C.text} weight="medium" />
            {h12 ? <Text fontSize={12} fontWeight="semi-bold" color={accent}>{p.h < 12 ? "AM" : "PM"}</Text> : null}
          </Container>
          <Text fontSize={13} color={C.muted}>
            {dateLine(p)}
          </Text>
        </Container>
      ) : (
        <Container flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center" gap={10}>
          <Press flexDirection="row" alignItems="flex-end" paddingX={12} paddingY={4} borderRadius={16} lift={2} hover={{ backgroundColor: withOpacity("#FFFFFF", 0.04) }} onClick={onToggle12}>
            <Digits text={hhmm(p, h12)} size={78} color={C.text} weight="light" blinkColon={p.s % 2 === 1} />
            <Container flexDirection="column" alignItems="flex-start" marginLeft={6} marginBottom={16} gap={2}>
              {h12 ? (
                <Text fontSize={13} fontWeight="semi-bold" color={accent}>
                  {p.h < 12 ? "AM" : "PM"}
                </Text>
              ) : null}
              <Digits text={two(p.s)} size={24} color={C.muted} weight="medium" />
            </Container>
          </Press>
          <Text fontSize={15} fontWeight="medium" color={C.text}>
            {dateLine(p)}
          </Text>
          <Container height={4} />
          <Container flexDirection="row" gap={8}>
            {[
              [`Week ${isoWeek(p)}`, "of the year"],
              [`Day ${dayOfYear(p)}`, `${daysInYear(p.y) - dayOfYear(p)} left`],
              [h12 ? "12-hour" : "24-hour", "tap time"],
            ].map(([a, b]) => (
              <Container key={a} flexDirection="column" alignItems="center" gap={2} paddingX={12} paddingY={8} borderRadius={10} backgroundColor={C.row} minWidth={90}>
                <Text fontSize={13} fontWeight="semi-bold" color={C.text}>
                  {a}
                </Text>
                <Text fontSize={10} color={C.faint}>
                  {b}
                </Text>
              </Container>
            ))}
          </Container>
        </Container>
      )}
    </Container>
  )
}
const dayOfYear = (p: Parts) => Math.round((Date.UTC(p.y, p.mo - 1, p.d) - Date.UTC(p.y, 0, 1)) / 864e5) + 1
const daysInYear = (y: number) => ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365)
function isoWeek(p: Parts) {
  const d = new Date(Date.UTC(p.y, p.mo - 1, p.d))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  return Math.ceil(((+d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7)
}

/** Analog dial; the hands are set every frame (sweeping second hand) without re-rendering React. */
function Dial({ size, zone, accent }: { size: number; zone?: string; accent: string }) {
  const R = size / 2
  const hh = useRef<VanillaContainer>(null)
  const mm = useRef<VanillaContainer>(null)
  const ss = useRef<VanillaContainer>(null)
  const angles = () => {
    const now = Date.now()
    const p = partsIn(now, zone)
    const sec = p.s + (now % 1000) / 1000
    const min = p.m + sec / 60
    return { h: -((p.h % 12) + min / 60) * 30, m: -min * 6, s: -sec * 6 }
  }
  const a = angles()
  useFrame(() => {
    const n = angles()
    hh.current?.setProperties({ transformRotateZ: n.h })
    mm.current?.setProperties({ transformRotateZ: n.m })
    ss.current?.setProperties({ transformRotateZ: n.s })
  })
  const hand = (ref: React.RefObject<VanillaContainer | null>, w: number, len: number, color: string, deg: number) => (
    <Container ref={ref} positionType="absolute" positionLeft={R - w / 2} positionTop={R - len} width={w} height={len} borderRadius={w / 2} backgroundColor={color} transformOriginY="bottom" transformRotateZ={deg} />
  )
  return (
    <Container width={size} height={size} borderRadius={R} backgroundColor={C.deep} borderWidth={1} borderColor={C.line}>
      {Array.from({ length: 60 }, (_, i) => {
        const major = i % 5 === 0
        return (
          <Container key={i} positionType="absolute" positionLeft={R - 1} positionTop={0} width={2} height={R} transformOriginY="bottom" transformRotateZ={-i * 6} alignItems="center">
            <Container marginTop={6} width={major ? 3 : 1.5} height={major ? 11 : 5} borderRadius={1} backgroundColor={major ? C.text : C.faint} />
          </Container>
        )
      })}
      {[12, 3, 6, 9].map((n, i) => {
        const r = R - 32
        const x = R + Math.sin((i * Math.PI) / 2) * r
        const y = R - Math.cos((i * Math.PI) / 2) * r
        return (
          <Text key={n} positionType="absolute" positionLeft={x - 14} positionTop={y - 10} width={28} height={20} textAlign="center" fontSize={16} fontWeight="medium" color={C.muted}>
            {String(n)}
          </Text>
        )
      })}
      {hand(hh, 6, R * 0.5, C.text, a.h)}
      {hand(mm, 4, R * 0.74, C.text, a.m)}
      {hand(ss, 2, R * 0.84, accent, a.s)}
      <Container positionType="absolute" positionLeft={R - 6} positionTop={R - 6} width={12} height={12} borderRadius={6} backgroundColor={accent} borderWidth={3} borderColor={C.deep} />
    </Container>
  )
}

// --- World ------------------------------------------------------------------

function WorldTab({ cities, main, h12, accent, onPick }: { cities: City[]; main: City; h12: boolean; accent: string; onPick: (c: City) => void }) {
  const now = useTick(1000)
  const here = partsIn(now)
  return (
    <Container flexGrow={1} flexDirection="column" gap={6}>
      {cities.map((c) => {
        const p = partsIn(now, c.timeZone)
        const off = Math.round((utc(p) - utc(here)) / MIN)
        const dd = Math.round((Date.UTC(p.y, p.mo - 1, p.d) - Date.UTC(here.y, here.mo - 1, here.d)) / 864e5)
        const day = p.h >= 6 && p.h < 18
        const on = c.label === main.label
        const Icon = day ? Sun : Moon
        return (
          <Press
            key={c.label}
            height={52}
            flexShrink={0}
            paddingX={12}
            borderRadius={12}
            flexDirection="row"
            alignItems="center"
            gap={10}
            lift={2}
            backgroundColor={on ? withOpacity(accent, 0.12) : C.row}
            hover={{ backgroundColor: on ? withOpacity(accent, 0.16) : C.hover }}
            onClick={() => onPick(c)}
          >
            <Container width={30} height={30} borderRadius={15} alignItems="center" justifyContent="center" backgroundColor={withOpacity(day ? C.sun : C.moon, 0.14)}>
              <Icon width={15} height={15} color={day ? C.sun : C.moon} />
            </Container>
            <Container flexGrow={1} flexDirection="column" gap={2}>
              <Text fontSize={14} fontWeight="semi-bold" color={on ? accent : C.text}>
                {c.label}
              </Text>
              <Text fontSize={11} color={C.muted}>
                {`${dd === 0 ? "Today" : dd > 0 ? "Tomorrow" : "Yesterday"} · ${c.timeZone ? offsetLabel(off) : "Here"}`}
              </Text>
            </Container>
            <Digits text={hhmm(p, h12)} size={24} color={C.text} weight="medium" />
            {h12 ? (
              <Text width={20} fontSize={10} fontWeight="semi-bold" color={C.muted}>
                {p.h < 12 ? "AM" : "PM"}
              </Text>
            ) : null}
          </Press>
        )
      })}
      <Text fontSize={11} color={C.faint} textAlign="center" marginTop={2}>
        Tap a city to show it on the Clock
      </Text>
    </Container>
  )
}

// --- Timer ------------------------------------------------------------------

type TimerApi = { toggle: () => void; reset: () => void; preset: (min: number) => void; nudge: (d: number) => void }
function TimerTab({ t, api, accent, h12 }: { t: TimerState; api: TimerApi; accent: string; h12: boolean }) {
  const now = useTick(100, t.run)
  const rem = remaining(t, now)
  const label = t.done ? "Time's up" : t.run ? `Ends ${hhmm(partsIn(t.endAt), h12)}${h12 ? (partsIn(t.endAt).h < 12 ? " am" : " pm") : ""}` : rem < t.dur ? "Paused" : `${Math.round(t.dur / MIN)} min timer`
  const presetOn = !t.run && !t.done && rem === t.dur
  return (
    <Container flexGrow={1} flexDirection="column" alignItems="center" gap={14} paddingTop={2}>
      <TickRing size={196} frac={t.dur ? rem / t.dur : 0} accent={t.done ? C.bad : accent}>
        <Digits text={countdown(rem)} size={rem >= 3600000 ? 36 : 46} color={t.done ? C.bad : C.text} weight="light" />
        <Text fontSize={12} fontWeight="medium" color={t.done ? C.bad : t.run ? accent : C.muted}>
          {label}
        </Text>
      </TickRing>

      <Container flexDirection="row" gap={6} alignSelf="stretch">
        <Chip label="−1" onClick={() => api.nudge(-MIN)} />
        {PRESETS.map((m) => (
          <Chip key={m} label={`${m} min`} grow on={presetOn && t.dur === m * MIN} accent={accent} onClick={() => api.preset(m)} />
        ))}
        <Chip label="+1" onClick={() => api.nudge(MIN)} />
      </Container>

      <Container flexDirection="row" gap={10} alignSelf="stretch">
        <Button label="Reset" icon={RotateCcw} onClick={api.reset} />
        <Button label={t.run ? "Pause" : t.done ? "Restart" : rem < t.dur ? "Resume" : "Start"} icon={t.run ? Pause : Play} primary accent={accent} onClick={api.toggle} />
      </Container>
    </Container>
  )
}

/** 60 ticks around a circle; the lit ones drain clockwise as `frac` falls. Children sit in the middle. */
function TickRing({ size, frac, accent, children }: { size: number; frac: number; accent: string; children?: React.ReactNode }) {
  const R = size / 2
  const lit = Math.ceil(Math.max(0, Math.min(1, frac)) * 60 - 1e-6)
  return (
    <Container width={size} height={size} flexShrink={0}>
      {Array.from({ length: 60 }, (_, i) => (
        <Container key={i} positionType="absolute" positionLeft={R - 2} positionTop={0} width={4} height={R} transformOriginY="bottom" transformRotateZ={-i * 6} alignItems="center">
          <Container width={3} height={14} borderRadius={1.5} backgroundColor={i < lit ? accent : C.line} />
        </Container>
      ))}
      <Container positionType="absolute" positionLeft={0} positionTop={0} width={size} height={size} flexDirection="column" alignItems="center" justifyContent="center" gap={4}>
        {children}
      </Container>
    </Container>
  )
}

// --- Stopwatch ----------------------------------------------------------------

type WatchApi = { toggle: () => void; lapOrReset: () => void }
function WatchTab({ w, api, accent }: { w: WatchState; api: WatchApi; accent: string }) {
  const done = w.laps.reduce((a, b) => a + b, 0)
  const best = w.laps.length > 1 ? Math.min(...w.laps) : -1
  const worst = w.laps.length > 1 ? Math.max(...w.laps) : -1
  const started = w.run || w.acc > 0
  return (
    <Container flexGrow={1} flexDirection="column" gap={12}>
      <Container height={84} alignItems="center" justifyContent="center">
        <Live w={w} size={54} color={C.text} weight="light" />
      </Container>

      <Container flexDirection="row" gap={10}>
        <Button label={w.run ? "Lap" : "Reset"} icon={w.run ? Flag : RotateCcw} dim={!started} onClick={api.lapOrReset} />
        <Button label={w.run ? "Stop" : started ? "Resume" : "Start"} icon={w.run ? Pause : Play} primary accent={w.run ? C.bad : accent} onClick={api.toggle} />
      </Container>

      <Container flexGrow={1} flexBasis={0} flexDirection="column" overflow="scroll" borderRadius={12} backgroundColor={C.deep} borderWidth={1} borderColor={C.line} paddingX={12}>
        {started ? (
          <LapRow n={w.laps.length + 1} first color={C.text}>
            <Live w={w} minus={done} size={15} color={C.text} weight="medium" />
          </LapRow>
        ) : (
          <Container flexGrow={1} alignItems="center" justifyContent="center" paddingY={20}>
            <Text fontSize={12} color={C.faint}>
              Laps show up here
            </Text>
          </Container>
        )}
        {w.laps
          .map((ms, i) => ({ ms, n: i + 1 }))
          .reverse()
          .map(({ ms, n }) => {
            const color = ms === best ? C.good : ms === worst ? C.bad : C.text
            return (
              <LapRow key={n} n={n} color={color} tag={ms === best ? "best" : ms === worst ? "worst" : undefined}>
                <Digits text={split(ms)} size={15} color={color} weight="medium" />
              </LapRow>
            )
          })}
      </Container>
    </Container>
  )
}

/** Running stopwatch readout; only this re-renders every centisecond. */
function Live({ w, minus = 0, size, color, weight }: { w: WatchState; minus?: number; size: number; color: string; weight: "light" | "medium" }) {
  const now = useTick(10, w.run)
  return <Digits text={split(elapsed(w, now) - minus)} size={size} color={color} weight={weight} />
}

function LapRow({ n, first, color, tag, children }: { n: number; first?: boolean; color: string; tag?: string; children: React.ReactNode }) {
  return (
    <Container height={34} flexShrink={0} flexDirection="row" alignItems="center" gap={8} borderTopWidth={first ? 0 : 1} borderColor={C.line}>
      <Text fontSize={13} color={color === C.text ? C.muted : color}>
        {`Lap ${n}`}
      </Text>
      {tag ? (
        <Container height={18} paddingX={6} borderRadius={5} alignItems="center" backgroundColor={withOpacity(color, 0.14)}>
          <Text fontSize={10} fontWeight="semi-bold" color={color}>
            {tag}
          </Text>
        </Container>
      ) : null}
      <Container flexGrow={1} />
      {children}
    </Container>
  )
}

// --- shared bits --------------------------------------------------------------

/** Each character in a fixed-width cell, so numbers never jitter as they change. */
function Digits({ text, size, color, weight, blinkColon }: { text: string; size: number; color: string; weight: "light" | "medium"; blinkColon?: boolean }) {
  const cell = Math.round(size * 0.6)
  const sep = Math.round(size * 0.3)
  return (
    <Container flexDirection="row" alignItems="center">
      {[...text].map((ch, i) => {
        const punct = ch === ":" || ch === "."
        return (
          <Text key={i} width={punct ? sep : cell} textAlign="center" fontSize={size} fontWeight={weight} color={punct ? (blinkColon ? withOpacity(C.text, 0.25) : C.faint) : color}>
            {ch}
          </Text>
        )
      })}
    </Container>
  )
}

function Chip({ label, onClick, grow, on, accent = C.accent }: { label: string; onClick: () => void; grow?: boolean; on?: boolean; accent?: string }) {
  return (
    <Press
      flexGrow={grow ? 1 : 0}
      flexBasis={grow ? 0 : "auto"}
      height={32}
      paddingX={grow ? 0 : 10}
      borderRadius={10}
      alignItems="center"
      justifyContent="center"
      backgroundColor={on ? withOpacity(accent, 0.16) : C.row}
      borderWidth={1}
      borderColor={on ? withOpacity(accent, 0.5) : C.line}
      hover={{ backgroundColor: on ? withOpacity(accent, 0.22) : C.hover }}
      onClick={onClick}
    >
      <Text fontSize={12} fontWeight="semi-bold" color={on ? accent : C.text}>
        {label}
      </Text>
    </Press>
  )
}

type IconT = typeof Play
function Button({ label, icon: Icon, onClick, primary, dim, accent = C.accent }: { label: string; icon: IconT; onClick: () => void; primary?: boolean; dim?: boolean; accent?: string }) {
  const fg = primary ? "#0B1714" : dim ? C.faint : C.text
  return (
    <Press
      flexGrow={1}
      flexBasis={0}
      height={44}
      borderRadius={22}
      flexDirection="row"
      alignItems="center"
      justifyContent="center"
      gap={8}
      backgroundColor={primary ? accent : C.row}
      borderWidth={primary ? 0 : 1}
      borderColor={C.line}
      hover={{ backgroundColor: primary ? accent : C.hover }}
      onClick={onClick}
    >
      <Icon width={15} height={15} color={fg} />
      <Text fontSize={14} fontWeight="semi-bold" color={fg}>
        {label}
      </Text>
    </Press>
  )
}

/** Pressable Container: lifts toward you on hover, dips on press. */
function Press({ children, lift = 3, ...props }: ContainerProperties & { lift?: number }) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const k = down ? 0.97 : 1
  const [ref, s] = useSpring({ transformTranslateZ: hover && !down ? lift : 0, transformScaleX: k, transformScaleY: k })
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
      if (Math.abs(to[k] - x[k]) < 0.01 && Math.abs(v[k]) < 0.05) {
        x[k] = to[k]
        v[k] = 0
      }
      moved = true
    }
    if (moved) ref.current?.setProperties({ ...x })
  })
  return [ref, s.current.x as T] as const
}
