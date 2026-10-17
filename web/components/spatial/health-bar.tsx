"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import * as Tone from "tone"
import { CapsuleGeometry, Color, CylinderGeometry, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, type Group } from "three"

type Props = { value?: number; max?: number; label?: string; color?: string; onChange?: (v: number) => void }

const L = 0.27 // straight part of the tube; the round caps add 2 x R
const R = 0.018 // glass tube radius
const RF = 0.0135 // fill radius
const X0 = -L / 2
const HIT = 15 // demo damage per tap
const WARM = new Color("#F2B48A")
const RED = new Color("#FF5A6A")
const HEAL = new Color("#D9E77E") // green-gold shimmer
const SHELL = new Color("#323745")

// A pill is [left cap, cylinder, right cap]; stretch it from the left end to fraction f of the tube.
function pill(g: Group | null, f: number) {
  if (!g) return
  g.visible = f > 0.004
  const len = Math.max(1e-4, f * L)
  g.children[1].position.x = X0 + len / 2
  g.children[1].scale.x = len
  g.children[2].position.x = X0 + len
}

/** 30 cm glass health bar: the fill springs to `value`, a warm ghost trails damage, heals shimmer green-gold, low health pulses red. Tap for demo damage. */
export default function HealthBar({ value, max = 100, label = "Health", color = "#9FE7D2", onChange }: Props) {
  const m = max > 0 ? max : 100
  const [inner, setInner] = useState(Math.min(75, m))
  const v = Math.min(m, Math.max(0, value ?? inner))
  const pct = v / m
  const set = (n: number) => {
    if (value === undefined) setInner(n)
    onChange?.(n)
  }

  const root = useRef<Group>(null)
  const fill = useRef<Group>(null)
  const ghost = useRef<Group>(null)
  const st = useRef({ f: pct, fv: 0, g: pct, target: pct, hold: 0, heal: false, shake: 0, flash: 0, time: 0 })
  const sfx = useRef<{ thud: Tone.MembraneSynth; chime: Tone.Synth } | null>(null)
  const geo = useMemo(
    () => ({
      tube: new CapsuleGeometry(R, L, 6, 24).rotateZ(Math.PI / 2),
      cyl: new CylinderGeometry(RF, RF, 1, 24, 1, true).rotateZ(Math.PI / 2),
      cap: new SphereGeometry(RF, 24, 12),
    }),
    [],
  )
  const mat = useMemo(
    () => ({
      fill: new MeshStandardMaterial({ roughness: 0.3, metalness: 0.1 }),
      ghost: new MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }),
      shell: new MeshStandardMaterial({ color: "#242833", emissive: SHELL, emissiveIntensity: 0.3, transparent: true, opacity: 0.4, roughness: 0.15, metalness: 0.1, depthWrite: false }),
    }),
    [],
  )
  const base = useMemo(() => new Color(color), [color])
  const tmp = useMemo(() => new Color(), [])
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
      Object.values(mat).forEach((x) => x.dispose())
    },
    [geo, mat],
  )
  useEffect(
    () => () => {
      sfx.current?.thud.dispose()
      sfx.current?.chime.dispose()
    },
    [],
  )

  // Loss: fill drops now, ghost holds then drains. Gain: ghost leads with a shimmer, fill follows a beat later.
  useEffect(() => {
    const s = st.current
    if (pct < s.target) Object.assign(s, { g: Math.max(s.g, s.f), heal: false, hold: 0.4, flash: 1, shake: 1 })
    else if (pct > s.target) Object.assign(s, { g: pct, heal: true, hold: 0.15 })
    s.target = pct
  }, [pct])

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    s.time += dt
    s.hold = Math.max(0, s.hold - dt)
    s.flash = Math.max(0, s.flash - dt * 4)
    s.shake = Math.max(0, s.shake - dt * 3.5)
    const goal = s.heal && s.hold > 0 ? s.f : s.target
    s.fv += (360 * (goal - s.f) - 20 * s.fv) * dt
    s.f += s.fv * dt
    if (s.heal && s.hold === 0 && Math.abs(s.target - s.f) < 0.01) s.heal = false
    if (!s.heal && s.hold === 0) s.g += (s.f - s.g) * (1 - Math.exp(-dt * 5))

    const f = Math.min(1, Math.max(0, s.f))
    pill(fill.current, f)
    pill(ghost.current, s.g > f + 0.004 ? Math.min(1, s.g) : 0)
    // colour by percentage: `color` above 60 %, warm by 30 %, red by 10 %
    if (f > 0.3) tmp.copy(WARM).lerp(base, Math.min(1, (f - 0.3) / 0.3))
    else tmp.copy(RED).lerp(WARM, Math.max(0, (f - 0.1) / 0.2))
    const low = s.target < 0.25 ? 0.5 + 0.5 * Math.sin(s.time * 7) : 0
    mat.fill.color.copy(tmp)
    mat.fill.emissive.copy(tmp)
    mat.fill.emissiveIntensity = 0.5 + low * 0.5 + s.flash * 0.8
    mat.shell.emissive.copy(SHELL).lerp(RED, low * 0.7)
    mat.shell.emissiveIntensity = 0.3 + low * 0.5
    mat.ghost.color.copy(s.heal ? HEAL : WARM)
    mat.ghost.opacity = s.heal ? 0.55 + 0.35 * Math.sin(s.time * 26) : 0.9
    root.current?.position.set(Math.sin(s.time * 90) * 0.006 * s.shake, Math.cos(s.time * 70) * 0.002 * s.shake, 0)
  })

  const hit = async () => {
    const n = v <= 0 ? m : Math.max(0, v - HIT)
    set(n)
    await Tone.start()
    sfx.current ??= {
      thud: new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 3, envelope: { attack: 0.001, decay: 0.3, sustain: 0 }, volume: -8 }).toDestination(),
      chime: new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.005, decay: 0.25, sustain: 0, release: 0.2 }, volume: -14 }).toDestination(),
    }
    const t = Tone.now()
    if (n < v) sfx.current.thud.triggerAttackRelease("A1", "8n", t)
    else {
      sfx.current.chime.triggerAttackRelease("E5", 0.1, t)
      sfx.current.chime.triggerAttackRelease("B5", 0.2, t + 0.09)
    }
  }

  return (
    <group>
      <group ref={root}>
        <mesh geometry={geo.tube} position={[0, 0, -0.004]} scale={[0.96, 0.55, 0.55]}>
          <meshBasicMaterial color="#0B0C10" />
        </mesh>
        <group ref={fill}>
          <mesh geometry={geo.cap} material={mat.fill} position={[X0, 0, 0]} />
          <mesh geometry={geo.cyl} material={mat.fill} />
          <mesh geometry={geo.cap} material={mat.fill} />
        </group>
        <group ref={ghost} scale={[1, 0.92, 0.92]}>
          <mesh geometry={geo.cap} material={mat.ghost} position={[X0, 0, 0]} />
          <mesh geometry={geo.cyl} material={mat.ghost} />
          <mesh geometry={geo.cap} material={mat.ghost} />
        </group>
        <mesh geometry={geo.tube} material={mat.shell} />
        <group position={[0, R + 0.017, 0]}>
          <Container pixelSize={0.002} pointerEvents="none" width={150} flexDirection="row" justifyContent="space-between" alignItems="flex-end">
            <Text fontSize={10} fontWeight="semi-bold" letterSpacing={1} color="#9AA0AD">
              {label.toUpperCase()}
            </Text>
            <Container flexDirection="row" alignItems="flex-end" gap={3}>
              <Text fontSize={13} fontWeight="semi-bold" color={pct < 0.25 ? "#FF5A6A" : "#EEF0F4"}>
                {`${Math.round(v)}`}
              </Text>
              <Text fontSize={10} color="#6B7180" marginBottom={1}>
                {`/ ${m}`}
              </Text>
            </Container>
          </Container>
        </group>
      </group>
      {/* Static hit box: the bar shakes on a hit, the hit surface must not. */}
      <mesh visible={false} onClick={hit}>
        <boxGeometry args={[L + 2 * R + 0.01, 0.05, 0.05]} />
      </mesh>
    </group>
  )
}
