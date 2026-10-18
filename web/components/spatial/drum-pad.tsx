"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import * as Tone from "tone"
import { CanvasTexture, SRGBColorSpace, type Group, type MeshBasicMaterial } from "three"
import { useFrame } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

type Sound = "kick" | "snare" | "hat" | "clap"
type Props = { sound?: Sound; onPress?: () => void; label?: string; accent?: string }

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

let rubber: CanvasTexture | undefined
// Soft-touch rubber matcap: a broad, dull highlight. Shades the same with or without scene lights.
function getRubber() {
  if (rubber) return rubber
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const g = c.getContext("2d")!
  const grad = g.createRadialGradient(56, 44, 4, 64, 64, 84)
  grad.addColorStop(0, "#c9ccd2")
  grad.addColorStop(0.5, "#8d929b")
  grad.addColorStop(1, "#33363c")
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  rubber = new CanvasTexture(c)
  rubber.colorSpace = SRGBColorSpace
  return rubber
}

/** 12 cm soft-touch drum pad. Hit it (poke, pinch or click) to play a kick, snare, hat or clap: the rubber squashes, glows and springs back. */
export default function DrumPad({ sound = "kick", onPress, label, accent = "#9FE7D2" }: Props) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const voice = useRef<ReturnType<typeof makeVoice> | null>(null)
  const geometry = useMemo(() => new RoundedBoxGeometry(0.12, 0.12, 0.016, 5, 0.008), [])
  const housing = useMemo(() => new RoundedBoxGeometry(0.136, 0.136, 0.012, 4, 0.006), [])
  const mc = useMemo(getRubber, [])
  const pad = useRef<Group>(null)
  const glow = useRef<MeshBasicMaterial>(null)
  const s = useRef({ z: 0, v: 0, glow: 0 })

  useEffect(
    () => () => {
      geometry.dispose()
      housing.dispose()
    },
    [geometry, housing],
  )
  useEffect(() => {
    const v = makeVoice(sound)
    voice.current = v
    return () => {
      v.dispose()
      voice.current = null
    }
  }, [sound])

  // Squash spring (z = 0 rest, 1 fully squashed) and a glow that decays after each hit.
  useFrame((state, delta) => {
    const g = pad.current
    if (!g) return
    const dt = Math.min(delta, 1 / 30)
    const k = s.current
    const target = down ? 1 : 0
    k.v += ((target - k.z) * 700 - k.v * 22) * dt
    k.z += k.v * dt
    const q = Math.max(-0.3, Math.min(1.2, k.z))
    g.scale.set(1 + q * 0.025, 1 + q * 0.025, 1 - q * 0.45)
    g.position.z = -q * 0.004 + (hover && !down ? 0.0015 : 0)
    k.glow *= Math.exp(-dt * (down ? 1.5 : 6))
    if (glow.current) glow.current.opacity = 0.3 + k.glow * 0.7 + (hover ? 0.15 : 0)
    if (Math.abs(target - k.z) > 1e-4 || Math.abs(k.v) > 1e-3 || k.glow > 1e-3) state.invalidate()
  })

  const hit = () => {
    void Tone.start() // browsers stay silent until a user gesture resumes audio
    voice.current?.hit(Tone.now())
    onPress?.()
    setDown(true)
    s.current.glow = 1
    s.current.v += 8 // a sharp strike, not a slow press
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
      <mesh geometry={housing} position={[0, 0, -0.012]}>
        <meshMatcapMaterial matcap={mc} color="#3E434E" />
      </mesh>
      {/* glow halo around the pad edge */}
      <mesh position={[0, 0, -0.0055]}>
        <planeGeometry args={[0.13, 0.13]} />
        <meshBasicMaterial ref={glow} color={accent} transparent opacity={0.3} toneMapped={false} />
      </mesh>
      <group ref={pad}>
        <mesh geometry={geometry}>
          <meshMatcapMaterial matcap={mc} color={hover ? "#8A909C" : "#737985"} />
        </mesh>
      </group>
      <group position={[0, -0.09, 0]}>
        <Container pixelSize={0.002} width={110} alignItems="center" justifyContent="center">
          <Text fontSize={12} fontWeight="semi-bold" color="#EEF0F4">
            {(label || sound).toUpperCase()}
          </Text>
        </Container>
      </group>
    </group>
  )
}
