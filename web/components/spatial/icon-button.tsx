"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import {
  Bell, Camera, Check, ChevronLeft, ChevronRight, Heart, House, Lock, Mic, MicOff, Moon, Music, Pause, Play, Plus, Power,
  RotateCcw, Search, Settings, Share2, SkipBack, SkipForward, Square, Star, Sun, Trash2, Volume2, VolumeX, X,
} from "@react-three/uikit-lucide"
import { Color, LatheGeometry, Vector2, type Group, type MeshBasicMaterial } from "three"

// Curated set (importing every lucide icon would add ~1 MB); add a line here to support another one.
const ICONS = {
  play: Play, pause: Pause, stop: Square, next: SkipForward, previous: SkipBack, plus: Plus, close: X, check: Check,
  heart: Heart, star: Star, settings: Settings, home: House, mic: Mic, "mic-off": MicOff, volume: Volume2, mute: VolumeX,
  camera: Camera, trash: Trash2, search: Search, bell: Bell, share: Share2, back: ChevronLeft, forward: ChevronRight,
  undo: RotateCcw, power: Power, music: Music, sun: Sun, moon: Moon, lock: Lock,
}
export type IconName = keyof typeof ICONS

type Props = { icon?: IconName; label?: string; color?: string; size?: number; onPress?: () => void }

const S = 0.064 // 6.4 cm round key
const D = 0.02

// Disc with a rounded rim, facing +z (lathe profile runs bottom → top so normals face out).
function puck(r: number, d: number, b: number) {
  const pts = [new Vector2(0, -d / 2)]
  const arc = (y: number, from: number) => {
    for (let i = 0; i <= 6; i++) {
      const a = from + (i / 6) * (Math.PI / 2)
      pts.push(new Vector2(r - b + b * Math.cos(a), y + b * Math.sin(a)))
    }
  }
  arc(-d / 2 + b, -Math.PI / 2) // bottom rim
  arc(d / 2 - b, 0) // top rim
  pts.push(new Vector2(0, d / 2))
  return new LatheGeometry(pts, 64).rotateX(Math.PI / 2)
}

/** 6.4 cm round key with a lucide icon (`icon` by name). Ring lights up as you approach, key sinks on press. */
export default function IconButton({ icon = "play", label, color = "#9FE7D2", size = 1, onPress }: Props) {
  const Icon = ICONS[icon] ?? Play
  const key = useRef<Group>(null)
  const ring = useRef<MeshBasicMaterial>(null)
  const [hot, setHot] = useState(false)
  const st = useRef({ glow: 0, target: 0, z: 0, zv: 0, down: false, flash: 0 })
  const geometry = useMemo(() => puck(S / 2, D, 0.006), [])
  const accent = useMemo(() => new Color(color), [color])
  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    s.flash = Math.max(0, s.flash - dt * 3)
    s.glow += (Math.max(s.target, s.flash) - s.glow) * (1 - Math.exp(-dt * 12))
    if (ring.current) ring.current.opacity = 0.12 + s.glow * 0.7
    s.zv += (420 * ((s.down ? -0.007 : 0) - s.z) - 22 * s.zv) * dt
    s.z += s.zv * dt
    if (key.current) key.current.position.z = s.z
  })

  const near = (e: ThreeEvent<PointerEvent>) => {
    st.current.target = e.pointerType === "touch" ? Math.min(1, Math.max(0.3, 1.1 - e.distance * 9)) : 0.8
    setHot(true)
  }
  const down = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    st.current.down = true
  }
  const up = () => {
    st.current.down = false
  }

  return (
    <group scale={size}>
      <mesh position={[0, 0, -D / 2 - 0.001]}>
        <ringGeometry args={[S / 2 + 0.003, S / 2 + 0.007, 64]} />
        <meshBasicMaterial ref={ring} color={accent} transparent opacity={0.12} depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={key}>
        <mesh geometry={geometry}>
          <meshStandardMaterial color="#1B1E26" emissive="#15171E" roughness={0.45} metalness={0.2} />
        </mesh>
        <group position={[0, 0, D / 2 + 0.001]}>
          <Container pixelSize={0.002} pointerEvents="none">
            <Icon width={14} height={14} color={hot ? color : "#EEF0F4"} />
          </Container>
        </group>
      </group>
      {label ? (
        <group position={[0, -S / 2 - 0.016, 0]}>
          <Container pixelSize={0.002} pointerEvents="none">
            <Text fontSize={10} color="#9AA0AD">
              {label}
            </Text>
          </Container>
        </group>
      ) : null}
      <mesh
        visible={false}
        position={[0, 0, 0.002]}
        onPointerOver={near}
        onPointerMove={near}
        onPointerOut={() => {
          st.current.target = 0
          setHot(false)
          up()
        }}
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={() => {
          st.current.flash = 1.2
          onPress?.()
        }}
      >
        <boxGeometry args={[S, S, D + 0.004]} />
      </mesh>
    </group>
  )
}
