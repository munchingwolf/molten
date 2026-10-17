"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import * as Tone from "tone"
import { useFrame } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { AdditiveBlending, Color, MeshBasicMaterial, RingGeometry, type Group, type Mesh } from "three"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"

type Props = {
  color?: string
  lockColor?: string
  size?: number
  value?: boolean
  onChange?: (locked: boolean) => void
  onPress?: () => void
}

const R = 0.1 // outer radius, metres
const DASHES = 12
const TICK = 0.022 // tick length
const OPEN = 0.06 // tick inner end when idle
const SHUT = 0.02 // tick inner end when locked on
const SHOCK = 0.45 // seconds the shock ring lives

type Sfx = { beep: Tone.Synth; thump: Tone.MembraneSynth; snap: Tone.NoiseSynth }

/** 20 cm floating crosshair target: aim at it (ray or fingertip) to lock on, tap to fire. Counts hits. */
export default function TargetReticle({ color = "#9FE7D2", lockColor = "#F2B48A", size = 1, value, onChange, onPress }: Props) {
  const [inner, setInner] = useState(false)
  const [hits, setHits] = useState(0)
  const locked = value ?? inner
  const spin = useRef<Group>(null)
  const kick = useRef<Group>(null)
  const core = useRef<Group>(null)
  const dot = useRef<Mesh>(null)
  const shock = useRef<Mesh>(null)
  const flash = useRef<MeshBasicMaterial>(null)
  const ticks = useRef<(Mesh | null)[]>([])
  const sfx = useRef<Sfx | null>(null)
  const st = useRef({ lock: 0, r: OPEN, rv: 0, k: 0, kv: 0, shock: 1, flash: 0, t: 0 })

  const dashes = useMemo(() => {
    const arc = (Math.PI * 2) / DASHES
    const parts = Array.from({ length: DASHES }, (_, i) => new RingGeometry(R - 0.006, R, 3, 1, i * arc, arc * 0.55))
    const merged = mergeGeometries(parts)
    parts.forEach((p) => p.dispose())
    return merged
  }, [])
  const ink = useMemo(() => new MeshBasicMaterial({ toneMapped: false, transparent: true, depthWrite: false }), [])
  const burst = useMemo(
    () => new MeshBasicMaterial({ toneMapped: false, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 }),
    [],
  )
  const idle = useMemo(() => new Color(color), [color])
  const hot = useMemo(() => new Color(lockColor), [lockColor])
  useEffect(() => () => (dashes.dispose(), ink.dispose(), burst.dispose()), [dashes, ink, burst])
  useEffect(
    () => () => {
      const v = sfx.current
      if (v) (v.beep.dispose(), v.thump.dispose(), v.snap.dispose())
      sfx.current = null
    },
    [],
  )

  const voices = () =>
    (sfx.current ??= {
      beep: new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.003, decay: 0.08, sustain: 0, release: 0.05 }, volume: -16 }).toDestination(),
      thump: new Tone.MembraneSynth({ pitchDecay: 0.012, octaves: 5, envelope: { attack: 0.001, decay: 0.12, sustain: 0 }, volume: -8 }).toDestination(),
      snap: new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.035, sustain: 0 }, volume: -16 }).toDestination(),
    })

  const set = (n: boolean) => {
    if (n === locked) return
    if (value === undefined) setInner(n)
    onChange?.(n)
    // Hover is not a user gesture, so only beep once audio is already unlocked.
    if (n && Tone.getContext().state === "running") {
      const { beep } = voices()
      const t = Tone.now()
      beep.triggerAttackRelease("E6", 0.04, t)
      beep.triggerAttackRelease("B6", 0.05, t + 0.07)
    }
  }

  const fire = async () => {
    const s = st.current
    s.shock = 0
    s.flash = 1
    s.kv -= 2.4
    setHits((h) => h + 1)
    onPress?.()
    await Tone.start()
    const { thump, snap } = voices()
    const t = Tone.now()
    thump.triggerAttackRelease("A2", 0.08, t)
    snap.triggerAttackRelease(0.04, t)
  }

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    s.t += dt
    const goal = locked ? 1 : 0
    s.lock += (goal - s.lock) * (1 - Math.exp(-dt * 10))
    ink.color.lerpColors(idle, hot, s.lock)
    burst.color.copy(hot)

    // Ticks spring in on lock-on and overshoot a touch.
    s.rv += (420 * ((locked ? SHUT : OPEN) - s.r) - 18 * s.rv) * dt
    s.r += s.rv * dt
    for (const m of ticks.current) if (m) m.position.x = s.r + TICK / 2

    // Recoil on fire: dips then springs past 1.
    s.kv += (380 * (0 - s.k) - 14 * s.kv) * dt
    s.k += s.kv * dt
    kick.current?.scale.setScalar(1 + s.k * 0.7)

    if (spin.current) spin.current.rotation.z -= dt * (0.35 + s.lock * 2.6)
    core.current?.scale.setScalar(1 - s.lock * 0.12 + Math.sin(s.t * 9) * 0.025 * s.lock)

    s.shock = Math.min(1, s.shock + dt / SHOCK)
    if (shock.current) {
      const e = 1 - (1 - s.shock) ** 3
      shock.current.visible = s.shock < 1
      shock.current.scale.setScalar(0.3 + e * 1.5)
      burst.opacity = (1 - s.shock) ** 2
    }
    s.flash = Math.max(0, s.flash - dt * 5)
    if (flash.current) flash.current.opacity = s.flash * 0.9
    dot.current?.scale.setScalar(1 + s.flash * 1.6)
  })

  return (
    <group scale={size}>
      <group ref={kick}>
        <mesh position={[0, 0, -0.003]}>
          <circleGeometry args={[R + 0.008, 32]} />
          <meshBasicMaterial color="#0B0C10" transparent opacity={0.35} depthWrite={false} />
        </mesh>
        <group ref={spin}>
          <mesh geometry={dashes} material={ink} />
        </group>
        <group ref={core}>
          <mesh material={ink}>
            <ringGeometry args={[0.044, 0.0475, 32]} />
          </mesh>
        </group>
        {[0, 1, 2, 3].map((i) => (
          <group key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
            <mesh
              ref={(m) => {
                ticks.current[i] = m
              }}
              material={ink}
              position={[OPEN + TICK / 2, 0, 0.001]}
            >
              <planeGeometry args={[TICK, 0.004]} />
            </mesh>
          </group>
        ))}
        <mesh ref={dot} material={ink} position={[0, 0, 0.001]}>
          <circleGeometry args={[0.0055, 16]} />
        </mesh>
        <mesh position={[0, 0, 0.002]}>
          <circleGeometry args={[0.032, 24]} />
          <meshBasicMaterial ref={flash} color={lockColor} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh ref={shock} material={burst} visible={false} position={[0, 0, 0.003]}>
          <ringGeometry args={[R * 0.94, R, 32]} />
        </mesh>
      </group>
      <group position={[0, -R - 0.03, 0]}>
        <Container pixelSize={0.002} pointerEvents="none" flexDirection="row" alignItems="center" gap={6}>
          <Text fontSize={10} fontWeight="semi-bold" color="#9AA0AD">
            HITS
          </Text>
          <Text fontSize={16} fontWeight="semi-bold" color="#EEF0F4">
            {`${hits}`}
          </Text>
        </Container>
      </group>
      {/* Static hit disc: aim = lock on, tap = fire. Pokes lock on at contact since hands have no hover. */}
      <mesh
        visible={false}
        position={[0, 0, 0.004]}
        onPointerOver={() => set(true)}
        onPointerOut={() => set(false)}
        onPointerDown={() => set(true)}
        onClick={fire}
      >
        <circleGeometry args={[R + 0.01, 32]} />
      </mesh>
    </group>
  )
}
