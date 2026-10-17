"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { Apple, Axe, Bomb, BowArrow, Coins, FlaskConical, Gem, Key, MapIcon, Package, Shield, Sword, WandSparkles } from "@react-three/uikit-lucide"
import { AdditiveBlending, Color, RingGeometry, type Group, type MeshBasicMaterial } from "three"
import * as Tone from "tone"

const ICONS = { sword: Sword, shield: Shield, potion: FlaskConical, key: Key, gem: Gem, bow: BowArrow, map: MapIcon, coin: Coins, apple: Apple, bomb: Bomb, wand: WandSparkles, axe: Axe }
const DEFAULT_ITEMS = ["sword", "bow", "bomb", "potion", "shield", "wand"]

const PX = 0.002 // metres per uikit pixel
const R_IN = 0.058
const R_OUT = 0.15 // 30 cm across
const GAP = 0.05 // radians between segments
const PUSH = 0.014 // outward travel of a highlighted segment
const SURFACE = new Color("#1B1E27")
const NEAR = new Color("#2A2F3B")
const NOTES = ["C5", "D5", "E5", "G5", "A5", "C6", "D6", "E6"]

type Props = {
  /** Item names: sword, shield, potion, key, gem, bow, map, coin, apple, bomb, wand, axe. One segment each. */
  items?: string[]
  /** Selected segment index, -1 for none. Omit to let the wheel manage it. */
  value?: number
  color?: string
  onChange?: (index: number) => void
}

const label = (s: string) => s.trim().charAt(0).toUpperCase() + s.trim().slice(1)

/** 30 cm item wheel: segments push out as a finger nears, tap one to equip it (mint glow, click). */
export default function ItemWheel({ items = DEFAULT_ITEMS, value, color = "#9FE7D2", onChange }: Props) {
  const n = Math.max(1, items.length)
  const span = (Math.PI * 2) / n
  const [inner, setInner] = useState(-1)
  const v = value ?? inner
  const [hover, setHover] = useState(-1)
  const lastHover = useRef(-1)
  const tint = useMemo(() => new Color(color), [color])
  // One sector per item, segment 0 at the top, going clockwise.
  const geos = useMemo(
    () => Array.from({ length: n }, (_, i) => new RingGeometry(R_IN, R_OUT, Math.max(4, Math.ceil(32 / n)), 1, Math.PI / 2 - (i + 0.5) * span + GAP / 2, span - GAP)),
    [n, span],
  )
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos])
  const synth = useRef<Tone.PolySynth | null>(null)
  useEffect(() => () => void synth.current?.dispose(), [])
  const voice = () =>
    (synth.current ??= new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.08 },
      volume: -12,
    }).toDestination())

  const select = async (i: number) => {
    if (value === undefined) setInner(i)
    onChange?.(i)
    await Tone.start()
    const t = Tone.now()
    const note = NOTES[i % NOTES.length]
    voice().triggerAttackRelease(note, 0.05, t)
    voice().triggerAttackRelease(Tone.Frequency(note).transpose(7).toNote(), 0.08, t + 0.05)
  }

  const hoverAt = (i: number, on: boolean) => {
    if (!on) {
      if (lastHover.current === i) lastHover.current = -1
      setHover((h) => (h === i ? -1 : h))
      return
    }
    if (lastHover.current === i) return
    lastHover.current = i
    setHover(i)
    // Quiet tick per new segment, only once a tap has unlocked audio.
    if (Tone.getContext().state === "running") voice().triggerAttackRelease(NOTES[i % NOTES.length], 0.02, Tone.now(), 0.2)
  }

  const shownIdx = hover >= 0 ? hover : v
  const name = items[shownIdx]

  return (
    <group>
      <mesh position={[0, 0, -0.003]}>
        <circleGeometry args={[R_OUT + PUSH + 0.01, 32]} />
        <meshBasicMaterial color="#0B0C10" transparent opacity={0.75} depthWrite={false} toneMapped={false} />
      </mesh>
      {geos.map((geo, i) => (
        <Segment
          key={i}
          geo={geo}
          angle={Math.PI / 2 - i * span}
          item={items[i] ?? ""}
          on={i === v}
          tint={tint}
          onTap={() => void select(i)}
          onHover={(on) => hoverAt(i, on)}
        />
      ))}
      <group position={[0, 0, 0.002]}>
        <Container
          pixelSize={PX}
          width={96}
          height={96}
          borderRadius={48}
          backgroundColor="#15171E"
          borderWidth={1.5}
          borderColor={v >= 0 ? color : "#323745"}
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          gap={3}
          pointerEvents="none"
        >
          <Text fontSize={8} fontWeight="semi-bold" letterSpacing={1} color="#6B7180">
            {hover >= 0 && hover !== v ? "SELECT" : v >= 0 ? "EQUIPPED" : "ITEMS"}
          </Text>
          <Text fontSize={13} fontWeight="semi-bold" color={!name ? "#6B7180" : shownIdx === v ? color : "#EEF0F4"}>
            {name ? label(name) : "None"}
          </Text>
        </Container>
      </group>
    </group>
  )
}

