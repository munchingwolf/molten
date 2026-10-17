"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import * as Tone from "tone"
import { Container, Text } from "@react-three/uikit"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

type Sound = "kick" | "snare" | "hat" | "clap"
type Props = { sound?: Sound; onPress?: () => void; label?: string }

function makeVoice(sound: Sound): { hit: (time: number) => void; dispose: () => void } {
  if (sound === "snare") {
    const noise = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.15, sustain: 0 }, volume: -12 }).toDestination()
    const body = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { attack: 0.001, decay: 0.1, sustain: 0 }, volume: -10 }).toDestination()
    return {
      hit: (t) => {
        noise.triggerAttackRelease(0.15, t)
        body.triggerAttackRelease("E2", 0.1, t)
      },
      dispose: () => (noise.dispose(), body.dispose()),
    }
  }
  if (sound === "hat" || sound === "clap") {
    const hat = sound === "hat"
    const filter = new Tone.Filter({ frequency: hat ? 8000 : 1500, type: hat ? "highpass" : "bandpass", Q: hat ? 1 : 1.5 }).toDestination()
    const len = hat ? 0.05 : 0.2
    const noise = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: len, sustain: 0 }, volume: hat ? -14 : -4 }).connect(filter)
    return { hit: (t) => noise.triggerAttackRelease(len, t), dispose: () => (noise.dispose(), filter.dispose()) }
  }
  const kick = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: 0.4, sustain: 0 }, volume: -4 }).toDestination()
  return { hit: (t) => kick.triggerAttackRelease("C1", "8n", t), dispose: () => kick.dispose() }
}

/** 12 cm drum pad. Hit it (poke, pinch or click) to play a kick, snare, hat or clap. */
export default function DrumPad({ sound = "kick", onPress, label }: Props) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const [flash, setFlash] = useState(false)
  const voice = useRef<ReturnType<typeof makeVoice> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const geometry = useMemo(() => new RoundedBoxGeometry(0.12, 0.12, 0.016, 4, 0.012), [])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => {
    const v = makeVoice(sound)
    voice.current = v
    return () => {
      v.dispose()
      voice.current = null
    }
  }, [sound])

  const hit = () => {
    void Tone.start() // browsers stay silent until a user gesture resumes audio
    voice.current?.hit(Tone.now())
    onPress?.()
    setDown(true)
    setFlash(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setFlash(false), 120)
  }
  const up = () => setDown(false)

  return (
    <group>
      {/* Static hit box in front of the pad: the pad moves back on press, the hit surface must not, or a poke would re-trigger. */}
      <mesh
        visible={false}
        position={[0, 0, 0.006]}
        onPointerDown={hit}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => {
          setHover(false)
          up()
        }}
      >
        <boxGeometry args={[0.12, 0.12, 0.028]} />
      </mesh>
      <mesh geometry={geometry} position={[0, 0, down ? -0.005 : 0]}>
        <meshStandardMaterial color={down || flash ? "#1FB54A" : hover ? "#3A3B35" : "#2A2B26"} roughness={0.6} />
      </mesh>
      <group position={[0, -0.08, 0]}>
        <Container pixelSize={0.002} flexDirection="column" alignItems="center">
          <Text fontSize={14} color="#ECE9DF">
            {label ?? sound}
          </Text>
        </Container>
      </group>
    </group>
  )
}
