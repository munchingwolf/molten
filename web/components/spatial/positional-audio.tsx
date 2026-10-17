"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { PositionalAudio, RoundedBox } from "@react-three/drei"

type Props = {
  color?: string
  /** Blip pitch in Hz */
  pitch?: number
  /** 0–1 */
  volume?: number
  /** Distance in metres at which the sound starts to fall off */
  distance?: number
}

/** Synthesise a short pitch-drop blip as a 16-bit mono WAV data URL (no audio files needed). */
function blipUrl(pitch: number) {
  const rate = 22050
  const n = Math.floor(rate * 0.35)
  const buf = new DataView(new ArrayBuffer(44 + n * 2))
  const str = (o: number, s: string) => [...s].forEach((ch, i) => buf.setUint8(o + i, ch.charCodeAt(0)))
  str(0, "RIFF")
  buf.setUint32(4, 36 + n * 2, true)
  str(8, "WAVEfmt ")
  buf.setUint32(16, 16, true)
  buf.setUint16(20, 1, true) // PCM
  buf.setUint16(22, 1, true) // mono
  buf.setUint32(24, rate, true)
  buf.setUint32(28, rate * 2, true)
  buf.setUint16(32, 2, true)
  buf.setUint16(34, 16, true)
  str(36, "data")
  buf.setUint32(40, n * 2, true)
  let phase = 0
  for (let i = 0; i < n; i++) {
    const t = i / rate
    phase += (2 * Math.PI * pitch * (1 + 0.6 * Math.exp(-t * 30))) / rate
    const env = Math.min(1, t * 400) * Math.exp(-t * 9)
    const v = (Math.sin(phase) + 0.25 * Math.sin(phase * 2)) * env * 0.7
    buf.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 32767, true)
  }
  let bin = ""
  const bytes = new Uint8Array(buf.buffer)
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return `data:audio/wav;base64,${btoa(bin)}`
}

/** A little speaker that plays a synthesised blip from its position in space (drei <PositionalAudio>): it gets quieter and pans as you move. Tap to play. */
export default function PositionalAudioSpeaker({ color = "#9FE7D2", pitch = 660, volume = 0.8, distance = 0.5 }: Props) {
  const url = useMemo(() => blipUrl(pitch), [pitch])
  const sound = useRef<THREE.PositionalAudio>(null)
  const cone = useRef<THREE.Mesh>(null)
  const pulse = useRef(0)
  const [hover, setHover] = useState(false)

  useEffect(() => {
    sound.current?.setVolume(volume)
  }, [volume, url])

  useFrame((_, dt) => {
    pulse.current = Math.max(0, pulse.current - dt * 3)
    if (cone.current) cone.current.position.z = 0.026 + Math.sin(pulse.current * Math.PI * 6) * pulse.current * 0.004
  })

  const play = () => {
    const s = sound.current
    pulse.current = 1
    if (!s?.buffer) return
    if (s.context.state === "suspended") void s.context.resume()
    if (s.isPlaying) s.stop()
    s.setVolume(volume)
    s.play()
  }

  return (
    <group onClick={play} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
      <RoundedBox args={[0.1, 0.14, 0.05]} radius={0.01} smoothness={3}>
        <meshStandardMaterial color="#15171E" roughness={0.7} emissive={color} emissiveIntensity={hover ? 0.08 : 0} />
      </RoundedBox>
      <mesh ref={cone} position={[0, -0.012, 0.026]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.004, 40]} />
        <meshStandardMaterial color="#2a2d36" roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.012, 0.029]}>
        <circleGeometry args={[0.012, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hover ? 0.9 : 0.4} />
      </mesh>
      <mesh position={[0, 0.045, 0.026]}>
        <circleGeometry args={[0.004, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <Suspense fallback={null}>
        <PositionalAudio ref={sound} url={url} distance={distance} loop={false} autoplay={false} />
      </Suspense>
    </group>
  )
}
