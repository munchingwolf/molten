"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import * as Tone from "tone"
import { Color, DoubleSide, MathUtils, type Group, type MeshBasicMaterial } from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

type Props = { value?: boolean; onChange?: (playing: boolean) => void; color?: string }

// 4 bars of eighth notes: Am7 → Fmaj7 → C → G arpeggios over a soft kick and bass.
const CHORDS = [
  ["A3", "C4", "E4", "G4"],
  ["F3", "A3", "C4", "E4"],
  ["C4", "E4", "G4", "B4"],
  ["G3", "B3", "D4", "F#4"],
]
const BASS = ["A1", "F1", "C2", "G1"]
const ARP = [0, 1, 2, 3, 2, 1, 2, 3]

function makeRig() {
  const meter = new Tone.Meter({ normalRange: true, smoothing: 0.6 })
  const out = new Tone.Gain(0.9).toDestination()
  out.connect(meter)
  const keys = new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.005, decay: 0.25, sustain: 0.15, release: 0.5 }, volume: -12 }).connect(out)
  const bass = new Tone.MonoSynth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.4 },
    filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.5, baseFrequency: 200, octaves: 2 },
    volume: -10,
  }).connect(out)
  const kick = new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 5, envelope: { attack: 0.001, decay: 0.3, sustain: 0 }, volume: -8 }).connect(out)
  return {
    meter,
    play(step: number, time: number, dur: number) {
      const bar = Math.floor(step / 8) % 4
      const i = step % 8
      keys.triggerAttackRelease(CHORDS[bar][ARP[i]], dur * 0.9, time)
      if (i === 0 || i === 3) bass.triggerAttackRelease(BASS[bar], dur * (i === 0 ? 2.5 : 1), time)
      if (i === 0 || i === 4) kick.triggerAttackRelease("C1", "8n", time)
    },
    dispose() {
      keys.dispose()
      bass.dispose()
      kick.dispose()
      out.dispose()
      meter.dispose()
    },
  }
}

const LED_OFF = new Color("#242833")
const LED_ON = new Color("#9FE7D2")

/** 32 cm bookshelf speaker. Press it (poke, pinch or click) to play a looping chord groove; the woofer pumps with the music. Controlled via `value`, or uncontrolled. */
export default function Speaker({ value, onChange, color = "#1A1D24" }: Props) {
  const [inner, setInner] = useState(false)
  const [hover, setHover] = useState(false)
  const playing = value ?? inner
  const rig = useRef<ReturnType<typeof makeRig> | null>(null)
  const cone = useRef<Group>(null)
  const ring = useRef<MeshBasicMaterial>(null)
  const level = useRef(0)
  const cabinet = useMemo(() => new RoundedBoxGeometry(0.2, 0.32, 0.22, 4, 0.014), [])
  useEffect(() => () => cabinet.dispose(), [cabinet])

  useEffect(
    () => () => {
      rig.current?.dispose()
      rig.current = null
    },
    [],
  )

  // Own lookahead scheduler at the shared transport tempo: plays in time with the DAW without starting or stopping its transport.
  useEffect(() => {
    if (!playing) return
    void Tone.start()
    const r = (rig.current ??= makeRig())
    let step = 0
    let next = Tone.now() + 0.06
    const tick = () => {
      const dur = 30 / Tone.getTransport().bpm.value
      while (next < Tone.now() + 0.2) {
        r.play(step++, next, dur)
        next += dur
      }
    }
    tick()
    const id = setInterval(tick, 50)
    return () => clearInterval(id)
  }, [playing])

  const toggle = async () => {
    await Tone.start() // browsers stay silent until a user gesture resumes audio
    if (value === undefined) setInner(!playing)
    onChange?.(!playing)
  }

  useFrame((_, dt) => {
    let target = 0
    if (playing && rig.current) {
      const g = rig.current.meter.getValue()
      target = MathUtils.clamp((Tone.gainToDb(Array.isArray(g) ? Math.max(...g) : g) + 36) / 36, 0, 1)
    }
    level.current = MathUtils.damp(level.current, target, 25, Math.min(dt, 0.1))
    const l = level.current
    if (cone.current) cone.current.position.z = 0.1 + l * 0.009
    ring.current?.color.copy(LED_OFF).lerp(LED_ON, playing ? 0.35 + 0.65 * l : hover ? 0.2 : 0)
  })

  return (
    <group onClick={toggle} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
      <mesh geometry={cabinet}>
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.15} />
      </mesh>
      {/* Front baffle */}
      <mesh position={[0, 0, 0.1105]}>
        <planeGeometry args={[0.18, 0.3]} />
        <meshStandardMaterial color="#0F1116" roughness={0.85} />
      </mesh>
      {/* Woofer: rubber surround, cone + dust cap move together */}
      <group position={[0, -0.045, 0]}>
        <mesh position={[0, 0, 0.111]}>
          <torusGeometry args={[0.062, 0.008, 10, 48]} />
          <meshStandardMaterial color="#15171E" roughness={0.7} />
        </mesh>
        <group ref={cone} position={[0, 0, 0.1]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <coneGeometry args={[0.056, 0.026, 40, 1, true]} />
            <meshStandardMaterial color="#20232B" roughness={0.75} side={DoubleSide} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.006]}>
            <sphereGeometry args={[0.02, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#2A2F3A" roughness={0.4} metalness={0.3} />
          </mesh>
        </group>
        {/* Light ring: brightens with the music */}
        <mesh position={[0, 0, 0.1112]}>
          <ringGeometry args={[0.074, 0.078, 64]} />
          <meshBasicMaterial ref={ring} color={LED_OFF} toneMapped={false} />
        </mesh>
      </group>
      {/* Tweeter */}
      <group position={[0, 0.088, 0.1108]}>
        <mesh>
          <torusGeometry args={[0.024, 0.004, 8, 32]} />
          <meshStandardMaterial color="#15171E" roughness={0.5} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <sphereGeometry args={[0.016, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#9AA0AD" roughness={0.25} metalness={0.6} />
        </mesh>
      </group>
      {/* Power LED */}
      <mesh position={[0.07, -0.135, 0.1108]}>
        <circleGeometry args={[0.0035, 16]} />
        <meshBasicMaterial color={playing ? "#9FE7D2" : "#323745"} toneMapped={false} />
      </mesh>
    </group>
  )
}
