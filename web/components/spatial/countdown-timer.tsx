"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { Pause, Play, RotateCcw } from "@react-three/uikit-lucide"
import * as Tone from "tone"
import { Color, type Group, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial } from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

type Props = { seconds?: number; autoStart?: boolean; value?: number; color?: string; onChange?: (v: number) => void; onComplete?: () => void }

const W = 0.2
const H = 0.17
const D = 0.018
const BAR = 0.16
const RED = new Color("#FF5A6A")
const ALARM = ["C6", "E6", "G6", "C7", "C6", "E6", "G6", "C7"]
const pad2 = (n: number) => `${n}`.padStart(2, "0")

/** 20 × 17 cm countdown panel with a draining progress bar, play/pause and reset. Beeps through the last 5 s, alarms and shakes at zero. */
export default function CountdownTimer({ seconds = 30, autoStart = false, value, color = "#9FE7D2", onChange, onComplete }: Props) {
  const total = seconds > 0 ? Math.round(seconds) : 30
  const [inner, setInner] = useState(total)
  const v = Math.max(0, Math.round(value ?? inner))
  const [running, setRunning] = useState(autoStart)
  const set = (n: number) => {
    if (value === undefined) setInner(n)
    onChange?.(n)
  }
  const root = useRef<Group>(null)
  const fill = useRef<Mesh>(null)
  const fillMat = useRef<MeshBasicMaterial>(null)
  const skin = useRef<MeshStandardMaterial>(null)
  // The clock lives here (rem, in seconds); React only hears about whole-second changes.
  const st = useRef({ rem: v, sec: v, run: autoStart, total, shake: 0, flash: 0, time: 0 })
  const synth = useRef<Tone.PolySynth | null>(null)
  const geometry = useMemo(() => new RoundedBoxGeometry(W, H, D, 4, 0.009), [])
  const tint = useMemo(() => new Color(color), [color])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => void synth.current?.dispose(), [])

  // A value from outside (controlled use) moves the clock; a new `seconds` resets it.
  useEffect(() => {
    const s = st.current
    if (v !== s.sec) Object.assign(s, { rem: v, sec: v })
  }, [v])
  useEffect(() => {
    const s = st.current
    if (s.total === total) return
    Object.assign(s, { total, rem: total, sec: total })
    set(total)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total])

  const play = (notes: string[], gap: number, len: number) => {
    if (Tone.getContext().state !== "running") return // never start audio without a gesture
    synth.current ??= new Tone.PolySynth(Tone.Synth, { oscillator: { type: "triangle" }, envelope: { attack: 0.003, decay: 0.15, sustain: 0.1, release: 0.15 }, volume: -12 }).toDestination()
    const t = Tone.now()
    notes.forEach((n, i) => synth.current?.triggerAttackRelease(n, len, t + i * gap))
  }

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    s.time += dt
    if (s.run) {
      s.rem = Math.max(0, s.rem - delta)
      const sec = Math.ceil(s.rem)
      if (sec !== s.sec) {
        s.sec = sec
        set(sec)
        if (sec === 0) {
          Object.assign(s, { run: false, flash: 1, shake: 1 })
          setRunning(false)
          play(ALARM, 0.08, 0.1)
          onComplete?.()
        } else if (sec <= 5) play([sec === 1 ? "E6" : "A5"], 0, 0.08)
      }
    }
    const k = Math.min(1, s.rem / s.total)
    if (fill.current) {
      fill.current.scale.x = Math.max(1e-4, k)
      fill.current.position.x = (BAR * k - BAR) / 2
    }
    const hot = s.sec <= 5 ? (s.run ? 0.7 + 0.3 * Math.sin(s.time * 9) : 1) : 0
    fillMat.current?.color.copy(tint).lerp(RED, hot)
    s.flash = Math.max(0, s.flash - dt * 1.5)
    if (skin.current) {
      skin.current.emissive.copy(tint).lerp(RED, s.flash)
      skin.current.emissiveIntensity = 0.1 + s.flash * 0.9
    }
    s.shake = Math.max(0, s.shake - dt * 2.5)
    if (root.current) root.current.position.x = Math.sin(s.time * 85) * 0.006 * s.shake
  })

  const toggle = async () => {
    const s = st.current
    if (!s.run && s.rem <= 0) {
      Object.assign(s, { rem: s.total, sec: s.total })
      set(s.total)
    }
    s.run = !s.run
    setRunning(s.run)
    await Tone.start()
    play([s.run ? "E5" : "A4"], 0, 0.05)
  }
  const reset = async () => {
    const s = st.current
    Object.assign(s, { run: false, rem: s.total })
    setRunning(false)
    if (s.sec !== s.total) {
      s.sec = s.total
      set(s.total)
    }
    await Tone.start()
    play(["C5"], 0, 0.05)
  }

  const time = `${pad2(Math.floor(v / 60))}:${pad2(v % 60)}`
  const digitColor = v === 0 || (running && v <= 5) ? "#FF5A6A" : "#EEF0F4"

  return (
    <group ref={root}>
      <mesh geometry={geometry}>
        <meshStandardMaterial ref={skin} color="#15171E" emissive={tint} emissiveIntensity={0.1} roughness={0.5} metalness={0.15} />
      </mesh>
      <group position={[0, 0.04, D / 2 + 0.001]}>
        <Container pixelSize={0.002} pointerEvents="none" flexDirection="row" alignItems="center">
          {[...time].map((c, i) => (
            // fixed cells give the digits a tabular look, so the readout doesn't wobble as it counts
            <Container key={i} width={c === ":" ? 9 : 17} justifyContent="center">
              <Text fontSize={30} fontWeight="bold" color={c === ":" ? "#6B7180" : digitColor}>
                {c}
              </Text>
            </Container>
          ))}
        </Container>
      </group>
      <mesh position={[0, -0.006, D / 2 + 0.001]}>
        <planeGeometry args={[BAR, 0.008]} />
        <meshBasicMaterial color="#242833" />
      </mesh>
      <mesh ref={fill} position={[0, -0.006, D / 2 + 0.0015]}>
        <planeGeometry args={[BAR, 0.008]} />
        <meshBasicMaterial ref={fillMat} color={color} toneMapped={false} />
      </mesh>
      <group position={[0, -0.048, D / 2 + 0.001]}>
        <Container pixelSize={0.002} flexDirection="row" gap={8}>
          <Container
            onClick={toggle}
            width={46}
            height={26}
            borderRadius={8}
            alignItems="center"
            justifyContent="center"
            backgroundColor={color}
            active={{ transformScaleX: 0.93, transformScaleY: 0.93 }}
          >
            {running ? <Pause width={14} height={14} color="#06221B" /> : <Play width={14} height={14} color="#06221B" />}
          </Container>
          <Container
            onClick={reset}
            width={26}
            height={26}
            borderRadius={8}
            alignItems="center"
            justifyContent="center"
            backgroundColor="#242833"
            borderWidth={1}
            borderColor="#323745"
            hover={{ backgroundColor: "#323745" }}
            active={{ transformScaleX: 0.93, transformScaleY: 0.93 }}
          >
            <RotateCcw width={13} height={13} color="#EEF0F4" />
          </Container>
        </Container>
      </group>
    </group>
  )
}
