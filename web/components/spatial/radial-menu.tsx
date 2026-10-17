"use client"

import { useEffect, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import type { Group, Mesh } from "three"
import { Container, Text } from "@react-three/uikit"
import { Brush, Camera, Copy, Eraser, Image, Layers, Mail, Mic, Music, Palette, Pencil, Plus, Scissors, Search, Settings, Share2, Trash2, Type, Undo2, X } from "@react-three/uikit-lucide"

const PX = 0.002 // metres per uikit pixel

type Icon = typeof Pencil
// Labels pick an icon by name; anything else shows its first letter.
const ICONS: Record<string, Icon> = {
  draw: Pencil, pencil: Pencil, edit: Pencil, copy: Copy, duplicate: Copy, layers: Layers, share: Share2, delete: Trash2, trash: Trash2,
  color: Palette, colour: Palette, paint: Brush, brush: Brush, erase: Eraser, eraser: Eraser, cut: Scissors, text: Type, undo: Undo2,
  settings: Settings, music: Music, camera: Camera, photo: Image, photos: Image, image: Image, mail: Mail, search: Search, mic: Mic, voice: Mic,
}

type Props = {
  /** Option labels, as an array or a comma-separated string. */
  items?: string[] | string
  onSelect?: (item: string) => void
  accent?: string
  /** Ring radius in metres. */
  radius?: number
  /** Start with the ring fanned out. */
  defaultOpen?: boolean
}

/** Radial menu: press (or pinch) the hub and options spring out on a ring around it. */
export default function RadialMenu({ items = ["Draw", "Copy", "Layers", "Share", "Delete"], onSelect, accent = "#9FE7D2", radius = 0.13, defaultOpen = true }: Props) {
  const list = (typeof items === "string" ? items.split(",") : items).map((s) => s.trim()).filter(Boolean)
  const n = list.length
  const [open, setOpen] = useState(defaultOpen)
  const [mounted, setMounted] = useState(defaultOpen)
  const [picked, setPicked] = useState<string | null>(null)
  const nodes = useRef<(Group | null)[]>([])
  const ring = useRef<Mesh>(null)
  const springs = useRef<{ x: number; v: number }[]>([])
  const openedAt = useRef(0)
  const invalidate = useThree((s) => s.invalidate)
  const clock = useThree((s) => s.clock)
  useEffect(() => invalidate(), [open, invalidate])

  useFrame((state, dt) => {
    const now = state.clock.elapsedTime
    const d = Math.min(dt, 1 / 30)
    let moving = false
    let sum = 0
    for (let i = 0; i < n; i++) {
      const k = (springs.current[i] ??= { x: 0, v: 0 })
      const target = open && now - openedAt.current > i * 0.035 ? 1 : 0 // stagger the fan-out
      k.v += ((target - k.x) * 220 - k.v * 20) * d
      k.x += k.v * d
      if (Math.abs(target - k.x) > 1e-3 || Math.abs(k.v) > 1e-2) moving = true
      sum += Math.max(0, k.x)
      const g = nodes.current[i]
      if (!g) continue
      const a = Math.PI / 2 - (i / n) * Math.PI * 2 // first option at 12 o'clock, then clockwise
      const r = radius * k.x
      g.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.006 * k.x)
      g.scale.setScalar(Math.max(0.001, k.x))
    }
    const t = n ? sum / n : 0
    if (ring.current) {
      ring.current.scale.setScalar(Math.max(0.001, t))
      ring.current.visible = t > 0.01
    }
    if (moving || (open && now - openedAt.current < n * 0.035)) state.invalidate()
    else if (!open && mounted) setMounted(false) // unmount so hidden options can't catch rays
  })

  const toggle = () => {
    if (!open) {
      openedAt.current = clock.elapsedTime
      setMounted(true)
    }
    setOpen(!open)
  }

  const select = (label: string) => {
    setPicked(label)
    setOpen(false)
    onSelect?.(label)
  }

  return (
    <group>
      <mesh ref={ring} raycast={() => null}>
        <ringGeometry args={[radius - 0.0008, radius + 0.0008, 128]} />
        <meshBasicMaterial color={accent} transparent opacity={0.35} toneMapped={false} />
      </mesh>
      {mounted &&
        list.map((label, i) => {
          const Glyph = ICONS[label.toLowerCase()]
          return (
            <group
              key={`${i}-${label}`}
              scale={0.001}
              ref={(g) => {
                nodes.current[i] = g
              }}
            >
              <Container
                pixelSize={PX}
                width={40}
                height={40}
                borderRadius={20}
                alignItems="center"
                justifyContent="center"
                backgroundColor="#15171E"
                borderWidth={1.5}
                borderColor="#323745"
                color="#EEF0F4"
                hover={{ backgroundColor: accent, borderColor: accent, color: "#06221B", transformTranslateZ: 4 }}
                active={{ transformScaleX: 0.9, transformScaleY: 0.9 }}
                onClick={() => select(label)}
              >
                {Glyph ? (
                  <Glyph width={18} height={18} />
                ) : (
                  <Text fontSize={15} fontWeight="semi-bold">
                    {label.slice(0, 1).toUpperCase()}
                  </Text>
                )}
                <Text positionType="absolute" positionTop={44} fontSize={10} color="#9AA0AD">
                  {label}
                </Text>
              </Container>
            </group>
          )
        })}
      <Container
        pixelSize={PX}
        width={52}
        height={52}
        borderRadius={26}
        alignItems="center"
        justifyContent="center"
        backgroundColor={open ? accent : "#15171E"}
        borderWidth={2}
        borderColor={accent}
        color={open ? "#06221B" : accent}
        hover={{ transformTranslateZ: 3 }}
        active={{ transformScaleX: 0.9, transformScaleY: 0.9 }}
        onClick={toggle}
      >
        {open ? <X width={22} height={22} /> : <Plus width={22} height={22} />}
        <Text positionType="absolute" positionTop={58} fontSize={11} fontWeight="medium" color={picked ? accent : "#6B7180"}>
          {picked ?? "Menu"}
        </Text>
      </Container>
    </group>
  )
}
