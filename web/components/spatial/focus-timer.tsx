"use client"
// Built for Spatial; chime via Tone.js (MIT).

import { useEffect, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Text, withOpacity, type ContainerProperties, type VanillaContainer } from "@react-three/uikit"
import { ChevronsRight, Minus, Pause, Play, Plus, RotateCcw, SkipForward } from "@react-three/uikit-lucide"
import * as Tone from "tone"

const C = { panel: "#15171E", deep: "#101218", border: "#323745", line: "#242833", row: "#1B1E27", hover: "#262A35", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2", short: "#9DB8F5", long: "#B9B4F5" }
const MODES = ["Focus", "Short break", "Long break"]
const MAX = [90, 30, 60]
const TASKS = ["Deep work", "Write the report", "Code review", "Plan tomorrow", "Inbox zero"]
const TO_BREAK = ["G5", "E5", "C5"]
const TO_FOCUS = ["C5", "E5", "G5"]
const MIN = 60000
const PER_CYCLE = 4

type Props = {
  title?: string
  /** mode: 0 Focus, 1 Short break, 2 Long break */
  value?: number
  onChange?: (mode: number) => void
  focusMinutes?: number
  shortMinutes?: number
  longMinutes?: number
  /** tap the task line to cycle through these */
  tasks?: string[]
  accent?: string
}
type Run = { rem: number; endAt: number; run: boolean }

const two = (n: number) => String(n).padStart(2, "0")
const clock = (ms: number) => {
  const t = Math.max(0, Math.ceil(ms / 1000))
  return `${two(Math.floor(t / 60))}:${two(t % 60)}`
}
const remaining = (t: Run, now = Date.now()) => (t.run ? Math.max(0, t.endAt - now) : t.rem)

/** Pomodoro focus tool: focus / short / long break with editable lengths, a draining tick ring, session dots (every 4th break is long), a task line and today's totals. */
export default function FocusTimer({ title = "Focus", value, onChange, focusMinutes = 25, shortMinutes = 5, longMinutes = 15, tasks = TASKS, accent = C.accent }: Props) {
  const [mins, setMins] = useState(() => [focusMinutes, shortMinutes, longMinutes].map((m, i) => Math.max(1, Math.min(MAX[i], Math.round(m) || 1))))
  const [inner, setInner] = useState(0)
  const mode = Math.max(0, Math.min(2, Math.round(value ?? inner)))
  const setMode = (m: number) => {
    if (value === undefined) setInner(m)
    onChange?.(m)
  }
  const [t, setT] = useState<Run>({ rem: mins[mode] * MIN, endAt: 0, run: false })
  // A new mode (tab, phase change or a controlled `value`) loads that mode's full length.
  const [shown, setShown] = useState(mode)
  if (shown !== mode) {
    setShown(mode)
    setT({ rem: mins[mode] * MIN, endAt: 0, run: false })
  }
  const [cycle, setCycle] = useState(0) // focus sessions finished in this cycle
  const [stats, setStats] = useState({ sessions: 0, ms: 0 })
  const [task, setTask] = useState(-1)
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })
  const color = [accent, C.short, C.long][mode]
  const dur = mins[mode] * MIN

  const synth = useRef<Tone.PolySynth | null>(null)
  useEffect(
    () => () => {
      synth.current?.dispose()
      synth.current = null
    },
    [],
  )
  const chime = (notes: string[]) => {
    if (Tone.getContext().state !== "running") return // never start audio without a gesture
    synth.current ??= new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sine" }, envelope: { attack: 0.01, decay: 0.5, sustain: 0.05, release: 0.8 }, volume: -14 }).toDestination()
    const at = Tone.now()
    notes.forEach((n, i) => synth.current?.triggerAttackRelease(n, 0.6, at + i * 0.18))
  }

  const live = useRef({ t, mode, cycle, dur })
  live.current = { t, mode, cycle, dur }

  /** Leave the current phase. `counted` = it ran to zero (skips don't add to today's stats). */
  const advance = (counted: boolean) => {
    const { mode, cycle } = live.current
    let next = 0
    if (mode === 0) {
      const c = counted ? cycle + 1 : cycle
      if (counted) setStats((s) => ({ sessions: s.sessions + 1, ms: s.ms + live.current.dur }))
      setCycle(c)
      next = c >= PER_CYCLE ? 2 : 1
    } else if (mode === 2) setCycle(0)
    chime(next === 0 ? TO_FOCUS : TO_BREAK)
    setMode(next)
  }

  useFrame(() => {
    const s = live.current
    if (s.t.run && Date.now() >= s.t.endAt) {
      s.t = { rem: 0, endAt: 0, run: false }
      setT(s.t)
      advance(true)
    }
  })

  const toggle = () => {
    void Tone.start() // tap = user gesture, so the phase chime may play later
    const now = Date.now()
    setT((r) => {
      if (r.run) return { run: false, endAt: 0, rem: Math.max(0, r.endAt - now) }
      const rem = r.rem > 0 ? r.rem : dur
      return { run: true, rem, endAt: now + rem }
    })
  }
  const reset = () => setT({ rem: dur, endAt: 0, run: false })
  const skip = () => {
    void Tone.start()
    setT({ rem: 0, endAt: 0, run: false })
    advance(false)
  }
  const nudge = (d: number) => {
    if (t.run) return
    const m = Math.max(1, Math.min(MAX[mode], mins[mode] + d))
    setMins(mins.map((x, i) => (i === mode ? m : x)))
    setT({ rem: m * MIN, endAt: 0, run: false })
  }

  const fresh = !t.run && t.rem === dur
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
      <Container flexDirection="row" alignItems="center" gap={8} paddingX={6} height={22}>
        <Container width={8} height={8} borderRadius={4} backgroundColor={color} />
        <Text flexGrow={1} fontSize={16} fontWeight="semi-bold" color={C.text}>
          {title}
        </Text>
        <Text fontSize={12} color={C.muted}>
          {`Round ${Math.min(cycle + (mode === 0 ? 1 : 0), PER_CYCLE) || 1} of ${PER_CYCLE}`}
        </Text>
      </Container>

      <Container flexDirection="row" height={36} padding={3} gap={3} borderRadius={12} backgroundColor={C.deep} borderWidth={1} borderColor={C.line}>
        {MODES.map((m, i) => {
          const on = i === mode
          const tint = [accent, C.short, C.long][i]
          return (
            <Press
              key={m}
              flexGrow={1}
              flexBasis={0}
              height={28}
              borderRadius={9}
              alignItems="center"
              justifyContent="center"
              lift={1}
              backgroundColor={on ? withOpacity(tint, 0.16) : withOpacity("#FFFFFF", 0)}
              hover={{ backgroundColor: on ? withOpacity(tint, 0.2) : withOpacity("#FFFFFF", 0.04) }}
              onClick={() => setMode(i)}
            >
              <Text fontSize={12} fontWeight="semi-bold" color={on ? tint : C.muted}>
                {m}
              </Text>
            </Press>
          )
        })}
      </Container>

      <Press
        height={42}
        flexShrink={0}
        paddingX={12}
        borderRadius={12}
        flexDirection="row"
        alignItems="center"
        gap={10}
        lift={2}
        backgroundColor={C.row}
        borderWidth={1}
        borderColor={C.line}
        hover={{ backgroundColor: C.hover }}
        onClick={() => setTask((task + 1) % Math.max(1, tasks.length))}
      >
        <Container flexGrow={1} flexDirection="column" gap={1}>
          <Text fontSize={10} fontWeight="semi-bold" color={C.faint} letterSpacing={0.5}>
            {task < 0 ? "TAP TO PICK A TASK" : "WORKING ON"}
          </Text>
          <Text fontSize={13} fontWeight={task < 0 ? "medium" : "semi-bold"} color={task < 0 ? C.muted : C.text}>
            {task < 0 ? "What are you working on?" : (tasks[task] ?? "")}
          </Text>
        </Container>
        <ChevronsRight width={16} height={16} color={C.muted} />
      </Press>

      <Container flexGrow={1} flexDirection="row" alignItems="center" justifyContent="space-between" paddingX={6}>
        <Round icon={Minus} dim={t.run || mins[mode] <= 1} onClick={() => nudge(-1)} />
        <Face t={t} dur={dur} color={color} label={fresh ? `${mins[mode]} min ${MODES[mode].toLowerCase()}` : t.run ? (mode ? "Take a breather" : "Stay focused") : "Paused"} dots={Math.min(cycle, PER_CYCLE)} focus={mode === 0} accent={accent} />
        <Round icon={Plus} dim={t.run || mins[mode] >= MAX[mode]} onClick={() => nudge(1)} />
      </Container>

      <Container flexDirection="row" gap={10} alignItems="center">
        <Round icon={RotateCcw} dim={fresh} onClick={reset} />
        <Press
          flexGrow={1}
          height={44}
          borderRadius={22}
          flexDirection="row"
          alignItems="center"
          justifyContent="center"
          gap={8}
          backgroundColor={color}
          hover={{ backgroundColor: color }}
          onClick={toggle}
        >
          {t.run ? <Pause width={15} height={15} color="#0B1714" /> : <Play width={15} height={15} color="#0B1714" />}
          <Text fontSize={14} fontWeight="semi-bold" color="#0B1714">
            {t.run ? "Pause" : fresh ? `Start ${mode ? "break" : "focus"}` : "Resume"}
          </Text>
        </Press>
        <Round icon={SkipForward} onClick={skip} />
      </Container>

      <Container flexDirection="row" gap={8}>
        {[
          [String(stats.sessions), stats.sessions === 1 ? "session today" : "sessions today"],
          [String(Math.round(stats.ms / MIN)), "focus min today"],
          [String(PER_CYCLE - Math.min(cycle, PER_CYCLE)), "to long break"],
        ].map(([n, l]) => (
          <Container key={l} flexGrow={1} flexBasis={0} flexDirection="row" alignItems="center" gap={6} height={36} paddingX={10} borderRadius={10} backgroundColor={C.deep} borderWidth={1} borderColor={C.line}>
            <Text fontSize={15} fontWeight="semi-bold" color={C.text}>
              {n}
            </Text>
            <Text fontSize={10} color={C.faint}>
              {l}
            </Text>
          </Container>
        ))}
      </Container>
    </Container>
  )
}

