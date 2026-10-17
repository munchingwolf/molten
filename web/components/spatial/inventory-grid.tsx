"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { Apple, Axe, Bomb, BowArrow, Coins, FlaskConical, Gem, Key, MapIcon, Package, Shield, Sword, WandSparkles } from "@react-three/uikit-lucide"
import { AdditiveBlending, BoxGeometry, CanvasTexture, Color, PlaneGeometry, type Group, type MeshBasicMaterial } from "three"
import * as Tone from "tone"

const ICONS = { sword: Sword, shield: Shield, potion: FlaskConical, key: Key, gem: Gem, bow: BowArrow, map: MapIcon, coin: Coins, apple: Apple, bomb: Bomb, wand: WandSparkles, axe: Axe }
const DEFAULT_ITEMS = ["sword", "shield", "potion", "key", "gem", "bow"]

const PX = 0.002 // metres per uikit pixel
const SLOT = 48 // px: 9.6 cm, fingertip-sized
const GAP = 8
const PAD = 14
const HEAD = 30
const FOOT = 34

type Props = {
  /** Item names: sword, shield, potion, key, gem, bow, map, coin, apple, bomb, wand, axe. Slots past the list stay empty. */
  items?: string[]
  cols?: number
  rows?: number
  /** Equipped slot index, -1 for none. Omit to let the grid manage it. */
  value?: number
  color?: string
  onChange?: (index: number) => void
}

type Sfx = { bell: Tone.PolySynth<Tone.FMSynth>; tick: Tone.Synth; air: Tone.NoiseSynth; hp: Tone.Filter }

// Soft rounded-square glow, drawn once and tinted by the material colour.
function glowTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 256
  const g = c.getContext("2d")!
  g.shadowColor = "white"
  g.shadowBlur = 36
  g.fillStyle = "white"
  g.beginPath()
  g.roundRect(64, 64, 128, 128, 30)
  g.fill()
  return new CanvasTexture(c)
}

const iconFor = (name: string) => ICONS[name.trim().toLowerCase() as keyof typeof ICONS] ?? Package
const title = (s: string) => s.trim().charAt(0).toUpperCase() + s.trim().slice(1)

/** 49 × 39 cm game inventory: tap a slot to equip its item (spring pop, mint glow ring, "shing"). */
export default function InventoryGrid({ items = DEFAULT_ITEMS, cols = 4, rows = 2, value, color = "#9FE7D2", onChange }: Props) {
  const c = Math.max(1, Math.round(cols))
  const r = Math.max(1, Math.round(rows))
  const n = c * r
  const [inner, setInner] = useState(-1)
  const v = value ?? inner
  const equipped = v >= 0 && v < n ? items[v] : undefined
  const gridW = c * SLOT + (c - 1) * GAP
  const gridH = r * SLOT + (r - 1) * GAP
  const W = gridW + PAD * 2
  const H = PAD * 2 + HEAD + gridH + FOOT

  const texture = useMemo(() => (typeof document === "undefined" ? null : glowTexture()), [])
  const hitGeo = useMemo(() => new BoxGeometry(SLOT * PX, SLOT * PX, 0.012), [])
  const haloGeo = useMemo(() => new PlaneGeometry(SLOT * PX * 2, SLOT * PX * 2), [])
  // Equipped slots get an opaque mint-tinted fill (opaque so the glow behind stays a rim).
  const fill = useMemo(() => new Color("#15171E").lerp(new Color(color), 0.14), [color])
  const sfx = useRef<Sfx | null>(null)
  useEffect(
    () => () => {
      texture?.dispose()
      hitGeo.dispose()
      haloGeo.dispose()
      const s = sfx.current
      if (s) [s.bell, s.tick, s.air, s.hp].forEach((x) => x.dispose())
    },
    [texture, hitGeo, haloGeo],
  )

  async function play(equip: boolean) {
    await Tone.start()
    sfx.current ??= (() => {
      const hp = new Tone.Filter(6000, "highpass").toDestination()
      return {
        hp,
        air: new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.004, decay: 0.12, sustain: 0 }, volume: -18 }).connect(hp),
        bell: new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 3.01,
          modulationIndex: 10,
          envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.4 },
          modulationEnvelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.2 },
          volume: -16,
        }).toDestination(),
        tick: new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.03 }, volume: -16 }).toDestination(),
      }
    })()
    const s = sfx.current
    const t = Tone.now()
    if (equip) {
      s.air.triggerAttackRelease(0.1, t)
      s.bell.triggerAttackRelease(["E6", "B6"], 0.3, t + 0.02)
    } else s.tick.triggerAttackRelease("G5", 0.03, t)
  }

  const tap = (i: number) => {
    if (!items[i]) return void play(false) // empty slot: just a soft tick
    const next = i === v ? -1 : i // tapping the equipped item unequips it
    if (value === undefined) setInner(next)
    onChange?.(next)
    void play(next >= 0)
  }

  return (
    <group>
      <Container
        pixelSize={PX}
        width={W}
        height={H}
        padding={PAD}
        flexDirection="column"
        borderRadius={16}
        backgroundColor="#15171E"
        borderWidth={1.5}
        borderColor="#242833"
        borderBend={0.3}
        pointerEvents="none"
      >
        <Container height={HEAD} flexShrink={0} flexDirection="row" justifyContent="space-between" alignItems="flex-start">
          <Text fontSize={13} fontWeight="semi-bold" color="#EEF0F4">
            Inventory
          </Text>
          <Text fontSize={11} color="#6B7180">{`${Math.min(items.length, n)}/${n}`}</Text>
        </Container>
        <Container height={gridH} flexShrink={0} />
        <Container height={FOOT} flexShrink={0} flexDirection="row" alignItems="flex-end" gap={8} borderTopWidth={1} borderColor="#242833">
          <Text fontSize={11} color="#6B7180">
            Equipped
          </Text>
          <Text fontSize={13} fontWeight="semi-bold" color={equipped ? color : "#9AA0AD"}>
            {equipped ? title(equipped) : "Nothing"}
          </Text>
        </Container>
      </Container>
      {Array.from({ length: n }, (_, i) => (
        <Slot
          key={i}
          x={(PAD + (i % c) * (SLOT + GAP) + SLOT / 2 - W / 2) * PX}
          y={(H / 2 - PAD - HEAD - Math.floor(i / c) * (SLOT + GAP) - SLOT / 2) * PX}
          item={items[i]}
          on={i === v}
          color={color}
          fill={fill}
          texture={texture}
          hitGeo={hitGeo}
          haloGeo={haloGeo}
          onTap={() => tap(i)}
        />
      ))}
    </group>
  )
}

