"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import * as Tone from "tone"

type Wave = "sine" | "triangle" | "square" | "sawtooth"
const SAMPLES = 1024 // analyser buffer
const SHOW = 384 // samples drawn, starting at the trigger point
const W = 0.34
const H = 0.2

type Props = {
  /** Loop on/off. Controlled, or uncontrolled (tap the screen to toggle). */
  playing?: boolean
  onChange?: (playing: boolean) => void
  /** Oscillator shape of the built-in loop */
  wave?: Wave
  color?: string
  /** Vertical gain of the trace */
  gain?: number
  label?: string
}

// Flat ribbon along x, two vertices per sample; y is rewritten every frame.
function ribbon(n: number) {
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3))
  const idx: number[] = []
  for (let i = 0; i < n - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
  g.setIndex(idx)
  return g
}

/** 34 cm oscilloscope: a glowing waveform trace from an analyser on a built-in bass + arp loop. Tap the screen to start or stop. */
export default function Oscilloscope({ playing, onChange, wave = "sawtooth", color = "#9FE7D2", gain = 1, label = "Scope" }: Props) {
  const [inner, setInner] = useState(false)
  const on = playing ?? inner
  const onRef = useRef(on)
  onRef.current = on
  const analyser = useRef<Tone.Analyser | null>(null)
  const synths = useRef<Tone.Synth[]>([])
  const core = useMemo(() => ribbon(SHOW), [])
  const glow = useMemo(() => ribbon(SHOW), [])
  const grid = useMemo(() => {
    const p: number[] = []
    for (let i = -4; i <= 4; i++) p.push((i * W) / 8, -H / 2, 0, (i * W) / 8, H / 2, 0)
    for (let j = -2; j <= 2; j++) p.push(-W / 2, (j * H) / 4, 0, W / 2, (j * H) / 4, 0)
    return new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(p, 3))
  }, [])
  useEffect(() => () => (core.dispose(), glow.dispose(), grid.dispose()), [core, glow, grid])

  useEffect(() => {
    const an = new Tone.Analyser({ type: "waveform", size: SAMPLES })
    const out = new Tone.Gain(1).fan(an, Tone.getDestination())
    const bass = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.6, release: 0.2 }, volume: -8 }).connect(out)
    const arp = new Tone.Synth({ oscillator: { type: wave }, envelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.1 }, volume: -16 }).connect(out)
    synths.current = [bass, arp]
    analyser.current = an
    const roots = ["A1", "F1", "C2", "G1"]
    const chords = [["A3", "C4", "E4"], ["F3", "A3", "C4"], ["C4", "E4", "G4"], ["G3", "B3", "D4"]]
    const t = Tone.getTransport()
    const id = t.scheduleRepeat((time) => {
      if (!onRef.current) return
      const pos = Math.round(t.getTicksAtTime(time) / (t.PPQ / 4))
      const step = pos % 16
      const bar = Math.floor(pos / 16) % 4
      if (step % 8 === 0) bass.triggerAttackRelease(roots[bar], "4n", time)
      if (step % 2 === 0) arp.triggerAttackRelease(chords[bar][[0, 1, 2, 1][(step / 2) % 4]], "16n", time)
    }, "16n")
    return () => {
      t.clear(id)
      bass.dispose()
      arp.dispose()
      out.dispose()
      an.dispose()
      analyser.current = null
      synths.current = []
    }
  }, [])

  useEffect(() => void synths.current[1]?.set({ oscillator: { type: wave } }), [wave])

  useFrame(({ clock }) => {
    const data = analyser.current?.getValue() as Float32Array | undefined
    // Trigger on the first rising zero crossing so the trace stands still, like a real scope.
    let start = 0
    if (data) for (let i = 1; i < SAMPLES - SHOW; i++) if (data[i - 1] < 0 && data[i] >= 0) { start = i; break }
    const write = (g: THREE.BufferGeometry, half: number) => {
      const a = g.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < SHOW; i++) {
        // Idle: a faint breathing line, so the screen never looks dead.
        const s = data && onRef.current ? data[start + i] : Math.sin(i * 0.05 + clock.elapsedTime * 2) * 0.03
        const x = -W / 2 + (i / (SHOW - 1)) * W
        const y = Math.max(-1, Math.min(1, s * gain * 1.6)) * (H / 2 - 0.01)
        a.setXYZ(i * 2, x, y + half, 0)
        a.setXYZ(i * 2 + 1, x, y - half, 0)
      }
      a.needsUpdate = true
    }
    write(core, 0.0012)
    write(glow, 0.006)
  })

  const toggle = async () => {
    const next = !on
    if (playing === undefined) setInner(next)
    onChange?.(next)
    await Tone.start() // browsers stay silent until a user gesture resumes audio
    if (next && Tone.getTransport().state !== "started") Tone.getTransport().start()
  }

  return (
    <group>
      <mesh position={[0, -0.01, -0.012]}>
        <boxGeometry args={[W + 0.04, H + 0.06, 0.02]} />
        <meshStandardMaterial color="#15171E" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh onClick={toggle}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial color="#05080A" />
      </mesh>
      <lineSegments geometry={grid} position={[0, 0, 0.001]} raycast={() => null}>
        <lineBasicMaterial color={color} transparent opacity={0.12} />
      </lineSegments>
      <mesh geometry={glow} position={[0, 0, 0.002]} raycast={() => null} frustumCulled={false}>
        <meshBasicMaterial color={color} transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh geometry={core} position={[0, 0, 0.003]} raycast={() => null} frustumCulled={false}>
        <meshBasicMaterial color="#EEF0F4" side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <group position={[0, -H / 2 - 0.02, 0.001]}>
        <Container pixelSize={0.002} flexDirection="row" gap={10} alignItems="center" pointerEvents="none">
          <Text fontSize={13} fontWeight="semi-bold" color="#EEF0F4">
            {label}
          </Text>
          <Text fontSize={11} color="#9AA0AD">
            {on ? `${wave} · tap to stop` : "Tap to play"}
          </Text>
        </Container>
      </group>
    </group>
  )
}
