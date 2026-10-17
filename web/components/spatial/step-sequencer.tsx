"use client"

import { useEffect, useRef, useState } from "react"
import * as Tone from "tone"
import { Container, Text } from "@react-three/uikit"

const ROWS = ["kick", "snare", "hat", "clap"] as const
type Sound = (typeof ROWS)[number]
type Props = { steps?: boolean[][]; onChange?: (steps: boolean[][]) => void }

const DEFAULT = ROWS.map((row) =>
  Array.from({ length: 16 }, (_, i) =>
    row === "kick" ? i % 4 === 0 : row === "snare" ? i === 4 || i === 12 : row === "hat" ? i % 2 === 0 : false,
  ),
)

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

/** 4 x 16 drum grid on the global Tone transport (start it with the Transport). Controlled via `steps`, or uncontrolled. */
export default function StepSequencer({ steps, onChange }: Props) {
  const [inner, setInner] = useState(DEFAULT)
  const [step, setStep] = useState(-1)
  const grid = steps ?? inner
  const latest = useRef(grid)

  useEffect(() => {
    latest.current = grid
  }, [grid])

  useEffect(() => {
    const voices = ROWS.map(makeVoice)
    const t = Tone.getTransport()
    const id = t.scheduleRepeat((time) => {
      // Step from the transport position, so every sequencer stays on the same grid.
      const s = Math.round(t.getTicksAtTime(time) / (t.PPQ / 4)) % 16
      voices.forEach((v, r) => latest.current[r]?.[s] && v.hit(time))
      Tone.getDraw().schedule(() => setStep(s), time)
    }, "16n")
    const reset = () => setStep(-1)
    t.on("stop", reset)
    return () => {
      t.clear(id)
      t.off("stop", reset)
      voices.forEach((v) => v.dispose())
    }
  }, [])

  const toggle = (r: number, i: number) => {
    void Tone.start() // browsers stay silent until a user gesture resumes audio
    const next = ROWS.map((_, row) =>
      Array.from({ length: 16 }, (_, c) => {
        const on = !!grid[row]?.[c]
        return row === r && c === i ? !on : on
      }),
    )
    if (steps === undefined) setInner(next)
    onChange?.(next)
  }

  return (
    <Container
      pixelSize={0.002}
      flexDirection="column"
      gap={4}
      padding={16}
      backgroundColor="#1A1B18"
      borderRadius={16}
    >
      {ROWS.map((name, r) => (
        <Container key={name} flexDirection="row" alignItems="center" gap={10}>
          <Text width={44} fontSize={12} color="#A3A49D">
            {name}
          </Text>
          {[0, 1, 2, 3].map((g) => (
            <Container key={g} flexDirection="row" gap={4}>
              {[0, 1, 2, 3].map((k) => {
                const i = g * 4 + k
                const on = !!grid[r]?.[i]
                const here = i === step
                return (
                  <Container
                    key={i}
                    width={22}
                    height={22}
                    borderRadius={4}
                    backgroundColor={on ? (here ? "#8AF5A8" : "#1FB54A") : here ? "#55564F" : g % 2 ? "#2C2D28" : "#363731"}
                    hover={{ backgroundColor: on ? "#27CC57" : "#45463F" }}
                    onClick={() => toggle(r, i)}
                  />
                )
              })}
            </Container>
          ))}
        </Container>
      ))}
    </Container>
  )
}
