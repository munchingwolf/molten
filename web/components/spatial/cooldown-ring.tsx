"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { Flame, Heart, Shield, Sparkles, Zap } from "@react-three/uikit-lucide"
import * as Tone from "tone"
import { AdditiveBlending, Color, CylinderGeometry, DoubleSide, RingGeometry, type Group, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial } from "three"

const ICONS = { zap: Zap, flame: Flame, shield: Shield, heart: Heart, sparkles: Sparkles }
type Props = { duration?: number; icon?: keyof typeof ICONS; color?: string; label?: string; onPress?: () => void; onComplete?: () => void }

const R = 0.04 // button face radius
const R1 = 0.044 // sweep ring inner/outer radius
const R2 = 0.05
const SEG = 64 // sweep resolution; each theta segment is 6 indices

/** 10 cm round ability button with a clockwise cooldown sweep. Tap to cast; taps while cooling are denied; it flashes and pings when ready. */
export default function CooldownRing({ duration = 3, icon = "zap", color = "#9FE7D2", label = "Ability", onPress, onComplete }: Props) {
  const Icon = ICONS[icon] ?? Zap
  const dur = duration > 0 ? duration : 3
  const [left, setLeft] = useState(0) // whole seconds shown in the centre while cooling
  const root = useRef<Group>(null)
  const body = useRef<Group>(null)
  const tip = useRef<Mesh>(null)
  const flash = useRef<Mesh>(null)
  const sweepMat = useRef<MeshBasicMaterial>(null)
  const flashMat = useRef<MeshBasicMaterial>(null)
  const skin = useRef<MeshStandardMaterial>(null)
  const st = useRef({ cool: 0, total: dur, sec: 0, z: 0, zv: 0, down: false, shake: 0, flash: 0, time: 0, glow: 0.2, target: 0.25 })
  const sfx = useRef<{ ping: Tone.PolySynth; thud: Tone.MembraneSynth } | null>(null)
  const geo = useMemo(
    () => ({
      sweep: new RingGeometry(R1, R2, SEG, 1),
      track: new RingGeometry(R1, R2, 32, 1),
      disc: new CylinderGeometry(R, R, 0.014, 32).rotateX(Math.PI / 2),
    }),
    [],
  )
  const tint = useMemo(() => new Color(color), [color])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  useEffect(
    () => () => {
      sfx.current?.ping.dispose()
      sfx.current?.thud.dispose()
    },
    [],
  )

  const voices = async () => {
    await Tone.start()
    return (sfx.current ??= {
      ping: new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sine" }, envelope: { attack: 0.002, decay: 0.35, sustain: 0, release: 0.4 }, volume: -10 }).toDestination(),
      thud: new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 1.5, envelope: { attack: 0.001, decay: 0.14, sustain: 0 }, volume: -8 }).toDestination(),
    })
  }

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    s.time += dt
    if (s.cool > 0) {
      s.cool = Math.max(0, s.cool - delta)
      const sec = Math.ceil(s.cool)
      if (sec !== s.sec) {
        s.sec = sec
        setLeft(sec)
      }
      if (s.cool === 0) {
        s.flash = 1
        void voices().then((x) => {
          const t = Tone.now()
          x.ping.triggerAttackRelease("E6", 0.2, t)
          x.ping.triggerAttackRelease("B6", 0.35, t + 0.07)
        })
        onComplete?.()
      }
    }
    const cooling = s.cool > 0
    const t = cooling ? Math.min(1, Math.max(0, 1 - s.cool / s.total)) : 1
    geo.sweep.setDrawRange(0, 6 * Math.floor(SEG * t))
    if (sweepMat.current) sweepMat.current.opacity = cooling ? 0.55 : 0.8 + 0.2 * Math.sin(s.time * 2.5)
    if (tip.current) {
      const a = Math.PI / 2 - t * Math.PI * 2 // clockwise from 12 o'clock
      tip.current.visible = cooling
      tip.current.position.set(Math.cos(a) * (R1 + R2) * 0.5, Math.sin(a) * (R1 + R2) * 0.5, 0.005)
    }
    s.flash = Math.max(0, s.flash - dt * 2)
    if (flash.current && flashMat.current) {
      flash.current.visible = s.flash > 0
      flash.current.scale.setScalar(1 + (1 - s.flash) * 0.45)
      flashMat.current.opacity = s.flash
    }
    s.glow += ((cooling ? 0.02 : s.target) - s.glow) * (1 - Math.exp(-dt * 10))
    if (skin.current) skin.current.emissiveIntensity = 0.08 + s.glow * 0.45 + s.flash * 0.9
    s.zv += (420 * ((s.down ? -0.006 : 0) - s.z) - 22 * s.zv) * dt
    s.z += s.zv * dt
    if (body.current) body.current.position.z = s.z
    s.shake = Math.max(0, s.shake - dt * 4)
    if (root.current) root.current.position.x = Math.sin(s.time * 80) * 0.004 * s.shake
  })

  const press = async () => {
    const s = st.current
    if (s.cool > 0) {
      s.shake = 1
      const x = await voices()
      x.thud.triggerAttackRelease("D2", "16n", Tone.now())
      return
    }
    s.cool = s.total = dur
    onPress?.()
    const x = await voices()
    x.ping.triggerAttackRelease("A5", 0.06, Tone.now())
  }
  const near = (e: ThreeEvent<PointerEvent>) => {
    st.current.target = e.pointerType === "touch" ? Math.min(1, Math.max(0.4, 1.1 - e.distance * 9)) : 0.75
  }
  const down = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    st.current.down = true
  }
  const up = () => {
    st.current.down = false
  }

  return (
    <group>
      <group ref={root}>
        <mesh geometry={geo.track} position={[0, 0, 0.004]}>
          <meshBasicMaterial color="#242833" />
        </mesh>
        {/* RingGeometry runs counter-clockwise from 3 o'clock; mirror + rotate makes it clockwise from 12. */}
        <mesh geometry={geo.sweep} position={[0, 0, 0.0045]} rotation={[0, 0, -Math.PI / 2]} scale={[-1, 1, 1]}>
          <meshBasicMaterial ref={sweepMat} color={color} side={DoubleSide} transparent toneMapped={false} />
        </mesh>
        <mesh ref={tip} visible={false}>
          <circleGeometry args={[0.0042, 16]} />
          <meshBasicMaterial color="#EEF0F4" toneMapped={false} />
        </mesh>
        <mesh ref={flash} geometry={geo.track} position={[0, 0, 0.005]} visible={false}>
          <meshBasicMaterial ref={flashMat} color={color} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <group ref={body}>
          <mesh geometry={geo.disc}>
            <meshStandardMaterial ref={skin} color="#171A21" emissive={tint} emissiveIntensity={0.2} roughness={0.35} metalness={0.2} />
          </mesh>
          <group position={[0, 0, 0.0075]}>
            <Container pixelSize={0.002} pointerEvents="none" alignItems="center" justifyContent="center">
              {left > 0 ? (
                <Text fontSize={18} fontWeight="bold" color="#EEF0F4">
                  {`${left}`}
                </Text>
              ) : (
                <Icon width={20} height={20} color={color} />
              )}
            </Container>
          </group>
        </group>
      </group>
      <group position={[0, -0.066, 0]}>
        <Container pixelSize={0.002} pointerEvents="none">
          <Text fontSize={10} color="#9AA0AD">
            {label}
          </Text>
        </Container>
      </group>
      {/* Static hit box: the face sinks and shakes, the hit surface must not. */}
      <mesh
        visible={false}
        position={[0, 0, 0.008]}
        onPointerOver={near}
        onPointerMove={near}
        onPointerOut={() => {
          st.current.target = 0.25
          up()
        }}
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={press}
      >
        <boxGeometry args={[2 * R2, 2 * R2, 0.03]} />
      </mesh>
    </group>
  )
}
