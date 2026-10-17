"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Shape, ShapeGeometry, type MeshBasicMaterial } from "three"
import { Container, Text, withOpacity } from "@react-three/uikit"
import { AppWindow, X } from "@react-three/uikit-lucide"

const PX = 0.002 // metres per uikit pixel

type Props = {
  title?: string
  /** uikit content (Text, Container, …) for the body. Sample content shows when empty. */
  children?: ReactNode
  /** Size in metres. */
  width?: number
  height?: number
  accent?: string
  /** Controlled visibility. Omit and the close button hides the window, leaving a "Reopen" chip. */
  open?: boolean
  onClose?: () => void
}

/** Floating window: title bar, close button, scrolling content area, and a soft halo 1 cm behind it that brightens on hover. */
export default function Window({ title = "Mixdown", children, width = 0.5, height = 0.34, accent = "#9FE7D2", open, onClose }: Props) {
  const [inner, setInner] = useState(true)
  const [hover, setHover] = useState(false)
  const shown = open ?? inner
  const p = useSpring(shown ? 1 : 0, 0)
  const closeTint = useMemo(() => withOpacity("#F2B48A", 0.16), [])

  const close = () => {
    if (open === undefined) setInner(false)
    setHover(false) // no pointerout arrives once it unmounts
    onClose?.()
  }

  return (
    <group>
      {p > 0.01 && (
        <group scale={0.9 + 0.1 * p} position={[0, (1 - p) * -0.03, 0]}>
          <Halo width={width + 0.02} height={height + 0.02} color={accent} strength={(hover ? 0.2 : 0.07) * Math.min(1, p)} />
          <Container
            pixelSize={PX}
            width={width / PX}
            height={height / PX}
            opacity={Math.min(1, Math.max(0, p))}
            flexDirection="column"
            borderRadius={18}
            backgroundColor="#15171E"
            borderWidth={1.5}
            borderColor="#323745"
            borderBend={0.4}
            overflow="hidden"
            onPointerOver={() => setHover(true)}
            onPointerOut={() => setHover(false)}
          >
            <Container
              height={44}
              flexShrink={0}
              flexDirection="row"
              alignItems="center"
              gap={10}
              paddingLeft={16}
              paddingRight={8}
              borderBottomWidth={1}
              borderColor="#242833"
            >
              <Container width={8} height={8} borderRadius={4} backgroundColor={accent} />
              <Text flexGrow={1} fontSize={14} fontWeight="semi-bold" color="#EEF0F4">
                {title}
              </Text>
              <Container
                width={30}
                height={30}
                borderRadius={9}
                alignItems="center"
                justifyContent="center"
                color="#9AA0AD"
                hover={{ backgroundColor: closeTint, color: "#F2B48A" }}
                active={{ transformScaleX: 0.9, transformScaleY: 0.9 }}
                onClick={close}
              >
                <X width={16} height={16} />
              </Container>
            </Container>
            <Container flexGrow={1} flexDirection="column" gap={10} padding={16} overflow="scroll" scrollbarWidth={4} scrollbarColor="#323745">
              {children ?? <Sample />}
            </Container>
          </Container>
        </group>
      )}
      {!shown && open === undefined && p < 0.3 && (
        <Container
          pixelSize={PX}
          flexDirection="row"
          alignItems="center"
          gap={8}
          height={36}
          paddingX={14}
          borderRadius={12}
          backgroundColor="#15171E"
          borderWidth={1.5}
          borderColor="#323745"
          color="#9AA0AD"
          hover={{ borderColor: accent, color: "#EEF0F4" }}
          onClick={() => setInner(true)}
        >
          <AppWindow width={16} height={16} />
          <Text fontSize={13}>{`Reopen ${title}`}</Text>
        </Container>
      )}
    </group>
  )
}

function Sample() {
  return (
    <>
      <Text fontSize={16} fontWeight="semi-bold" color="#EEF0F4">
        Bounce complete
      </Text>
      <Text fontSize={12} color="#9AA0AD" lineHeight="150%">
        Stereo mix rendered from 4 tracks. Give it a listen before you share it.
      </Text>
      {[
        ["Length", "3:42"],
        ["Format", "WAV · 48 kHz"],
        ["Size", "41 MB"],
      ].map(([k, v]) => (
        <Container
          key={k}
          flexDirection="row"
          justifyContent="space-between"
          paddingX={12}
          paddingY={8}
          borderRadius={9}
          borderWidth={1}
          borderColor="#242833"
          backgroundColor="#101218"
        >
          <Text fontSize={12} color="#9AA0AD">
            {k}
          </Text>
          <Text fontSize={12} color="#EEF0F4">
            {v}
          </Text>
        </Container>
      ))}
    </>
  )
}

/** Rounded plate 1 cm behind the panel: depth in the headset, glow on hover. Ignores rays. */
function Halo({ width, height, color, strength }: { width: number; height: number; color: string; strength: number }) {
  const geometry = useMemo(() => roundedRect(width, height, 0.045), [width, height])
  const mat = useRef<MeshBasicMaterial>(null)
  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame((state, dt) => {
    const m = mat.current
    if (!m || Math.abs(m.opacity - strength) < 0.002) return
    m.opacity += (strength - m.opacity) * Math.min(1, dt * 10)
    state.invalidate()
  })
  return (
    <mesh geometry={geometry} position={[0, 0, -0.01]} raycast={() => null}>
      <meshBasicMaterial ref={mat} color={color} transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

function roundedRect(w: number, h: number, r: number) {
  const s = new Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return new ShapeGeometry(s, 8)
}

/** Damped spring toward `target` (slight overshoot); re-renders only while it moves. */
function useSpring(target: number, from = target) {
  const s = useRef({ x: from, v: 0 })
  const [, tick] = useState(0)
  const invalidate = useThree((st) => st.invalidate)
  useEffect(() => invalidate(), [target, invalidate])
  useFrame((state, dt) => {
    const k = s.current
    if (k.x === target && k.v === 0) return
    const d = Math.min(dt, 1 / 30)
    k.v += ((target - k.x) * 170 - k.v * 18) * d
    k.x += k.v * d
    if (Math.abs(target - k.x) < 1e-3 && Math.abs(k.v) < 1e-2) {
      k.x = target
      k.v = 0
    }
    tick((t) => t + 1)
    state.invalidate()
  })
  return s.current.x
}
