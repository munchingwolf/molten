"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useFrame } from "@react-three/fiber"
import { ExtrudeGeometry, Shape, type Group } from "three"
import { Container, Text, withOpacity } from "@react-three/uikit"
import { Disc3, RotateCcw, Sparkles } from "@react-three/uikit-lucide"

const PX = 0.002 // metres per uikit pixel
const DEPTH = 0.006 // card thickness, metres

type Props = {
  title?: string
  subtitle?: string
  backTitle?: string
  backText?: string
  /** Custom uikit content for either face (replaces the sample layout). */
  front?: ReactNode
  back?: ReactNode
  /** Which face shows. Omit to let presses flip it. */
  flipped?: boolean
  onChange?: (flipped: boolean) => void
  accent?: string
  /** Size in metres. */
  width?: number
  height?: number
}

/** A 6 mm thick card that flips over (with a little lift) when you poke, pinch or click it. */
export default function FlipCard({
  title = "Neon Drift",
  subtitle = "Synth preset · 124 BPM",
  backTitle = "About this preset",
  backText = "Detuned saws through a slow filter sweep. Sits best under a four-on-the-floor kick.",
  front,
  back,
  flipped,
  onChange,
  accent = "#9FE7D2",
  width = 0.32,
  height = 0.44,
}: Props) {
  const [inner, setInner] = useState(false)
  const [hover, setHover] = useState(false)
  const isBack = flipped ?? inner
  const pivot = useRef<Group>(null)
  const s = useRef({ x: 0, v: 0, lift: 0 })
  const body = useMemo(() => slab(width - 0.004, height - 0.004, 0.034, DEPTH), [width, height])
  const tint = useMemo(() => withOpacity(accent, 0.14), [accent])
  useEffect(() => () => body.dispose(), [body])

  useFrame((state, dt) => {
    const g = pivot.current
    if (!g) return
    const k = s.current
    const target = isBack ? Math.PI : 0
    const d = Math.min(dt, 1 / 30)
    k.v += ((target - k.x) * 120 - k.v * 14) * d
    k.x += k.v * d
    k.lift += ((hover ? 0.012 : 0) - k.lift) * Math.min(1, d * 12)
    const moving = Math.abs(target - k.x) > 1e-4 || Math.abs(k.v) > 1e-3 || Math.abs((hover ? 0.012 : 0) - k.lift) > 1e-4
    g.rotation.y = k.x
    // Lifts toward you mid-flip, so the card clears whatever is behind it.
    g.position.z = Math.abs(Math.sin(k.x)) * 0.05 + k.lift
    if (moving) state.invalidate()
  })

  const toggle = () => {
    if (flipped === undefined) setInner(!isBack)
    onChange?.(!isBack)
  }

  const face = { pixelSize: PX, width: width / PX, height: height / PX, borderRadius: 18, backgroundColor: "#15171E", borderWidth: 1.5, borderColor: hover ? accent : "#323745", borderBend: 0.5, flexDirection: "column", padding: 18 } as const

  return (
    <group ref={pivot} onClick={toggle} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
      <mesh geometry={body}>
        <meshBasicMaterial color="#101218" toneMapped={false} />
      </mesh>
      <group position={[0, 0, DEPTH / 2 + 0.0005]}>
        <Container {...face} justifyContent="space-between">
          {front ?? (
            <>
              <Container flexDirection="row" justifyContent="space-between" alignItems="center">
                <Text fontSize={10} fontWeight="semi-bold" letterSpacing={1.5} color="#6B7180">
                  PRESET
                </Text>
                <Sparkles width={16} height={16} color={accent} />
              </Container>
              <Container alignSelf="center" width={92} height={92} borderRadius={46} backgroundColor={tint} alignItems="center" justifyContent="center">
                <Disc3 width={44} height={44} color={accent} />
              </Container>
              <Container flexDirection="column" gap={4}>
                <Text fontSize={20} fontWeight="bold" color="#EEF0F4">
                  {title}
                </Text>
                <Text fontSize={12} color="#9AA0AD">
                  {subtitle}
                </Text>
                <Hint label="Tap to flip" />
              </Container>
            </>
          )}
        </Container>
      </group>
      <group position={[0, 0, -DEPTH / 2 - 0.0005]} rotation={[0, Math.PI, 0]}>
        <Container {...face} gap={10}>
          {back ?? (
            <>
              <Text fontSize={15} fontWeight="semi-bold" color="#EEF0F4">
                {backTitle}
              </Text>
              <Text fontSize={12} color="#9AA0AD" lineHeight="150%">
                {backText}
              </Text>
              <Container flexDirection="column" gap={6} marginTop={4}>
                {[
                  ["Key", "F minor"],
                  ["Voices", "8"],
                  ["Author", "Spatial"],
                ].map(([k, v]) => (
                  <Container key={k} flexDirection="row" justifyContent="space-between" paddingX={10} paddingY={6} borderRadius={8} backgroundColor="#101218">
                    <Text fontSize={11} color="#9AA0AD">
                      {k}
                    </Text>
                    <Text fontSize={11} color="#EEF0F4">
                      {v}
                    </Text>
                  </Container>
                ))}
              </Container>
              <Container flexGrow={1} />
              <Hint label="Tap to flip back" />
            </>
          )}
        </Container>
      </group>
    </group>
  )
}

function Hint({ label }: { label: string }) {
  return (
    <Container flexDirection="row" alignItems="center" gap={6} marginTop={8} color="#6B7180">
      <RotateCcw width={12} height={12} />
      <Text fontSize={11}>{label}</Text>
    </Container>
  )
}

/** Rounded slab centred on the origin, `d` thick along z. */
function slab(w: number, h: number, r: number, d: number) {
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
  const g = new ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 8 })
  g.translate(0, 0, -d / 2)
  return g
}
