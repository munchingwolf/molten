"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import * as Tone from "tone"
import { Color, type Group, type MeshStandardMaterial } from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

type Props = { value?: number; step?: number; label?: string; color?: string; digits?: number; onChange?: (v: number) => void }

const W = 0.2 // metres (grows for long numbers)
const H = 0.1
const D = 0.018
const CH = 17 // px per digit cell: fixed width so the rolling number doesn't jitter
const SLOTS = 4 // "+N" floaters in flight at once

/** 20 x 10 cm score panel: the number rolls up on a spring, pops and floats "+N". Tap to add `step`; the coin blip climbs in pitch on fast taps. */
export default function ScoreCounter({ value, step = 10, label = "Score", color = "#FFC94D", digits = 5, onChange }: Props) {
  const [inner, setInner] = useState(0)
  const v = value ?? inner
  const set = (n: number) => {
    if (value === undefined) setInner(n)
    onChange?.(n)
  }
  const [shown, setShown] = useState(v)
  const [pops, setPops] = useState<string[]>(() => Array<string>(SLOTS).fill(" "))
  const body = useRef<Group>(null)
  const num = useRef<Group>(null)
  const floats = useRef<(Group | null)[]>([])
  const skin = useRef<MeshStandardMaterial>(null)
  const st = useRef({ x: v, xv: 0, shown: v, last: v, pop: 1, pv: 0, z: 0, zv: 0, down: false, glow: 0.15, target: 0.15, flash: 0, slot: 0, ages: Array<number>(SLOTS).fill(9), combo: 0, tap: 0 })
  const synth = useRef<Tone.Synth | null>(null)
  const geometry = useMemo(() => new RoundedBoxGeometry(W, H, D, 4, 0.009), [])
  const tint = useMemo(() => new Color(color), [color])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => void synth.current?.dispose(), [])

  // Any increase (tap or controlled) pops the number and launches a "+N".
  useEffect(() => {
    const s = st.current
    const d = v - s.last
    s.last = v
    if (d <= 0) return
    const slot = s.slot++ % SLOTS
    s.ages[slot] = 0
    s.pv += 7
    s.flash = 1
    setPops((p) => p.map((t, i) => (i === slot ? `+${Math.round(d)}` : t)))
  }, [v])

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    s.xv += (140 * (v - s.x) - 24 * s.xv) * dt // ~critically damped: rolls without counting past the target
    s.x += s.xv * dt
    const n = Math.round(Math.abs(v - s.x) < 0.5 ? v : s.x)
    if (n !== s.shown) {
      s.shown = n
      setShown(n)
    }
    s.pv += (420 * (1 - s.pop) - 14 * s.pv) * dt
    s.pop += s.pv * dt
    num.current?.scale.setScalar(s.pop)
    s.zv += (420 * ((s.down ? -0.007 : 0) - s.z) - 22 * s.zv) * dt
    s.z += s.zv * dt
    if (body.current) body.current.position.z = s.z
    s.flash = Math.max(0, s.flash - dt * 3)
    s.glow += (Math.max(s.target, s.flash) - s.glow) * (1 - Math.exp(-dt * 12))
    if (skin.current) skin.current.emissiveIntensity = 0.1 + s.glow * 0.5
    for (let i = 0; i < SLOTS; i++) {
      const g = floats.current[i]
      const a = (s.ages[i] += dt)
      if (!g) continue
      g.visible = a < 1
      if (a >= 1) continue
      g.position.y = H / 2 + 0.06 * (1 - (1 - a) * (1 - a))
      g.scale.setScalar(a < 0.15 ? (a / 0.15) * 1.15 : a > 0.6 ? (1 - a) / 0.4 : 1)
    }
  })

  const tap = async () => {
    set(v + step)
    const s = st.current
    const now = performance.now()
    s.combo = now - s.tap < 450 ? Math.min(s.combo + 1, 12) : 0
    s.tap = now
    await Tone.start()
    synth.current ??= new Tone.Synth({ oscillator: { type: "square" }, envelope: { attack: 0.001, decay: 0.1, sustain: 0.1, release: 0.08 }, volume: -20 }).toDestination()
    const f = Tone.Frequency("B5").transpose(s.combo)
    const t = Tone.now()
    synth.current.triggerAttackRelease(f.toFrequency(), 0.07, t)
    synth.current.triggerAttackRelease(f.transpose(5).toFrequency(), 0.18, t + 0.07)
  }
  const near = (e: ThreeEvent<PointerEvent>) => {
    st.current.target = e.pointerType === "touch" ? Math.min(1, Math.max(0.35, 1.1 - e.distance * 9)) : 0.7
  }
  const down = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    st.current.down = true
  }
  const up = () => {
    st.current.down = false
  }

  const n = Math.round(shown)
  const sign = n < 0 ? "-" : ""
  const raw = `${Math.abs(n)}`
  const pad = "0".repeat(Math.max(0, Math.floor(digits) - raw.length - sign.length))
  const cells = [...`${sign}${pad}${raw}`]
  const width = Math.max(W, cells.length * CH * 0.002 + 0.04)

  return (
    <group>
      <group ref={body}>
        <mesh geometry={geometry} scale={[width / W, 1, 1]}>
          <meshStandardMaterial ref={skin} color="#15171E" emissive={tint} emissiveIntensity={0.15} roughness={0.45} metalness={0.15} />
        </mesh>
        <group position={[0, 0.032, D / 2 + 0.001]}>
          <Container pixelSize={0.002} pointerEvents="none">
            <Text fontSize={9} fontWeight="semi-bold" letterSpacing={2} color={color}>
              {label.toUpperCase()}
            </Text>
          </Container>
        </group>
        <group ref={num} position={[0, -0.01, D / 2 + 0.001]}>
          <Container pixelSize={0.002} pointerEvents="none" flexDirection="row">
            {cells.map((c, i) => {
              const lead = i >= sign.length && i < sign.length + pad.length // padding zeros stay faint
              return (
                <Container key={i} width={CH} justifyContent="center">
                  <Text fontSize={30} fontWeight="bold" color={lead ? "#6B7180" : "#EEF0F4"} opacity={lead ? 0.45 : 1}>
                    {c}
                  </Text>
                </Container>
              )
            })}
          </Container>
        </group>
      </group>
      {pops.map((t, i) => (
        <group key={i} ref={(g) => void (floats.current[i] = g)} position={[width / 2 - 0.05 + (i % 2) * 0.025, H / 2, 0.014]} visible={false}>
          <Container pixelSize={0.002} pointerEvents="none">
            <Text fontSize={16} fontWeight="bold" color={color}>
              {t}
            </Text>
          </Container>
        </group>
      ))}
      {/* Static hit box: the panel sinks on press, the hit surface must not, or a poke would re-trigger. */}
      <mesh
        visible={false}
        position={[0, 0, 0.002]}
        onPointerOver={near}
        onPointerMove={near}
        onPointerOut={() => {
          st.current.target = 0.15
          up()
        }}
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={tap}
      >
        <boxGeometry args={[width, H, D + 0.004]} />
      </mesh>
    </group>
  )
}
