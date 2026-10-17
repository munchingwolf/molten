"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Group } from "three"
import { Container, Text } from "@react-three/uikit"
import { ShoppingBag } from "@react-three/uikit-lucide"

type Props = {
  name?: string
  price?: string
  colors?: string[]
  /** Index of the chosen colour. */
  value?: number
  onChange?: (index: number) => void
  onPress?: () => void
  theme?: "light" | "dark"
  spin?: boolean
}

const THEMES = {
  light: { panel: "#FFFFFF", border: "#E4E6EC", ink: "#111218", muted: "#5B5F6D", plinth: "#ECEEF2", onInk: "#FFFFFF" },
  dark: { panel: "#121419", border: "#262A34", ink: "#F3F4F8", muted: "#9A9FAC", plinth: "#22252E", onInk: "#0B0C10" },
}
const DEFAULT_COLORS = ["#E8E4DC", "#2B2E36", "#7C9CFF", "#E9A27C"]

const matcaps = new Map<string, CanvasTexture>()
/** `color` mixed toward white (t > 0) or black (t < 0). */
function tone(color: string, t: number) {
  const n = parseInt(color.replace("#", "").padEnd(6, "0").slice(0, 6), 16)
  const to = t > 0 ? 255 : 0
  const ch = (v: number) => Math.round(v + (to - v) * Math.abs(t))
  return `rgb(${ch(n >> 16)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`
}
// Previews have no lights, so generated matcaps shade the product the same everywhere: soft fabric or satin plastic.
function shade(color: string, sheen: number) {
  const key = `${color}:${sheen}`
  let t = matcaps.get(key)
  if (t) return t
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const g = c.getContext("2d")!
  const base = g.createRadialGradient(50, 44, 4, 64, 64, 66)
  base.addColorStop(0, tone(color, 0.35))
  base.addColorStop(0.45, color)
  base.addColorStop(0.85, tone(color, -0.45))
  base.addColorStop(1, tone(color, -0.75))
  g.fillStyle = base
  g.fillRect(0, 0, 128, 128)
  const hi = g.createRadialGradient(40, 32, 0, 40, 32, 30)
  hi.addColorStop(0, `rgba(255,255,255,${sheen})`)
  hi.addColorStop(1, "rgba(255,255,255,0)")
  g.fillStyle = hi
  g.fillRect(0, 0, 128, 128)
  t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  matcaps.set(key, t)
  return t
}

let grille: CanvasTexture | undefined
/** Speaker-cloth dot grid, multiplied over the fabric matcap. */
function getGrille() {
  if (grille) return grille
  const c = document.createElement("canvas")
  c.width = c.height = 32
  const g = c.getContext("2d")!
  g.fillStyle = "#ffffff"
  g.fillRect(0, 0, 32, 32)
  g.fillStyle = "#b9bcc4"
  for (const [x, y] of [[8, 8], [24, 24]]) (g.beginPath(), g.arc(x, y, 3.2, 0, Math.PI * 2), g.fill())
  grille = new CanvasTexture(c)
  grille.wrapS = grille.wrapT = RepeatWrapping
  grille.repeat.set(28, 14)
  grille.colorSpace = SRGBColorSpace
  return grille
}

const easeOutBack = (x: number) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** Product turntable for a 3D store page: a smart speaker spins on a plinth; swatches recolour it (value/onChange), the button fires onPress.
 * Plinth and card rise in; the speaker drops onto the plinth with a bounce and pops each time its colour changes. */