type SegmentProps = { geo: RingGeometry; angle: number; item: string; on: boolean; tint: Color; onTap: () => void; onHover: (on: boolean) => void }

function Segment({ geo, angle, item, on, tint, onTap, onHover }: SegmentProps) {
  const g = useRef<Group>(null)
  const fill = useRef<MeshBasicMaterial>(null)
  const halo = useRef<MeshBasicMaterial>(null)
  const st = useRef({ push: 0, pv: 0, near: 0, s: 1, sv: 0, glow: 0 })
  const Icon = ICONS[item.trim().toLowerCase() as keyof typeof ICONS] ?? Package
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const mid = (R_IN + R_OUT) / 2

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    s.pv += (380 * (Math.max(on ? 1 : 0, s.near) - s.push) - 20 * s.pv) * dt
    s.push += s.pv * dt
    s.sv += (420 * (1 - s.s) - 16 * s.sv) * dt
    s.s += s.sv * dt
    s.glow += ((on ? 1 : 0) - s.glow) * (1 - Math.exp(-dt * 10))
    if (g.current) {
      g.current.position.set(dx * PUSH * s.push, dy * PUSH * s.push, 0.008 * s.push)
      g.current.scale.setScalar(s.s)
    }
    if (fill.current) fill.current.color.lerpColors(SURFACE, NEAR, s.near).lerp(tint, s.glow)
    if (halo.current) halo.current.opacity = s.glow * 0.45
  })

  const near = (e: ThreeEvent<PointerEvent>) => {
    // Fingertips report distance: the segment leans out from 10 cm away. Rays and mice just hover.
    st.current.near = e.pointerType === "touch" ? Math.min(1, Math.max(0.35, 1.1 - e.distance * 9)) : 1
    onHover(true)
  }

  return (
    <group>
      <group ref={g}>
        <mesh geometry={geo} position={[0, 0, -0.001]} scale={1.07}>
          <meshBasicMaterial ref={halo} color={tint} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh geometry={geo}>
          <meshBasicMaterial ref={fill} color={SURFACE} toneMapped={false} />
        </mesh>
        <group position={[dx * mid, dy * mid, 0.002]}>
          <Container pixelSize={PX} pointerEvents="none">
            <Icon width={24} height={24} color={on ? "#06221B" : "#EEF0F4"} />
          </Container>
        </group>
      </group>
      {/* Static hit sector: the segment pushes out, the hit surface must not, or a poke could re-trigger. */}
      <mesh
        geometry={geo}
        visible={false}
        position={[0, 0, 0.01]}
        onPointerOver={near}
        onPointerMove={near}
        onPointerOut={() => {
          st.current.near = 0
          onHover(false)
        }}
        onClick={() => {
          st.current.sv += 3 // pop
          onTap()
        }}
      />
    </group>
  )
}
