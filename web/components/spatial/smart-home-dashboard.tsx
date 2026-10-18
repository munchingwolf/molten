"use client"
// Built for Spatial.

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Text, withOpacity, type ContainerProperties, type VanillaContainer } from "@react-three/uikit"
import {
  ArrowLeftRight,
  Bed,
  Briefcase,
  Clapperboard,
  CloudSun,
  CookingPot,
  Flame,
  House,
  Lamp,
  LampDesk,
  LampFloor,
  Lightbulb,
  Lock,
  Minus,
  Moon,
  Music,
  Pause,
  Play,
  Plus,
  Snowflake,
  Sofa,
  Sun,
  Sunrise,
  Volume2,
  Zap,
} from "@react-three/uikit-lucide"

const C = {
  panel: "#15171E",
  deep: "#101218",
  card: "#1B1E27",
  border: "#323745",
  line: "#242833",
  hover: "#262A35",
  text: "#EEF0F4",
  muted: "#9AA0AD",
  faint: "#6B7180",
  accent: "#9FE7D2",
  onAccent: "#06221B",
  warm: "#FFD27A",
  heat: "#F2B48A",
  cool: "#8EC5FF",
}

type Mode = "heat" | "cool" | "auto"
type LightIcon = "bulb" | "floor" | "desk" | "lamp"
type Light = { name: string; icon: LightIcon; on: boolean; level: number }
type Room = { name: string; lights: Light[]; target: number; now: number; mode: Mode; playing: boolean; volume: number; track: string; scene: string | null }
type Props = {
  /** house name shown in the header */
  title?: string
  /** active room index (0 Living, 1 Kitchen, 2 Bedroom, 3 Office) */
  value?: number
  onChange?: (room: number) => void
  accent?: string
}

const ROOM_ICONS = [Sofa, CookingPot, Bed, Briefcase]
const LIGHT_ICONS = { bulb: Lightbulb, floor: LampFloor, desk: LampDesk, lamp: Lamp }
const MODES: { id: Mode; label: string; icon: typeof Flame; color: string }[] = [
  { id: "heat", label: "Heat", icon: Flame, color: C.heat },
  { id: "cool", label: "Cool", icon: Snowflake, color: C.cool },
  { id: "auto", label: "Auto", icon: ArrowLeftRight, color: C.accent },
]
const MIN = 60
const MAX = 84

const L = (name: string, icon: LightIcon, on: boolean, level: number): Light => ({ name, icon, on, level })
const ROOMS: Room[] = [
  { name: "Living", lights: [L("Ceiling", "bulb", true, 0.8), L("Floor lamp", "floor", true, 0.6), L("TV strip", "bulb", false, 0.4)], target: 71, now: 69, mode: "heat", playing: true, volume: 0.6, track: "Evening Jazz", scene: null },
  { name: "Kitchen", lights: [L("Pendants", "bulb", true, 0.9), L("Cabinets", "bulb", false, 0.7), L("Island", "lamp", false, 0.5)], target: 70, now: 70, mode: "auto", playing: false, volume: 0.4, track: "Morning Mix", scene: null },
  { name: "Bedroom", lights: [L("Ceiling", "bulb", false, 0.5), L("Bedside", "lamp", false, 0.3), L("Closet", "bulb", false, 1)], target: 67, now: 68, mode: "cool", playing: false, volume: 0.2, track: "Rain Sounds", scene: null },
  { name: "Office", lights: [L("Desk lamp", "desk", false, 0.7), L("Ceiling", "bulb", false, 0.8), L("Shelf", "lamp", false, 0.4)], target: 70, now: 71, mode: "auto", playing: false, volume: 0.4, track: "Deep Focus", scene: null },
]

const SCENES: { id: string; icon: typeof Sun; apply: (r: Room) => Room }[] = [
  { id: "Morning", icon: Sunrise, apply: (r) => ({ ...r, lights: r.lights.map((l) => ({ ...l, on: true, level: 0.8 })), target: 70, mode: "auto" }) },
  { id: "Movie", icon: Clapperboard, apply: (r) => ({ ...r, lights: r.lights.map((l, i) => ({ ...l, on: i === r.lights.length - 1, level: 0.2 })), target: 71, playing: true }) },
  { id: "Away", icon: Lock, apply: (r) => ({ ...r, lights: r.lights.map((l) => ({ ...l, on: false })), target: 64, mode: "auto", playing: false }) },
  { id: "Night", icon: Moon, apply: (r) => ({ ...r, lights: r.lights.map((l, i) => ({ ...l, on: i === 1, level: 0.1 })), target: 66, mode: "heat", playing: false }) },
]

