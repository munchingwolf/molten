"use client"

import { useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { CanvasTexture, SRGBColorSpace, type Group, type MeshBasicMaterial } from "three"
import { Container, Text } from "@react-three/uikit"
import { ArrowRight } from "@react-three/uikit-lucide"

type Props = {
  eyebrow?: string
  headline?: string
  subline?: string
  cta?: string
  secondary?: string
  accent?: string
  theme?: "light" | "dark"
  onPress?: (which: "primary" | "secondary") => void
}

const W = 920 // px at pixelSize 0.002 -> 1.84 m
const H = 430
const THEMES = {
  light: { panel: "#FFFFFF", border: "#E4E6EC", ink: "#111218", muted: "#5B5F6D", chip: "#F1F2F6", onInk: "#FFFFFF" },
  dark: { panel: "#111318", border: "#262A34", ink: "#F3F4F8", muted: "#9A9FAC", chip: "#1B1E26", onInk: "#0B0C10" },
}

const matcaps = new Map<string, CanvasTexture>()
// Previews have no lights, so a generated glossy matcap shades the centrepiece the same everywhere.
function glossFor(accent: string) {
  let t = matcaps.get(accent)
  if (t) return t
  const c = document.createElement("canvas")
  c.width = c.height = 256
  const g = c.getContext("2d")!
  const base = g.createRadialGradient(128, 128, 10, 128, 128, 128)
  base.addColorStop(0, accent)
  base.addColorStop(0.7, accent)
  base.addColorStop(1, "#0A0B0F")
  g.fillStyle = base
  g.fillRect(0, 0, 256, 256)
  const spec = g.createRadialGradient(88, 70, 0, 88, 70, 70)
  spec.addColorStop(0, "rgba(255,255,255,0.95)")
  spec.addColorStop(1, "rgba(255,255,255,0)")
  g.fillStyle = spec
  g.fillRect(0, 0, 256, 256)
  const rim = g.createRadialGradient(128, 128, 96, 128, 128, 128)
  rim.addColorStop(0, "rgba(255,255,255,0)")
  rim.addColorStop(0.92, "rgba(190,215,255,0.35)")
  rim.addColorStop(1, "rgba(255,255,255,0)")
  g.fillStyle = rim
  g.fillRect(0, 0, 256, 256)
  t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  matcaps.set(accent, t)
  return t
}

const easeOutBack = (x: number) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** Landing-page hero: eyebrow, headline, subline and two calls to action, with a glossy knot floating off the panel.
 * The panel rises in, the knot springs in after it and keeps floating; the halo behind it breathes. */
export default function HeroSection({
  eyebrow = "New - Spatial 1.0",
  headline = "Build interfaces you can walk around",
  subline = "Drop in working 3D components, wire them up, and ship to the web and the headset in minutes.",
  cta = "Start building",
  secondary = "See examples",
  accent = "#7C9CFF",
  theme = "light",
  onPress,
}: Props) {
  const t = THEMES[theme] ?? THEMES.light
  const gloss = useMemo(() => glossFor(accent), [accent])
  const knot = useRef<Group>(null)
  const panel = useRef<Group>(null)
  const halo = useRef<MeshBasicMaterial>(null)
  const born = useRef(-1)
  const [hover, setHover] = useState(false)

  useFrame((state, dt) => {
    const now = state.clock.elapsedTime
    if (born.current < 0) born.current = now
    const age = now - born.current
    const pIn = easeOutBack(clamp01(age / 0.9))
    const kIn = easeOutBack(clamp01((age - 0.35) / 0.9))
    if (panel.current) {
      panel.current.position.set(0, (1 - pIn) * -0.08, (1 - pIn) * -0.12)
      panel.current.scale.setScalar(0.94 + 0.06 * pIn)
    }
    const k = knot.current
    if (k) {
      k.rotation.y += Math.min(dt, 0.05) * (hover ? 1.4 : 0.45)
      k.rotation.x = Math.sin(now * 0.6) * 0.25
      k.position.y = Math.sin(now * 1.1) * 0.025
      k.scale.setScalar(Math.max(0.001, kIn) * (hover ? 1.06 : 1))
    }
    if (halo.current) halo.current.opacity = (theme === "dark" ? 0.18 : 0.12) * (0.75 + 0.25 * Math.sin(now * 1.6)) * clamp01(age / 0.9)
    state.invalidate()
  })

  return (
    <group>
      <group ref={panel}>
      <Container
        pixelSize={0.002}
        width={W}
        height={H}
        flexDirection="row"
        padding={56}
        borderRadius={32}
        backgroundColor={t.panel}
        borderWidth={1.5}
        borderColor={t.border}
      >
        <Container width={480} flexDirection="column" justifyContent="center" gap={22}>
          <Container alignSelf="flex-start" paddingX={14} paddingY={7} borderRadius={999} backgroundColor={t.chip} flexDirection="row" gap={8} alignItems="center">
            <Container width={8} height={8} borderRadius={4} backgroundColor={accent} />
            <Text fontSize={14} fontWeight="medium" color={t.muted}>{eyebrow}</Text>
          </Container>
          <Text fontSize={54} fontWeight="bold" color={t.ink} letterSpacing={-1.2}>{headline}</Text>
          <Text fontSize={18} color={t.muted}>{subline}</Text>
          <Container flexDirection="row" gap={12} marginTop={8}>
            <Container
              flexDirection="row"
              alignItems="center"
              gap={10}
              paddingX={22}
              height={52}
              borderRadius={14}
              backgroundColor={t.ink}
              hover={{ backgroundColor: accent }}
              cursor="pointer"
              onClick={() => onPress?.("primary")}
            >
              <Text fontSize={17} fontWeight="semi-bold" color={t.onInk}>{cta}</Text>
              <ArrowRight width={18} height={18} color={t.onInk} />
            </Container>
            <Container
              alignItems="center"
              paddingX={22}
              height={52}
              borderRadius={14}
              borderWidth={1.5}
              borderColor={t.border}
              hover={{ backgroundColor: t.chip }}
              cursor="pointer"
              onClick={() => onPress?.("secondary")}
            >
              <Text fontSize={17} fontWeight="semi-bold" color={t.ink}>{secondary}</Text>
            </Container>
          </Container>
        </Container>
      </Container>
      </group>
      {/* Centrepiece floats 12 cm off the panel's empty right half. */}
      <group position={[0.46, 0, 0.14]} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
        <group ref={knot}>
          <mesh>
            <torusKnotGeometry args={[0.12, 0.04, 240, 36, 2, 3]} />
            <meshMatcapMaterial matcap={gloss} />
          </mesh>
        </group>
        <mesh position={[0, 0, -0.13]}>
          <circleGeometry args={[0.26, 64]} />
          <meshBasicMaterial ref={halo} color={accent} transparent opacity={0} />
        </mesh>
      </group>
    </group>
  )
}
