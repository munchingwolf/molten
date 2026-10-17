"use client"

import { useEffect, useRef, useState } from "react"
import * as Tone from "tone"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { AdditiveBlending, type Group, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial } from "three"

type Props = {
  value?: boolean
  latch?: boolean
  color?: string
  tilt?: number
  onChange?: (pressed: boolean) => void
  onPress?: () => void
}

const R = 0.15 // plate radius (30 cm across)
const SINK = 0.009 // press depth
const WAVES = 3
const WAVE_LIFE = 1.3 // seconds
const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0] // lay a flat XY shape on the floor, facing +Y

type Sfx = { thunk: Tone.MembraneSynth; tone: Tone.Synth }

/** 30 cm floor pressure plate: step, poke or click to sink it; the rim glows and light rings roll out across the floor. */
export default function PressurePlate({ value, latch = false, color = "#9FE7D2", tilt = 0.45, onChange, onPress }: Props) {
  const [inner, setInner] = useState(false)
  const v = value ?? inner
  const plate = useRef<Group>(null)
  const skin = useRef<MeshStandardMaterial>(null)
  const rim = useRef<MeshBasicMaterial>(null)
  const gap = useRef<MeshBasicMaterial>(null)
  const marks = useRef<MeshBasicMaterial>(null)
  const waves = useRef<(Mesh | null)[]>([])
  const sfx = useRef<Sfx | null>(null)
  const st = useRef({ y: 0, yv: 0, glow: 0.2, down: false, hover: false, ages: Array<number>(WAVES).fill(WAVE_LIFE) })
  useEffect(
    () => () => {
      sfx.current?.thunk.dispose()
      sfx.current?.tone.dispose()
      sfx.current = null
    },
    [],
  )

  const set = (n: boolean) => {
    if (n === v) return
    if (value === undefined) setInner(n)
    onChange?.(n)
  }

  const play = async (rising: boolean) => {
    await Tone.start()
    sfx.current ??= {
      thunk: new Tone.MembraneSynth({ pitchDecay: 0.06, octaves: 4, envelope: { attack: 0.001, decay: 0.35, sustain: 0 }, volume: -6 }).toDestination(),
      tone: new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.01, decay: 0.35, sustain: 0, release: 0.1 }, volume: -16 }).toDestination(),
    }
    const t = Tone.now()
    sfx.current.thunk.triggerAttackRelease("C1", 0.3, t)
    sfx.current.tone.triggerAttackRelease(rising ? 262 : 523, 0.35, t + 0.03)
    sfx.current.tone.frequency.exponentialRampTo(rising ? 784 : 196, 0.3, t + 0.04)
  }

  const press = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const s = st.current
    if (s.down) return
    s.down = true
    s.yv -= 0.25 // thump: hits bottom faster than the spring alone
    s.ages.forEach((_, i) => (s.ages[i] = -i * 0.16)) // three rings, staggered
    const next = latch ? !v : true
    set(next)
    onPress?.()
    void play(next)
  }
  const release = () => {
    const s = st.current
    if (!s.down) return
    s.down = false
    if (!latch) set(false)
  }

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    const target = s.down ? -SINK : v ? -SINK * 0.6 : 0
    s.yv += (450 * (target - s.y) - 20 * s.yv) * dt
    s.y += s.yv * dt
    if (plate.current) plate.current.position.y = s.y
    const glow = s.down ? 1 : v ? 0.75 : s.hover ? 0.42 : 0.2
    s.glow += (glow - s.glow) * (1 - Math.exp(-dt * (glow > s.glow ? 20 : 6)))
    if (rim.current) rim.current.opacity = s.glow
    if (gap.current) gap.current.opacity = s.glow * 0.8
    if (marks.current) marks.current.opacity = 0.12 + s.glow * 0.35
    if (skin.current) skin.current.emissiveIntensity = 0.3 + s.glow * 0.1
    for (let i = 0; i < WAVES; i++) {
      const m = waves.current[i]
      if (!m) continue
      const age = (s.ages[i] = Math.min(WAVE_LIFE, s.ages[i] + dt))
      const k = Math.max(0, age) / WAVE_LIFE
      m.visible = age >= 0 && age < WAVE_LIFE
      const r = R + 0.035 + (1 - (1 - k) ** 2) * 0.3
      m.scale.set(r, r, 1)
      ;(m.material as MeshBasicMaterial).opacity = (1 - k) ** 2 * 0.8
    }
  })

  return (
    <group rotation={[tilt, 0, 0]}>
      {/* Frame */}
      <mesh position={[0, -0.011, 0]}>
        <cylinderGeometry args={[R + 0.024, R + 0.032, 0.022, 32]} />
        <meshStandardMaterial color="#15171E" emissive="#15171E" emissiveIntensity={0.35} roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.003, 0]} rotation={FLAT}>
        <torusGeometry args={[R + 0.013, 0.005, 8, 32]} />
        <meshStandardMaterial color="#323745" emissive="#323745" emissiveIntensity={0.3} roughness={0.35} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.0005, 0]} rotation={FLAT}>
        <ringGeometry args={[R - 0.002, R + 0.008, 32]} />
        <meshBasicMaterial ref={gap} color={color} transparent opacity={0.16} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* Plate (sinks) */}
      <group ref={plate}>
        <mesh position={[0, 0.007, 0]}>
          <cylinderGeometry args={[R, R, 0.014, 32]} />
          <meshStandardMaterial ref={skin} color="#1A1D25" emissive="#1A1D25" emissiveIntensity={0.3} roughness={0.5} metalness={0.25} />
        </mesh>
        <mesh position={[0, 0.0142, 0]} rotation={FLAT}>
          <ringGeometry args={[R - 0.009, R - 0.003, 32]} />
          <meshBasicMaterial ref={rim} color={color} transparent opacity={0.2} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <group position={[0, 0.0143, 0]} rotation={FLAT}>
          <mesh>
            <ringGeometry args={[0.095, 0.099, 32]} />
            <meshBasicMaterial ref={marks} color={color} transparent opacity={0.2} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh>
            <ringGeometry args={[0.042, 0.045, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.25} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      </group>
      {/* Light rings on the floor (frame bottom), unit ring scaled out */}
      {Array.from({ length: WAVES }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            waves.current[i] = m
          }}
          visible={false}
          position={[0, -0.021, 0]}
          rotation={FLAT}
        >
          <ringGeometry args={[0.94, 1, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      {/* Static hit volume: the plate sinks, the hit surface must not, or a poke would re-trigger. */}
      <mesh
        visible={false}
        position={[0, 0.012, 0]}
        onPointerDown={press}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerOver={() => (st.current.hover = true)}
        onPointerOut={() => {
          st.current.hover = false
          release()
        }}
      >
        <cylinderGeometry args={[R + 0.01, R + 0.01, 0.03, 32]} />
      </mesh>
    </group>
  )
}