// Earlier two-hour slots of today's usage (0-1); the last bar is "now" and follows the lights.
const HISTORY = [0.22, 0.18, 0.16, 0.2, 0.42, 0.58, 0.47, 0.4, 0.44, 0.62, 0.55]
const clampRoom = (i: number) => Math.min(ROOMS.length - 1, Math.max(0, Math.round(i)))

/** Smart-home control panel: room tabs, light tiles + brightness, thermostat dial, speaker, scenes and today's energy. */
export default function SmartHomeDashboard({ title = "Maple House", value, onChange, accent = C.accent }: Props) {
  const [inner, setInner] = useState(0)
  const [rooms, setRooms] = useState(ROOMS)
  const active = clampRoom(value ?? inner)
  const room = rooms[active]
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })
  const [tab, slide] = useSpring({ positionLeft: 4 + active * 92 })

  const pickRoom = (i: number) => {
    if (value === undefined) setInner(i)
    onChange?.(i)
  }
  const edit = (fn: (r: Room) => Room, keepScene = false) =>
    setRooms((all) =>
      all.map((r, i) => {
        if (i !== active) return r
        const next = fn(r)
        return keepScene ? next : { ...next, scene: null }
      }),
    )

  const lightsOn = rooms.reduce((n, r) => n + r.lights.filter((l) => l.on).length, 0)
  const roomOn = room.lights.filter((l) => l.on)
  const roomLevel = roomOn.length ? Math.max(...roomOn.map((l) => l.level)) : 0
  const speakers = rooms.filter((r) => r.playing).length
  const nowBar = Math.min(1, 0.14 + lightsOn * 0.075 + speakers * 0.04)
  const bars = [...HISTORY, nowBar]
  const kwh = bars.reduce((n, b) => n + b, 0) * 1.3
  const mode = MODES.find((m) => m.id === room.mode)!

  return (
    <Container
      ref={panel}
      {...enter}
      pixelSize={0.002}
      width={640}
      height={400}
      flexDirection="column"
      padding={14}
      gap={10}
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={22}
      overflow="hidden"
    >
      {/* Header: house, outside weather, lights-on count */}
      <Container flexDirection="row" alignItems="center" gap={10} height={32}>
        <Container width={32} height={32} borderRadius={10} backgroundColor={accent} alignItems="center" justifyContent="center">
          <House width={18} height={18} color={C.onAccent} />
        </Container>
        <Container flexDirection="column" flexGrow={1}>
          <Text fontSize={16} fontWeight="semi-bold" color={C.text}>
            {title}
          </Text>
          <Text fontSize={11} color={C.faint}>
            {`${rooms.length} rooms · Home`}
          </Text>
        </Container>
        <Container flexDirection="row" alignItems="center" gap={6} height={28} paddingX={10} borderRadius={14} backgroundColor={C.card}>
          <CloudSun width={15} height={15} color={C.muted} />
          <Text fontSize={12} fontWeight="medium" color={C.text}>
            58°
          </Text>
          <Text fontSize={12} color={C.muted}>
            Partly cloudy
          </Text>
        </Container>
        <Container
          flexDirection="row"
          alignItems="center"
          gap={6}
          height={28}
          paddingX={10}
          borderRadius={14}
          backgroundColor={lightsOn ? withOpacity(C.warm, 0.14) : C.card}
        >
          <Lightbulb width={15} height={15} color={lightsOn ? C.warm : C.faint} />
          <Text fontSize={12} fontWeight="medium" color={lightsOn ? C.warm : C.muted}>
            {lightsOn === 1 ? "1 light on" : `${lightsOn || "No"} lights on`}
          </Text>
        </Container>
      </Container>

      {/* Room tabs with a sliding indicator */}
      <Container flexDirection="row" alignItems="center" gap={12} height={36}>
        <Container width={4 * 92 + 8} height={36} borderRadius={12} backgroundColor={C.deep} flexDirection="row" padding={4}>
          <Container ref={tab} {...slide} positionType="absolute" positionTop={4} width={92} height={28} borderRadius={9} backgroundColor={accent} />
          {rooms.map((r, i) => {
            const Icon = ROOM_ICONS[i] ?? House
            const on = i === active
            return (
              <Press key={r.name} width={92} height={28} borderRadius={9} flexDirection="row" alignItems="center" justifyContent="center" gap={6} lift={1} onClick={() => pickRoom(i)}>
                <Icon width={14} height={14} color={on ? C.onAccent : C.muted} />
                <Text fontSize={12} fontWeight="semi-bold" color={on ? C.onAccent : C.muted}>
                  {r.name}
                </Text>
              </Press>
            )
          })}
        </Container>
        <Text flexGrow={1} fontSize={12} color={C.faint}>
          {`${roomOn.length} of ${room.lights.length} lights · ${room.now}° inside`}
        </Text>
      </Container>

      <Container flexDirection="row" gap={10} flexGrow={1}>
        {/* Left column: lights, brightness, scenes, speaker */}
        <Container flexDirection="column" width={372} gap={8}>
          <Container flexDirection="row" gap={8}>
            {room.lights.map((l, i) => {
              const Icon = LIGHT_ICONS[l.icon]
              return (
                <Press
                  key={l.name + i}
                  width={118.6}
                  height={86}
                  padding={10}
                  borderRadius={14}
                  borderWidth={1}
                  flexDirection="column"
                  justifyContent="space-between"
                  backgroundColor={l.on ? withOpacity(C.warm, 0.1 + l.level * 0.12) : C.card}
                  borderColor={l.on ? withOpacity(C.warm, 0.35 + l.level * 0.4) : C.line}
                  hover={{ backgroundColor: l.on ? withOpacity(C.warm, 0.18 + l.level * 0.12) : C.hover }}
                  onClick={() => edit((r) => ({ ...r, lights: r.lights.map((x, j) => (j === i ? { ...x, on: !x.on } : x)) }))}
                >
                  <Container flexDirection="row" justifyContent="space-between" alignItems="center">
                    <Container width={30} height={30} borderRadius={15} alignItems="center" justifyContent="center" backgroundColor={l.on ? C.warm : C.hover}>
                      <Icon width={16} height={16} color={l.on ? "#3A2A08" : C.faint} />
                    </Container>
                    <Container width={26} height={14} borderRadius={7} padding={2} backgroundColor={l.on ? C.warm : C.border} flexDirection="row" justifyContent={l.on ? "flex-end" : "flex-start"}>
                      <Container width={10} height={10} borderRadius={5} backgroundColor={l.on ? "#3A2A08" : C.muted} />
                    </Container>
                  </Container>
                  <Container flexDirection="column">
                    <Text fontSize={13} fontWeight="semi-bold" color={C.text}>
                      {l.name}
                    </Text>
                    <Text fontSize={11} color={l.on ? C.warm : C.faint}>
                      {l.on ? `On · ${Math.round(l.level * 100)}%` : "Off"}
                    </Text>
                  </Container>
                </Press>
              )
            })}
          </Container>

          <Container flexDirection="row" alignItems="center" gap={10} height={34} paddingX={12} borderRadius={12} backgroundColor={C.card}>
            <Sun width={15} height={15} color={roomLevel ? C.warm : C.faint} />
            <Text fontSize={12} fontWeight="medium" color={C.muted} width={74}>
              Brightness
            </Text>
            <Track
              width={200}
              steps={10}
              value={roomLevel}
              color={C.warm}
              onChange={(v) =>
                edit((r) => {
                  const anyOn = r.lights.some((l) => l.on)
                  return { ...r, lights: r.lights.map((l) => (l.on || !anyOn ? { ...l, on: true, level: v } : l)) }
                })
              }
            />
            <Text fontSize={12} fontWeight="semi-bold" color={C.text} flexGrow={1} textAlign="right">
              {roomLevel ? `${Math.round(roomLevel * 100)}%` : "Off"}
            </Text>
          </Container>

          <Container flexDirection="row" gap={8}>
            {SCENES.map((s) => {
              const on = room.scene === s.id
              return (
                <Press
                  key={s.id}
                  width={87}
                  height={40}
                  borderRadius={12}
                  flexDirection="row"
                  alignItems="center"
                  justifyContent="center"
                  gap={6}
                  borderWidth={1}
                  borderColor={on ? accent : C.line}
                  backgroundColor={on ? withOpacity(accent, 0.16) : C.card}
                  hover={{ backgroundColor: on ? withOpacity(accent, 0.22) : C.hover }}
                  onClick={() => setRooms((all) => all.map((r, i) => (i === active ? { ...s.apply(r), scene: s.id } : r)))}
                >
                  <s.icon width={15} height={15} color={on ? accent : C.muted} />
                  <Text fontSize={12} fontWeight="semi-bold" color={on ? C.text : C.muted}>
                    {s.id}
                  </Text>
                </Press>
              )
            })}
          </Container>

          <Container flexDirection="row" alignItems="center" gap={10} flexGrow={1} paddingX={10} borderRadius={14} backgroundColor={C.card}>
            <Container width={44} height={44} borderRadius={10} backgroundColor={withOpacity(accent, room.playing ? 0.85 : 0.25)} alignItems="center" justifyContent="center">
              <Music width={20} height={20} color={room.playing ? C.onAccent : accent} />
            </Container>
            <Container flexDirection="column" flexGrow={1} flexShrink={1}>
              <Text fontSize={13} fontWeight="semi-bold" color={C.text}>
                {room.track}
              </Text>
              <Text fontSize={11} color={room.playing ? accent : C.faint}>
                {`${room.name} speaker · ${room.playing ? "Playing" : "Paused"}`}
              </Text>
            </Container>
            <Volume2 width={14} height={14} color={C.faint} />
            <Track width={100} steps={5} value={room.volume} color={accent} onChange={(v) => edit((r) => ({ ...r, volume: v }), true)} />
            <Press
              width={36}
              height={36}
              borderRadius={18}
              alignItems="center"
              justifyContent="center"
              backgroundColor={room.playing ? accent : C.hover}
              hover={{ backgroundColor: room.playing ? accent : C.border }}
              onClick={() => edit((r) => ({ ...r, playing: !r.playing }), true)}
            >
              {room.playing ? <Pause width={16} height={16} color={C.onAccent} /> : <Play width={16} height={16} color={C.text} />}
            </Press>
          </Container>
        </Container>

        {/* Right column: thermostat + energy */}
        <Container flexDirection="column" flexGrow={1} gap={8}>
          <Container flexDirection="column" alignItems="center" padding={10} paddingTop={8} gap={4} borderRadius={14} backgroundColor={C.card}>
            <Container flexDirection="row" width="100%" justifyContent="space-between" alignItems="center">
              <Text fontSize={12} fontWeight="semi-bold" color={C.text}>
                Thermostat
              </Text>
              <Text fontSize={11} color={C.faint}>
                {`Now ${room.now}°`}
              </Text>
            </Container>
            <Dial
              target={room.target}
              now={room.now}
              color={mode.color}
              status={room.mode === "auto" ? "Auto" : room.target === room.now ? "Holding" : `${mode.label}ing`}
              onSet={(t) => edit((r) => ({ ...r, target: Math.min(MAX, Math.max(MIN, t)) }))}
            />
            <Container flexDirection="row" gap={4} width="100%">
              {MODES.map((m) => {
                const on = m.id === room.mode
                return (
                  <Press
                    key={m.id}
                    flexGrow={1}
                    height={26}
                    borderRadius={8}
                    flexDirection="row"
                    alignItems="center"
                    justifyContent="center"
                    gap={4}
                    backgroundColor={on ? withOpacity(m.color, 0.2) : C.deep}
                    hover={{ backgroundColor: on ? withOpacity(m.color, 0.26) : C.hover }}
                    lift={1}
                    onClick={() => edit((r) => ({ ...r, mode: m.id }))}
                  >
                    <m.icon width={12} height={12} color={on ? m.color : C.faint} />
                    <Text fontSize={11} fontWeight="semi-bold" color={on ? m.color : C.muted}>
                      {m.label}
                    </Text>
                  </Press>
                )
              })}
            </Container>
          </Container>

          <Container flexDirection="column" flexGrow={1} padding={10} paddingTop={8} gap={6} borderRadius={14} backgroundColor={C.card}>
            <Container flexDirection="row" alignItems="center" gap={5}>
              <Zap width={12} height={12} color={accent} />
              <Text fontSize={12} fontWeight="semi-bold" color={C.text} flexGrow={1}>
                Energy today
              </Text>
              <Text fontSize={12} fontWeight="semi-bold" color={C.text}>
                {`${kwh.toFixed(1)} kWh`}
              </Text>
            </Container>
            <Container flexDirection="row" alignItems="flex-end" gap={4} flexGrow={1}>
              {bars.map((b, i) => (
                <Bar key={i} h={4 + b * 30} color={i === bars.length - 1 ? accent : withOpacity(C.muted, 0.35)} />
              ))}
            </Container>
          </Container>
        </Container>
      </Container>
    </Container>
  )
}

