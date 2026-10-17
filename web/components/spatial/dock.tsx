"use client"

import { useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Vector3, type Group } from "three"
import { Container, Text } from "@react-three/uikit"
import { Bell, Calendar, Camera, Folder, Globe, Headphones, House, Image, Mail, MessageSquare, Mic, Music, Search, Settings, Star, User } from "@react-three/uikit-lucide"

const PX = 0.002 // metres per uikit pixel
const SIZE = 32 // icon tile, px (6.4 cm)
const GAP = 8
const PAD = 12

type Icon = typeof House
// Labels pick an icon by name; anything else shows its first letter.
const ICONS: Record<string, Icon> = {
  home: House, music: Music, camera: Camera, photos: Image, photo: Image, gallery: Image, mail: Mail, messages: MessageSquare, chat: MessageSquare,
  settings: Settings, search: Search, files: Folder, folder: Folder, calendar: Calendar, browser: Globe, web: Globe, audio: Headphones,
  podcasts: Headphones, voice: Mic, mic: Mic, favorites: Star, profile: User, notifications: Bell,
}

type Props = {
  /** App labels, as an array or a comma-separated string. */
  items?: string[] | string
  onSelect?: (item: string) => void
  accent?: string
  /** How big the icon under your pointer grows (1 = no magnify). */
  magnify?: number
}

const local = new Vector3()

/** Dock: a shelf of app icons that swell toward you under the pointer and bounce when picked. */
export default function Dock({ items = ["Home", "Music", "Camera", "Photos", "Settings"], onSelect, accent = "#9FE7D2", magnify = 1.7 }: Props) {
  const list = (typeof items === "string" ? items.split(",") : items).map((s) => s.trim()).filter(Boolean)
  const n = list.length
  const [active, setActive] = useState(0)
  const [near, setNear] = useState<number | null>(null)
  const root = useRef<Group>(null)
  const shelf = useRef<Group>(null)
  const label = useRef<Group>(null)
  const nodes = useRef<(Group | null)[]>([])
  const anim = useRef<{ s: number; b: number; bv: number }[]>([])
  const pointer = useRef<number | null>(null) // local x of the pointer, metres

  const S = SIZE * PX
  const G = GAP * PX
  const base = n * S + (n - 1) * G

  useFrame((state, dt) => {
    const d = Math.min(dt, 1 / 30)
    const px = pointer.current
    const sigma = (S + G) * 1.1
    let moving = false
    let total = -G
    let best = -1
    let bestS = 1.02
    for (let i = 0; i < n; i++) {
      const a = (anim.current[i] ??= { s: 1, b: 0, bv: 0 })
      const c = (i - (n - 1) / 2) * (S + G)
      const t = px === null ? 1 : 1 + (Math.max(1, magnify) - 1) * Math.exp(-((c - px) ** 2) / (2 * sigma * sigma))
      a.s += (t - a.s) * Math.min(1, d * 14)
      a.bv += (-a.b * 260 - a.bv * 7) * d // bounce: springy, shown as |b| so it hops like a ball
      a.b += a.bv * d
      if (Math.abs(t - a.s) > 1e-3 || Math.abs(a.b) > 1e-4 || Math.abs(a.bv) > 1e-3) moving = true
      if (a.s > bestS) {
        bestS = a.s
        best = i
      }
      total += S * a.s + G
    }
    let x = -total / 2
    for (let i = 0; i < n; i++) {
      const a = anim.current[i]
      const w = S * a.s
      const g = nodes.current[i]
      // Bottom-aligned growth, and magnified icons come toward you.
      if (g) {
        g.position.set(x + w / 2, (w - S) / 2 + Math.abs(a.b), (a.s - 1) * 0.03)
        g.scale.setScalar(a.s)
      }
      if (i === best && label.current) label.current.position.set(x + w / 2, S / 2 + (w - S) + 0.024 + Math.abs(a.b), 0.02)
      x += w + G
    }
    if (shelf.current) shelf.current.scale.x = (total + 2 * PAD * PX) / (base + 2 * PAD * PX)
    const nb = best < 0 ? null : best
    if (nb !== near) setNear(nb)
    if (moving) state.invalidate()
  })

  const move = (e: ThreeEvent<PointerEvent>) => {
    if (!root.current) return
    pointer.current = root.current.worldToLocal(local.copy(e.point)).x
  }
  const leave = () => {
    pointer.current = null
  }
  const select = (i: number) => {
    setActive(i)
    const a = anim.current[i]
    if (a) a.bv = 1.1
    onSelect?.(list[i])
  }

  return (
    <group ref={root} onPointerMove={move} onPointerOut={leave}>
      <group ref={shelf} position={[0, 0, -0.006]}>
        <Container
          pixelSize={PX}
          width={base / PX + PAD * 2}
          height={SIZE + PAD * 2}
          borderRadius={18}
          backgroundColor="#15171E"
          borderWidth={1.5}
          borderColor="#323745"
          borderBend={0.4}
        />
      </group>
      {list.map((name, i) => {
        const Glyph = ICONS[name.toLowerCase()]
        return (
          <group
            key={`${i}-${name}`}
            position={[(i - (n - 1) / 2) * (S + G), 0, 0]}
            ref={(g) => {
              nodes.current[i] = g
            }}
          >
            <Container
              pixelSize={PX}
              width={SIZE}
              height={SIZE}
              borderRadius={10}
              alignItems="center"
              justifyContent="center"
              backgroundColor={i === active ? "#20242E" : "#1B1E26"}
              borderWidth={1.5}
              borderColor={i === active ? accent : "#323745"}
              color={i === active ? accent : "#EEF0F4"}
              hover={{ backgroundColor: accent, borderColor: accent, color: "#06221B" }}
              active={{ transformScaleX: 0.9, transformScaleY: 0.9 }}
              onClick={() => select(i)}
            >
              {Glyph ? (
                <Glyph width={16} height={16} />
              ) : (
                <Text fontSize={13} fontWeight="semi-bold">
                  {name.slice(0, 1).toUpperCase()}
                </Text>
              )}
              {i === active && <Container positionType="absolute" positionTop={SIZE + 3} width={4} height={4} borderRadius={2} backgroundColor={accent} />}
            </Container>
          </group>
        )
      })}
      <group ref={label} visible={near !== null}>
        <Container pixelSize={PX} anchorY="bottom" pointerEvents="none" paddingX={8} paddingY={4} borderRadius={7} backgroundColor="#1B1E26" borderWidth={1} borderColor="#323745">
          <Text fontSize={11} color="#EEF0F4">
            {near !== null ? list[near] ?? "" : ""}
          </Text>
        </Container>
      </group>
    </group>
  )
}