export default function ProductShowcase({
  name = "Halo Speaker",
  price = "$249",
  colors = DEFAULT_COLORS,
  value,
  onChange,
  onPress,
  theme = "light",
  spin = true,
}: Props) {
  const t = THEMES[theme] ?? THEMES.light
  const [local, setLocal] = useState(0)
  const idx = Math.min(value ?? local, colors.length - 1)
  const color = colors[idx] ?? DEFAULT_COLORS[0]
  const fabric = useMemo(() => shade(color, 0.3), [color])
  const cloth = useMemo(getGrille, [])
  const cap = useMemo(() => shade("#1A1C22", 0.7), [])
  const plinth = useMemo(() => shade(t.plinth, 0.5), [t.plinth])
  const turn = useRef<Group>(null)
  const stage = useRef<Group>(null)
  const card = useRef<Group>(null)
  const m = useRef({ born: -1, pop: 0 })
  const [hover, setHover] = useState(false)
  useEffect(() => void (m.current.pop = 1), [idx])

  useFrame((state, dt) => {
    const s = m.current
    const now = state.clock.elapsedTime
    if (s.born < 0) s.born = now
    const age = now - s.born
    const a = easeOutBack(clamp01(age / 0.8))
    const b = easeOutBack(clamp01((age - 0.15) / 0.8))
    const drop = easeOutBack(clamp01((age - 0.3) / 0.7))
    s.pop = Math.max(0, s.pop - Math.min(dt, 0.05) * 3.5)
    if (stage.current) stage.current.position.set(-0.28, -0.2 + (1 - a) * -0.06, (1 - a) * -0.1)
    if (card.current) card.current.position.set(0.3, (1 - b) * -0.06, (1 - b) * -0.1)
    const g = turn.current
    if (g) {
      if (spin) g.rotation.y += Math.min(dt, 0.05) * (hover ? 0.15 : 0.6)
      g.position.y = 0.181 + (1 - drop) * 0.18 // capsule bottom sits on the plinth top
      // A damped wobble after a colour change: big, then settles in ~0.3 s.
      g.scale.setScalar(Math.max(0.001, drop) * (1 + 0.1 * Math.sin(s.pop * Math.PI) * s.pop))
    }
    state.invalidate()
  })

  return (
    <group>
      {/* Plinth and product, left of the info card. */}
      <group ref={stage} position={[-0.28, -0.2, 0]}>
        <mesh position={[0, -0.03, 0]}>
          <cylinderGeometry args={[0.2, 0.21, 0.06, 64]} />
          <meshMatcapMaterial matcap={plinth} />
        </mesh>
        {/* Contact shadow on the plinth top. */}
        <mesh position={[0, 0.001, 0]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.12, 48]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} />
        </mesh>
        <group ref={turn} position={[0, 0.181, 0]} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
          <mesh>
            <capsuleGeometry args={[0.1, 0.16, 12, 48]} />
            <meshMatcapMaterial matcap={fabric} map={cloth} />
          </mesh>
          <mesh position={[0, 0.175, 0]}>
            <cylinderGeometry args={[0.072, 0.072, 0.012, 48]} />
            <meshMatcapMaterial matcap={cap} />
          </mesh>
          {/* Status ring light on the top cap. */}
          <mesh position={[0, 0.182, 0]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.045, 0.052, 48]} />
            <meshBasicMaterial color="#9FE7D2" />
          </mesh>
        </group>
      </group>
      {/* Info card on the right. */}
      <group ref={card} position={[0.3, 0, 0]}>
        <Container
          pixelSize={0.002}
          width={250}
          flexDirection="column"
          gap={14}
          padding={24}
          borderRadius={22}
          backgroundColor={t.panel}
          borderWidth={1.5}
          borderColor={t.border}
        >
          <Text fontSize={13} fontWeight="medium" color={t.muted}>New arrival</Text>
          <Text fontSize={28} fontWeight="bold" color={t.ink} letterSpacing={-0.5}>{name}</Text>
          <Text fontSize={22} fontWeight="semi-bold" color={t.ink}>{price}</Text>
          <Container flexDirection="row" gap={10} marginTop={4}>
            {colors.map((c, i) => (
              <Container
                key={c + i}
                width={34}
                height={34}
                borderRadius={17}
                borderWidth={i === idx ? 2.5 : 1.5}
                borderColor={i === idx ? t.ink : t.border}
                alignItems="center"
                justifyContent="center"
                cursor="pointer"
                onClick={() => (setLocal(i), onChange?.(i))}
              >
                <Container width={24} height={24} borderRadius={12} backgroundColor={c} />
              </Container>
            ))}
          </Container>
          <Container
            flexDirection="row"
            gap={10}
            height={46}
            marginTop={6}
            borderRadius={13}
            alignItems="center"
            justifyContent="center"
            backgroundColor={t.ink}
            hover={{ backgroundColor: "#7C9CFF" }}
            cursor="pointer"
            onClick={() => onPress?.()}
          >
            <ShoppingBag width={18} height={18} color={t.onInk} />
            <Text fontSize={16} fontWeight="semi-bold" color={t.onInk}>Add to bag</Text>
          </Container>
        </Container>
      </group>
    </group>
  )
}
