"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import * as Tone from "tone"

const BARS = 32
const W = 0.4 // metres
const MAX_H = 0.18
const FFT = 256

type Props = {
  /** Loop on/off. Controlled, or uncontrolled (tap to toggle). */
  playing?: boolean
  onChange?: (playing: boolean) => void
  color?: string
  color2?: string
  /** Bar height multiplier */
  gain?: number
  label?: string
}

// Built-in loop: kick, hats, saw bass and a triangle hook in A minor, so the bars always have something to show.
function makeLoop(out: Tone.ToneAudioNode) {
  const kick = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: 0.4, sustain: 0 }, volume: -6 }).connect(out)
  const hf = new Tone.Filter(8000, "highpass").connect(out)
  const hat = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.05, sustain: 0 }, volume: -18 }).connect(hf)
  const bass = new Tone.MonoSynth({
    oscillator: { type: "sawtooth" },
    filter: { Q: 2, type: "lowpass", rolloff: -24 },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0.4, release: 0.15 },
    filterEnvelope: { attack: 0.002, decay: 0.15, sustain: 0.2, release: 0.2, baseFrequency: 120, octaves: 3 },
    volume: -12,
  }).connect(out)
  const lead = new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.002, decay: 0.15, sustain: 0, release: 0.05 }, volume: -12 }).connect(out)
  const roots = ["A1", "F1", "C2", "G1"]
  const hook = ["A4", "C5", "E5", "C5", "F4", "A4", "C5", "A4", "C5", "E5", "G5", "E5", "B4", "D5", "G4", "D5"]
  return {
    play(step: number, bar: number, t: number) {
      if (step % 4 === 0) kick.triggerAttackRelease("C1", "8n", t)
      if (step % 2 === 0) hat.triggerAttackRelease(0.05, t, step % 4 === 2 ? 1 : 0.4)
      if ([0, 3, 6, 10].includes(step)) bass.triggerAttackRelease(roots[bar], "16n", t)
      if (step % 4 === 2) lead.triggerAttackRelease(hook[(bar * 4 + step / 4 - 0.5) | 0], "16n", t)
    },
    dispose: () => [kick, hf, hat, bass, lead].forEach((n) => n.dispose()),
  }
}

/** 40 cm 3D spectrum: 32 bars driven by a WebAudio analyser on a built-in loop. Tap it to start or stop the music. */
export default function AudioVisualizer({ playing, onChange, color = "#9FE7D2", color2 = "#7FE3FF", gain = 1, label = "Spectrum" }: Props) {
  const [inner, setInner] = useState(false)
  const on = playing ?? inner
  const onRef = useRef(on)
  onRef.current = on
  const analyser = useRef<Tone.Analyser | null>(null)
  const bars = useRef<THREE.InstancedMesh>(null)
  const levels = useMemo(() => new Float32Array(BARS), [])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), c: new THREE.Color(), a: new THREE.Color(), b: new THREE.Color() }), [])

  useEffect(() => {
    const an = new Tone.Analyser({ type: "fft", size: FFT, smoothing: 0.75 })
    const out = new Tone.Gain(1).fan(an, Tone.getDestination())
    const loop = makeLoop(out)
    analyser.current = an
    const t = Tone.getTransport()
    const id = t.scheduleRepeat((time) => {
      if (!onRef.current) return
      const pos = Math.round(t.getTicksAtTime(time) / (t.PPQ / 4))
      loop.play(pos % 16, Math.floor(pos / 16) % 4, time)
    }, "16n")
    return () => {
      t.clear(id)
      loop.dispose()
      out.dispose()
      an.dispose()
      analyser.current = null
    }
  }, [])

  useFrame((_, dt) => {
    const mesh = bars.current
    if (!mesh) return
    const data = analyser.current?.getValue() as Float32Array | undefined
    tmp.a.set(color)
    tmp.b.set(color2)
    for (let i = 0; i < BARS; i++) {
      let target = 0
      if (data && onRef.current) {
        // Log-spaced bins so bass and treble get equal room.
        const lo = Math.floor(Math.pow(FFT / 2, i / BARS))
        const hi = Math.max(lo + 1, Math.floor(Math.pow(FFT / 2, (i + 1) / BARS)))
        let db = -Infinity
        for (let k = lo; k < hi && k < data.length; k++) db = Math.max(db, data[k])
        target = Math.min(1, Math.max(0, (db + 90) / 70)) * gain
      }
      levels[i] += (target - levels[i]) * Math.min(1, dt * (target > levels[i] ? 30 : 8))
      const h = 0.004 + levels[i] * MAX_H
      const x = -W / 2 + (i + 0.5) * (W / BARS)
      tmp.m.makeScale((W / BARS) * 0.7, h, 0.012).setPosition(x, h / 2 + 0.006, 0)
      mesh.setMatrixAt(i, tmp.m)
      tmp.c.copy(tmp.a).lerp(tmp.b, i / (BARS - 1)).multiplyScalar(0.35 + levels[i] * 0.9)
      mesh.setColorAt(i, tmp.c)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
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
      {/* One hit volume over the whole device: tap anywhere to toggle. */}
      <mesh visible={false} position={[0, MAX_H / 2, 0]} onClick={toggle}>
        <boxGeometry args={[W + 0.04, MAX_H + 0.04, 0.05]} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[W + 0.04, 0.012, 0.06]} />
        <meshStandardMaterial color="#15171E" roughness={0.6} metalness={0.2} />
      </mesh>
      <instancedMesh ref={bars} args={[undefined, undefined, BARS]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        {/* Created up front so the shader compiles with instance colours. */}
        <instancedBufferAttribute attach="instanceColor" args={[new Float32Array(BARS * 3), 3]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <group position={[0, -0.03, 0.031]}>
        <Container pixelSize={0.002} flexDirection="row" gap={10} alignItems="center" pointerEvents="none">
          <Text fontSize={14} fontWeight="semi-bold" color="#EEF0F4">
            {label}
          </Text>
          <Text fontSize={11} color="#9AA0AD">
            {on ? "Tap to stop" : "Tap to play"}
          </Text>
        </Container>
      </group>
    </group>
  )
}
