// Built for Spatial; audio via Tone.js (MIT).
"use client"

import { useEffect, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Text, withOpacity, type ContainerProperties, type VanillaContainer } from "@react-three/uikit"
import { Hand, Minus, Play, Plus, Square } from "@react-three/uikit-lucide"
import * as Tone from "tone"
import { Color, Vector3, type Group } from "three"

const C = { panel: "#15171E", deep: "#101218", border: "#323745", line: "#242833", row: "#1B1E27", hover: "#262A35", track: "#2A2E3A", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2", onAccent: "#06221B", warm: "#F2B48A" }

type Sig = "2/4" | "3/4" | "4/4" | "6/8"
type Props = {
  /** tempo in beats per minute, 40-240 */
  value?: number
  onChange?: (bpm: number) => void
  playing?: boolean
  onPlayingChange?: (playing: boolean) => void
  timeSignature?: Sig
  title?: string
  accent?: string
}

const MIN = 40
const MAX = 240
const SIGS: Sig[] = ["2/4", "3/4", "4/4", "6/8"]
const BEATS: Record<Sig, number> = { "2/4": 2, "3/4": 3, "4/4": 4, "6/8": 6 }
const SWING = 26 // pendulum amplitude, degrees
const INNER = 328 // panel width minus padding, px: the drag strip spans this
const clampBpm = (n: number) => Math.min(MAX, Math.max(MIN, Math.round(n)))
const tempoName = (b: number) => (b < 60 ? "Largo" : b < 76 ? "Adagio" : b < 108 ? "Andante" : b < 120 ? "Moderato" : b < 168 ? "Allegro" : "Presto")

/** Metronome: sample-accurate clicks (accented downbeat), beat lights, a swinging pendulum, tap tempo and time signatures. */
export default function Metronome({ value, onChange, playing, onPlayingChange, timeSignature = "4/4", title = "Metronome", accent = C.accent }: Props) {
  const [inner, setInner] = useState(120)
  const bpm = clampBpm(value ?? inner)
  const [innerOn, setInnerOn] = useState(false)
  const on = playing ?? innerOn
  const [sig, setSig] = useState<Sig>(SIGS.includes(timeSignature) ? timeSignature : "4/4")
  useEffect(() => setSig(SIGS.includes(timeSignature) ? timeSignature : "4/4"), [timeSignature])
  const beats = BEATS[sig]

  const root = useRef<Group>(null)
  const arm = useRef<VanillaContainer>(null)
  const lights = useRef<(VanillaContainer | null)[]>([])
  const synth = useRef<Tone.Synth | null>(null)
  // What the audio thread last played, stamped on the frame clock by Tone.Draw: drives lights + pendulum.
  const beat = useRef({ i: -1, n: 0, at: 0 })
  const live = useRef({ bpm, beats, sig, reset: false, angle: 0 })
  live.current.bpm = bpm
  if (live.current.sig !== sig) Object.assign(live.current, { sig, beats, reset: true })
  const taps = useRef<number[]>([])
  const drag = useRef(false)
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })

  const setBpm = (n: number) => {
    const b = clampBpm(n)
    if (b === bpm) return
    if (value === undefined) setInner(b)
    onChange?.(b)
  }

  useEffect(() => {
    const s = new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.02 }, volume: -6 }).toDestination()
    synth.current = s
    return () => {
      s.dispose()
      synth.current = null
    }
  }, [])

  useEffect(() => {
    if (on) Tone.getTransport().bpm.value = bpm
  }, [on, bpm])

  useEffect(() => {
    if (!on) return
    const t = Tone.getTransport()
    t.stop()
    t.position = 0
    t.bpm.value = live.current.bpm
    let n = 0
    const id = t.scheduleRepeat((time) => {
      const L = live.current
      if (L.reset) {
        n = 0
        L.reset = false
      }
      const i = n % L.beats
      // Downbeat high, 6/8's second pulse in between, the rest low.
      const hz = i === 0 ? 1760 : L.sig === "6/8" && i === 3 ? 1320 : 990
      synth.current?.triggerAttackRelease(hz, 0.03, time, i === 0 ? 1 : 0.75)
      const count = n++
      Tone.getDraw().schedule(() => (beat.current = { i, n: count, at: performance.now() }), time)
    }, "4n", 0)
    t.start("+0.05")
    return () => {
      t.clear(id)
      t.stop()
      beat.current = { i: -1, n: 0, at: 0 }
    }
  }, [on])

  useFrame((_, dt) => {
    const L = live.current
    const b = beat.current
    const now = performance.now()
    const period = 60000 / L.bpm
    // Arm sits at an extreme on every click and sweeps across between them; at rest it eases to centre.
    let target = 0
    if (on && b.i >= 0) {
      const p = Math.min(1, (now - b.at) / period)
      target = (b.n % 2 ? -1 : 1) * SWING * Math.cos(Math.PI * p)
      L.angle = target
    } else L.angle += (target - L.angle) * Math.min(1, dt * 8)
    arm.current?.setProperties({ transformRotateZ: L.angle })

    const k = on && b.i >= 0 ? Math.max(0, 1 - (now - b.at) / Math.min(260, period * 0.8)) : 0
    lights.current.forEach((el, i) => {
      if (!el) return
      const hot = i === b.i && on
      const base = i === 0 ? C.warm : accent
      el.setProperties({
        backgroundColor: hot ? mix(C.hover, base, 0.45 + 0.55 * k) : C.row,
        borderColor: hot ? base : C.border,
        transformScaleX: hot ? 1 + 0.18 * k : 1,
        transformScaleY: hot ? 1 + 0.18 * k : 1,
      })
    })
  })

  const toggle = async () => {
    await Tone.start() // browsers stay silent until a user gesture resumes audio
    if (playing === undefined) setInnerOn(!on)
    onPlayingChange?.(!on)
  }

  const tap = async () => {
    const now = performance.now()
    const list = taps.current
    if (list.length && now - list[list.length - 1] > 2000) list.length = 0
    list.push(now)
    if (list.length > 6) list.shift()
    if (list.length >= 2) setBpm(60000 / ((list[list.length - 1] - list[0]) / (list.length - 1)))
    await Tone.start()
    if (!on && Tone.getContext().state === "running") synth.current?.triggerAttackRelease(1320, 0.03, Tone.now(), 0.6)
  }

  const fromPointer = (e: { point: Vector3 }) => {
    if (!root.current) return
    // Local x so the strip still works when the panel is moved, rotated or scaled.
    const x = root.current.worldToLocal(e.point.clone()).x / 0.002
    setBpm(MIN + (x / INNER + 0.5) * (MAX - MIN))
  }
  const release = () => void (drag.current = false)

  const frac = (bpm - MIN) / (MAX - MIN)
  const weightTop = 8 + frac * 62 // like a real metronome: weight high = slow, low = fast

  return (
    <group ref={root}>
      <Container ref={panel} {...enter} pixelSize={0.002} width={360} height={440} flexDirection="column" padding={16} gap={12} backgroundColor={C.panel} borderWidth={1} borderColor={C.border} borderRadius={22}>
        {/* Header + time signature */}
        <Container flexDirection="row" alignItems="center" justifyContent="space-between" height={26} flexShrink={0}>
          <Text fontSize={15} fontWeight="semi-bold" color={C.text}>
            {title}
          </Text>
          <Container flexDirection="row" padding={2} gap={2} borderRadius={9} backgroundColor={C.row}>
            {SIGS.map((s) => {
              const act = s === sig
              return (
                <Press key={s} lift={1} width={38} height={24} borderRadius={7} alignItems="center" justifyContent="center" backgroundColor={act ? C.hover : withOpacity("#FFFFFF", 0)} hover={{ backgroundColor: act ? C.hover : withOpacity("#FFFFFF", 0.05) }} onClick={() => setSig(s)}>
                  <Text fontSize={11} fontWeight="semi-bold" color={act ? accent : C.muted}>
                    {s}
                  </Text>
                </Press>
              )
            })}
          </Container>
        </Container>

        {/* Pendulum */}
        <Container flexGrow={1} flexShrink={1} minHeight={120} borderRadius={14} backgroundColor={C.deep} borderWidth={1} borderColor={C.line} overflow="hidden">
          {[-24, -16, -8, 0, 8, 16, 24].map((a) => (
            <Container key={a} positionType="absolute" positionLeft="50%" marginLeft={-1} positionBottom={20} width={2} height={128} transformOriginY="bottom" transformRotateZ={a} flexDirection="column">
              <Container width={2} height={a === 0 ? 12 : 7} borderRadius={1} backgroundColor={a === 0 ? C.faint : C.border} />
            </Container>
          ))}
          <Container ref={arm} positionType="absolute" positionLeft="50%" marginLeft={-2} positionBottom={20} width={4} height={118} borderRadius={2} backgroundColor="#C9CED8" transformOriginY="bottom" transformTranslateZ={4}>
            <Container positionType="absolute" positionTop={weightTop} positionLeft={-10} width={24} height={16} borderRadius={4} backgroundColor={accent} borderWidth={1} borderColor={withOpacity("#000000", 0.25)} />
          </Container>
          <Container positionType="absolute" positionLeft="50%" marginLeft={-8} positionBottom={12} width={16} height={16} borderRadius={8} backgroundColor={C.border} borderWidth={3} borderColor={C.track} transformTranslateZ={6} />
          <Container positionType="absolute" positionLeft={12} positionTop={10} flexDirection="row" alignItems="center" gap={6}>
            <Container width={7} height={7} borderRadius={4} backgroundColor={on ? accent : C.faint} />
            <Text fontSize={10} fontWeight="semi-bold" letterSpacing={0.6} color={on ? accent : C.faint}>
              {on ? "RUNNING" : "STOPPED"}
            </Text>
          </Container>
          <Text positionType="absolute" positionRight={12} positionTop={10} fontSize={10} color={C.faint}>
            {`${sig} · ${beats} beats`}
          </Text>
        </Container>

        {/* Beat lights */}
        <Container flexDirection="row" justifyContent="center" alignItems="center" gap={8} height={24} flexShrink={0}>
          {Array.from({ length: beats }, (_, i) => (
            <Container key={`${sig}-${i}`} ref={(el: VanillaContainer | null) => void (lights.current[i] = el)} marginLeft={sig === "6/8" && i === 3 ? 10 : 0} width={beats > 4 ? 30 : 40} height={22} borderRadius={11} alignItems="center" justifyContent="center" backgroundColor={C.row} borderWidth={1} borderColor={C.border}>
              <Text fontSize={10} fontWeight="semi-bold" color={i === 0 ? C.warm : C.muted}>
                {`${i + 1}`}
              </Text>
            </Container>
          ))}
        </Container>

        {/* BPM readout flanked by -1 / +1 */}
        <Container flexDirection="row" alignItems="center" justifyContent="space-between" height={64} flexShrink={0}>
          <Round onPress={() => setBpm(bpm - 1)}>
            <Minus width={20} height={20} color={C.text} />
          </Round>
          <Container flexDirection="column" alignItems="center" gap={2}>
            <Container flexDirection="row" alignItems="flex-end" gap={6}>
              <Text fontSize={48} fontWeight="bold" letterSpacing={-1} color={C.text}>
                {`${bpm}`}
              </Text>
              <Text fontSize={12} fontWeight="semi-bold" color={C.muted} paddingBottom={10}>
                BPM
              </Text>
            </Container>
            <Text fontSize={11} fontWeight="semi-bold" letterSpacing={0.8} color={accent}>
              {tempoName(bpm).toUpperCase()}
            </Text>
          </Container>
          <Round onPress={() => setBpm(bpm + 1)}>
            <Plus width={20} height={20} color={C.text} />
          </Round>
        </Container>

        {/* Drag strip: 40 ... 240 */}
        <Container
          height={26}
          flexShrink={0}
          flexDirection="column"
          justifyContent="center"
          cursor="pointer"
          onPointerDown={(e) => {
            ;(e.target as unknown as Element).setPointerCapture?.(e.pointerId)
            drag.current = true
            fromPointer(e)
          }}
          onPointerMove={(e) => drag.current && fromPointer(e)}
          onPointerUp={release}
          onPointerLeave={release}
        >
          <Container width="100%" height={4} borderRadius={2} backgroundColor={C.track} flexDirection="row">
            <Container width={`${frac * 100}%`} height={4} borderRadius={2} backgroundColor={withOpacity(accent, 0.7)} />
          </Container>
          <Container positionType="absolute" positionLeft={`${frac * 100}%`} positionTop={3} marginLeft={-8} width={16} height={16} borderRadius={8} backgroundColor={C.text} borderWidth={3} borderColor={accent} transformTranslateZ={3} />
          {[40, 80, 120, 160, 200, 240].map((m) => (
            <Text key={m} positionType="absolute" positionLeft={`${((m - MIN) / (MAX - MIN)) * 100}%`} marginLeft={m === MIN ? 0 : m === MAX ? -16 : -8} positionTop={19} fontSize={7} color={C.faint}>
              {`${m}`}
            </Text>
          ))}
        </Container>

        {/* Tap + start/stop */}
        <Container flexDirection="row" gap={10} height={48} flexShrink={0} marginTop={4}>
          <Press width={110} borderRadius={14} flexDirection="row" alignItems="center" justifyContent="center" gap={7} backgroundColor={C.row} borderWidth={1} borderColor={C.border} hover={{ backgroundColor: C.hover }} onClick={tap}>
            <Hand width={16} height={16} color={C.muted} />
            <Text fontSize={13} fontWeight="semi-bold" color={C.text}>
              Tap
            </Text>
          </Press>
          <Press flexGrow={1} borderRadius={14} flexDirection="row" alignItems="center" justifyContent="center" gap={8} backgroundColor={on ? C.hover : accent} borderWidth={1} borderColor={on ? C.border : accent} hover={{ backgroundColor: on ? "#2E3340" : withOpacity(accent, 0.88) }} onClick={toggle}>
            {on ? <Square width={14} height={14} color={C.text} /> : <Play width={16} height={16} color={C.onAccent} />}
            <Text fontSize={14} fontWeight="bold" color={on ? C.text : C.onAccent}>
              {on ? "Stop" : "Start"}
            </Text>
          </Press>
        </Container>
      </Container>
    </group>
  )
}

const ca = new Color()
const cb = new Color()
const mix = (a: string, b: string, k: number) => `#${ca.set(a).lerp(cb.set(b), k).getHexString()}`

function Round({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
  return (
    <Press width={48} height={48} borderRadius={24} alignItems="center" justifyContent="center" backgroundColor={C.row} borderWidth={1} borderColor={C.border} hover={{ backgroundColor: C.hover }} onClick={onPress}>
      {children}
    </Press>
  )
}

/** Pressable Container: lifts toward you on hover, dips on press. */
function Press({ children, lift = 3, ...props }: ContainerProperties & { lift?: number }) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const k = down ? 0.98 : 1
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