type SlotProps = {
  x: number
  y: number
  item?: string
  on: boolean
  color: string
  fill: Color
  texture: CanvasTexture | null
  hitGeo: BoxGeometry
  haloGeo: PlaneGeometry
  onTap: () => void
}

function Slot({ x, y, item, on, color, fill, texture, hitGeo, haloGeo, onTap }: SlotProps) {
  const body = useRef<Group>(null)
  const halo = useRef<MeshBasicMaterial>(null)
  const st = useRef({ s: 1, v: 0, r: 0, rv: 0, glow: 0, hover: false, down: false })
  const Icon = item ? iconFor(item) : null

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    s.v += (420 * ((s.down ? 0.92 : s.hover ? 1.06 : 1) - s.s) - 18 * s.v) * dt
    s.s += s.v * dt
    s.rv += (300 * -s.r - 12 * s.rv) * dt // wobble back to upright
    s.r += s.rv * dt
    s.glow += ((on ? 1 : s.hover ? 0.3 : 0) - s.glow) * (1 - Math.exp(-dt * 10))
    if (body.current) {
      body.current.scale.setScalar(s.s)
      body.current.rotation.z = s.r
    }
    if (halo.current) halo.current.opacity = s.glow
  })

  const release = () => {
    st.current.down = false
  }

  return (
    <group position={[x, y, 0.004]}>
      <mesh geometry={haloGeo} position={[0, 0, -0.002]}>
        <meshBasicMaterial ref={halo} map={texture} color={color} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={body}>
        <Container
          pixelSize={PX}
          width={SLOT}
          height={SLOT}
          borderRadius={12}
          alignItems="center"
          justifyContent="center"
          backgroundColor={on ? fill : item ? "#1B1E27" : "#101218"}
          borderWidth={on ? 2 : 1.5}
          borderColor={on ? color : item ? "#323745" : "#242833"}
          pointerEvents="none"
        >
          {Icon && <Icon width={26} height={26} color={on ? color : "#EEF0F4"} />}
        </Container>
      </group>
      {/* Static hit box: the slot scales on press, the hit surface must not, or a poke could re-trigger. */}
      <mesh
        geometry={hitGeo}
        visible={false}
        position={[0, 0, 0.004]}
        onPointerOver={() => (st.current.hover = true)}
        onPointerOut={() => {
          st.current.hover = false
          release()
        }}
        onPointerDown={() => (st.current.down = true)}
        onPointerUp={release}
        onPointerCancel={release}
        onClick={() => {
          const s = st.current
          s.v += item ? 7 : 3 // pop
          if (item && !on) s.rv += 5 // equip "shing" wobble
          onTap()
        }}
      />
    </group>
  )
}