/** Ring + countdown; only this part re-renders while the clock runs. */
function Face({ t, dur, color, label, dots, focus, accent }: { t: Run; dur: number; color: string; label: string; dots: number; focus: boolean; accent: string }) {
  const now = useTick(100, t.run)
  const rem = remaining(t, now)
  const size = 176
  const R = size / 2
  const lit = Math.ceil(Math.max(0, Math.min(1, dur ? rem / dur : 0)) * 60 - 1e-6)
  return (
    <Container width={size} height={size} flexShrink={0}>
      {Array.from({ length: 60 }, (_, i) => (
        <Container key={i} positionType="absolute" positionLeft={R - 2} positionTop={0} width={4} height={R} transformOriginY="bottom" transformRotateZ={-i * 6} alignItems="center">
          <Container width={3} height={13} borderRadius={1.5} backgroundColor={i < lit ? color : C.line} />
        </Container>
      ))}
      <Container positionType="absolute" positionLeft={0} positionTop={0} width={size} height={size} flexDirection="column" alignItems="center" justifyContent="center" gap={4}>
        <Digits text={clock(rem)} size={44} color={C.text} />
        <Text fontSize={11} fontWeight="medium" color={t.run ? color : C.muted}>
          {label}
        </Text>
        <Container flexDirection="row" gap={6} marginTop={6}>
          {Array.from({ length: PER_CYCLE }, (_, i) => (
            <Container
              key={i}
              width={8}
              height={8}
              borderRadius={4}
              backgroundColor={i < dots ? accent : withOpacity(accent, 0)}
              borderWidth={1.5}
              borderColor={i < dots || (focus && i === dots) ? accent : C.border}
            />
          ))}
        </Container>
      </Container>
    </Container>
  )
}

/** Each character in a fixed-width cell, so the countdown never jitters. */
function Digits({ text, size, color }: { text: string; size: number; color: string }) {
  return (
    <Container flexDirection="row" alignItems="center">
      {[...text].map((ch, i) => (
        <Text key={i} width={Math.round(size * (ch === ":" ? 0.3 : 0.6))} textAlign="center" fontSize={size} fontWeight="light" color={ch === ":" ? C.faint : color}>
          {ch}
        </Text>
      ))}
    </Container>
  )
}

type IconT = typeof Play
function Round({ icon: Icon, onClick, dim }: { icon: IconT; onClick: () => void; dim?: boolean }) {
  return (
    <Press width={44} height={44} flexShrink={0} borderRadius={22} alignItems="center" justifyContent="center" backgroundColor={C.row} borderWidth={1} borderColor={C.line} hover={{ backgroundColor: C.hover }} onClick={onClick}>
      <Icon width={16} height={16} color={dim ? C.faint : C.text} />
    </Press>
  )
}

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