/** Circular thermostat: 270° of tappable/draggable ticks, live target readout, ± in the open bottom of the arc. */
function Dial({ target, now, color, status, onSet }: { target: number; now: number; color: string; status: string; onSet: (t: number) => void }) {
  const drag = useRef(false)
  const D = 136
  const c = D / 2
  const r = 56
  const n = MAX - MIN
  const stop = () => (drag.current = false)
  return (
    <Container width={D} height={D} onPointerUp={stop} onPointerLeave={stop}>
      {Array.from({ length: n + 1 }, (_, i) => {
        const t = MIN + i
        const a = 225 - (i * 270) / n
        const rad = (a * Math.PI) / 180
        const lit = t <= target
        const isNow = t === now
        return (
          <Container
            key={t}
            positionType="absolute"
            positionLeft={c + r * Math.cos(rad) - 10}
            positionTop={c - r * Math.sin(rad) - 10}
            width={20}
            height={20}
            alignItems="center"
            justifyContent="center"
            transformRotateZ={a - 90}
            cursor="pointer"
            onPointerDown={() => {
              drag.current = true
              onSet(t)
            }}
            onPointerEnter={() => drag.current && onSet(t)}
          >
            <Container width={isNow ? 4 : 3} height={t === target ? 16 : isNow ? 14 : 10} borderRadius={2} backgroundColor={isNow && !lit ? C.text : lit ? color : C.border} />
          </Container>
        )
      })}
      <Container positionType="absolute" positionLeft={c - 44} positionTop={c - 34} width={88} height={60} flexDirection="column" alignItems="center" justifyContent="center">
        <Text fontSize={34} fontWeight="semi-bold" color={C.text}>
          {`${target}°`}
        </Text>
        <Text fontSize={11} fontWeight="medium" color={color}>
          {status}
        </Text>
      </Container>
      {[-1, 1].map((d) => (
        <Press
          key={d}
          positionType="absolute"
          positionLeft={d < 0 ? c - 30 : c + 4}
          positionTop={c + 34}
          width={26}
          height={26}
          borderRadius={13}
          alignItems="center"
          justifyContent="center"
          backgroundColor={C.deep}
          hover={{ backgroundColor: C.hover }}
          lift={2}
          onClick={() => onSet(target + d)}
        >
          {d < 0 ? <Minus width={13} height={13} color={C.text} /> : <Plus width={13} height={13} color={C.text} />}
        </Press>
      ))}
    </Container>
  )
}

