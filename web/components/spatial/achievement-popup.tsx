"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { Crown, Medal, Star, Trophy } from "@react-three/uikit-lucide"
import * as Tone from "tone"
import { AdditiveBlending, CanvasTexture, Color, CylinderGeometry, type Group, type MeshBasicMaterial } from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

const ICONS = { trophy: Trophy, medal: Medal, star: Star, crown: Crown }
type Props = {
  title?: string
  text?: string
  icon?: keyof typeof ICONS
  color?: string
  duration?: number
  value?: boolean
  onChange?: (v: boolean) => void
  onComplete?: () => void
}

const W = 0.32
const H = 0.09
const D = 0.02
const FANFARE = ["G5", "C6", "E6"]

// Shine: a leaning light band (map, slid along by offset) masked to the card's rounded rect (alphaMap, static).
function shineTextures() {
  const band = document.createElement("canvas")
  band.width = 256
  band.height = 64
  const b = band.getContext("2d")!
  b.setTransform(1, 0, -0.6, 1, 19, 0)
  const grad = b.createLinearGradient(104, 0, 152, 0)
  grad.addColorStop(0, "rgba(255,255,255,0)")
  grad.addColorStop(0.5, "rgba(255,255,255,0.85)")
  grad.addColorStop(1, "rgba(255,255,255,0)")
  b.fillStyle = grad
  b.fillRect(-64, 0, 384, 64)
  const mask = document.createElement("canvas")
  mask.width = 512
  mask.height = 144
  const m = mask.getContext("2d")!
  m.fillStyle = "white"
  m.beginPath()
  m.roundRect(0, 0, 512, 144, 16)
  m.fill()
  return { band: new CanvasTexture(band), mask: new CanvasTexture(mask) }
}

