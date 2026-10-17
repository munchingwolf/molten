"use client"

import { useEffect, useRef, useState } from "react"
import * as Tone from "tone"

const WHITE = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]
const BLACK: [string, number][] = [["C#4", 0], ["D#4", 1], ["F#4", 3], ["G#4", 4], ["A#4", 5]] // note, white key to its left
const STEP = 0.027 // white key 2.6 cm + 1 mm gap

type Props = { onPress?: (note: string) => void }

type KeyProps = { note: string; x: number; black: boolean; onDown: (note: string) => void; onUp: (note: string) => void }

function Key({ note, x, black, onDown, onUp }: KeyProps) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const [w, h, d] = black ? [0.016, 0.07, 0.014] : [0.026, 0.11, 0.012]
  const y = black ? 0.02 : 0
  const z = black ? 0.013 : 0 // black keys sit raised, in front of the white keys
  const release = () => {
    setDown(false)
    onUp(note)
  }
  const color = down ? "#1FB54A" : black ? (hover ? "#3A3B35" : "#1A1B18") : hover ? "#D6D3C9" : "#ECE9DF"

  return (
    <group position={[x, y, z]}>
      {/* Static hit box: the key moves back on press, the hit surface must not, or a poke would re-trigger. */}
      <mesh
        visible={false}
        position={[0, 0, 0.002]}
        onPointerDown={() => {
          setDown(true)
          onDown(note)
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => {
          setHover(false)
          release()
        }}
      >
        <boxGeometry args={[w, h, d + 0.004]} />
      </mesh>
      <mesh position={[0, 0, down ? -0.005 : 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
    </group>
  )
}

/** One octave (C4-C5) of pokeable piano keys. Notes sustain while held. */
export default function PianoKeys({ onPress }: Props) {
  const synth = useRef<Tone.PolySynth | null>(null)
  const held = useRef(new Set<string>())

  useEffect(() => {
    const s = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.4, release: 0.6 },
      volume: -8,
    }).toDestination()
    synth.current = s
    return () => {
      s.dispose()
      synth.current = null
    }
  }, [])

  const down = (note: string) => {
    void Tone.start() // browsers stay silent until a user gesture resumes audio
    synth.current?.triggerAttack(note, Tone.now())
    held.current.add(note)
    onPress?.(note)
  }
  const up = (note: string) => {
    if (held.current.delete(note)) synth.current?.triggerRelease(note, Tone.now())
  }

  const x0 = -((WHITE.length - 1) * STEP) / 2
  return (
    <group>
      <mesh position={[0, 0, -0.012]}>
        <boxGeometry args={[WHITE.length * STEP + 0.016, 0.126, 0.01]} />
        <meshStandardMaterial color="#1A1B18" roughness={0.8} />
      </mesh>
      {WHITE.map((note, i) => (
        <Key key={note} note={note} x={x0 + i * STEP} black={false} onDown={down} onUp={up} />
      ))}
      {BLACK.map(([note, i]) => (
        <Key key={note} note={note} x={x0 + (i + 0.5) * STEP} black onDown={down} onUp={up} />
      ))}
    </group>
  )
}