/** Slider built from tappable segments: tap a spot or drag across it. Each segment is >= 20 px wide. */
function Track({ width, steps, value, color, onChange }: { width: number; steps: number; value: number; color: string; onChange: (v: number) => void }) {
  const drag = useRef(false)
  const stop = () => (drag.current = false)
  const x = Math.max(0, Math.min(1, value)) * width
  return (
    <Container width={width} height={24} justifyContent="center" onPointerUp={stop} onPointerLeave={stop}>
      <Container width={width} height={6} borderRadius={3} backgroundColor={C.border}>
        <Container width={x} height={6} borderRadius={3} backgroundColor={color} />
      </Container>
      <Container positionType="absolute" positionLeft={Math.max(0, Math.min(width - 14, x - 7))} positionTop={5} width={14} height={14} borderRadius={7} backgroundColor={C.text} />
      <Container positionType="absolute" positionLeft={0} positionTop={0} width={width} height={24} flexDirection="row">
        {Array.from({ length: steps }, (_, i) => (
          <Container
            key={i}
            width={width / steps}
            height={24}
            cursor="pointer"
            onPointerDown={() => {
              drag.current = true
              onChange((i + 1) / steps)
            }}
            onPointerEnter={() => drag.current && onChange((i + 1) / steps)}
          />
        ))}
      </Container>
    </Container>
  )
}

/** Energy bar whose height springs to its value. */
function Bar({ h, color }: { h: number; color: ContainerProperties["backgroundColor"] }) {
  const [ref, s] = useSpring({ height: h })
  return <Container ref={ref} {...s} flexGrow={1} borderRadius={3} backgroundColor={color} />
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