/** 32 × 9 cm achievement toast: springs up with overshoot, a shine sweeps across, 3-note fanfare. Auto-hides to a replay chip; tap the card to dismiss. */
export default function AchievementPopup({
  title = "Achievement unlocked",
  text = "First steps",
  icon = "trophy",
  color = "#FFC94D",
  duration = 4,
  value,
  onChange,
  onComplete,
}: Props) {
  const Icon = ICONS[icon] ?? Trophy
  const dur = duration > 0 ? duration : 4
  const [inner, setInner] = useState(true)
  const v = value ?? inner
  const set = (n: boolean) => {
    if (value === undefined) setInner(n)
    onChange?.(n)
  }
  const card = useRef<Group>(null)
  const medal = useRef<Group>(null)
  const chip = useRef<Group>(null)
  const shine = useRef<MeshBasicMaterial>(null)
  const st = useRef({ p: 0, pv: 0, chip: 0, age: 0, done: false, spin: 0, tapped: false })
  const synth = useRef<Tone.PolySynth | null>(null)
  const geo = useMemo(() => ({ card: new RoundedBoxGeometry(W, H, D, 4, 0.01), disc: new CylinderGeometry(0.026, 0.026, 0.008, 32).rotateX(Math.PI / 2) }), [])
  const tex = useMemo(() => (typeof document === "undefined" ? null : shineTextures()), [])
  const tint = useMemo(() => new Color(color), [color])
  useEffect(
    () => () => {
      geo.card.dispose()
      geo.disc.dispose()
      tex?.band.dispose()
      tex?.mask.dispose()
    },
    [geo, tex],
  )
  useEffect(() => () => void synth.current?.dispose(), [])

  const fanfare = () => {
    synth.current ??= new Tone.PolySynth(Tone.Synth, { oscillator: { type: "triangle" }, envelope: { attack: 0.005, decay: 0.2, sustain: 0.25, release: 0.6 }, volume: -12 }).toDestination()
    const t = Tone.now()
    FANFARE.forEach((n, i) => synth.current?.triggerAttackRelease(n, i === 2 ? 0.6 : 0.1, t + i * 0.11))
  }

  // Every show restarts the timer, the medal spin and the shine.
  useEffect(() => {
    const s = st.current
    if (!v) return
    Object.assign(s, { age: 0, done: false, spin: Math.PI * 2 })
    if (s.tapped) s.tapped = false // the tap handler plays it after Tone.start()
    else if (Tone.getContext().state === "running") fanfare()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v])

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    s.pv += (320 * ((v ? 1 : 0) - s.p) - (v ? 14 : 30) * s.pv) * dt // bouncy in, firm out
    s.p += s.pv * dt
    if (card.current) {
      card.current.visible = s.p > 0.01
      card.current.position.y = (1 - s.p) * -0.08
      card.current.scale.setScalar(Math.max(0.001, s.p))
    }
    if (v) {
      s.age += delta
      if (s.age >= dur && !s.done) {
        s.done = true
        set(false)
        onComplete?.()
      }
    }
    s.spin *= Math.exp(-dt * 3.5)
    if (medal.current) medal.current.rotation.y = s.spin
    const k = (s.age - 0.35) / 0.75 // shine runs 0.35–1.1 s after showing
    if (shine.current && tex) {
      shine.current.visible = v && k > 0 && k < 1
      tex.band.offset.x = 0.7 - 1.4 * k
    }
    s.chip += ((v ? 0 : 1) - s.chip) * (1 - Math.exp(-dt * (v ? 14 : 5)))
    if (chip.current) {
      chip.current.visible = s.chip > 0.02
      chip.current.scale.setScalar(Math.max(0.001, s.chip))
    }
  })

  const dismiss = () => {
    if (st.current.done) return
    st.current.done = true
    set(false)
    onComplete?.()
  }
  const replay = async () => {
    st.current.tapped = true
    set(true)
    await Tone.start()
    fanfare()
  }

  return (
    <group>
      <group ref={card} visible={false}>
        <mesh geometry={geo.card} onClick={v ? dismiss : undefined}>
          <meshStandardMaterial color="#15171E" emissive={tint} emissiveIntensity={0.06} roughness={0.5} metalness={0.15} />
        </mesh>
        <group ref={medal} position={[-W / 2 + 0.045, 0, D / 2 + 0.002]}>
          <mesh geometry={geo.disc}>
            <meshStandardMaterial color={color} emissive={tint} emissiveIntensity={0.4} roughness={0.3} metalness={0.5} />
          </mesh>
          <group position={[0, 0, 0.0045]}>
            <Container pixelSize={0.002} pointerEvents="none">
              <Icon width={18} height={18} color="#0B0C10" />
            </Container>
          </group>
        </group>
        <group position={[-W / 2 + 0.085, 0, D / 2 + 0.001]}>
          <Container pixelSize={0.002} pointerEvents="none" anchorX="left" width={112} flexDirection="column" alignItems="flex-start" gap={3}>
            <Text fontSize={8} fontWeight="semi-bold" letterSpacing={1.5} color={color}>
              {title.toUpperCase()}
            </Text>
            <Text fontSize={15} fontWeight="semi-bold" color="#EEF0F4">
              {text}
            </Text>
          </Container>
        </group>
        {tex && (
          <mesh position={[0, 0, D / 2 + 0.008]}>
            <planeGeometry args={[W, H]} />
            <meshBasicMaterial ref={shine} map={tex.band} alphaMap={tex.mask} color="#FFF4D6" transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} visible={false} />
          </mesh>
        )}
      </group>
      {/* Replay chip: what's left once the toast is gone; tap to show it again. */}
      <group ref={chip} visible={false}>
        <Container
          pixelSize={0.002}
          onClick={v ? undefined : replay}
          width={24}
          height={24}
          borderRadius={12}
          alignItems="center"
          justifyContent="center"
          backgroundColor="#15171E"
          borderWidth={1}
          borderColor="#323745"
          opacity={0.6}
          hover={{ opacity: 1 }}
        >
          <Icon width={13} height={13} color={color} />
        </Container>
      </group>
    </group>
  )
}
