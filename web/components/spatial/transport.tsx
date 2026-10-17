"use client"

import { useEffect, useState } from "react"
import * as Tone from "tone"
import { Container, Text } from "@react-three/uikit"

type Props = { playing?: boolean; onChange?: (playing: boolean) => void; bpm?: number; click?: boolean }

/** Play/Stop for the global Tone transport, with an optional metronome `click`. Controlled via `playing`, or uncontrolled. */
export default function Transport({ playing, onChange, bpm = 120, click = false }: Props) {
  const [inner, setInner] = useState(false)
  const on = playing ?? inner
  const tempo = Number.isFinite(bpm) ? Math.min(300, Math.max(20, bpm)) : null

  useEffect(() => {
    if (tempo !== null) Tone.getTransport().bpm.value = tempo
  }, [tempo])

  useEffect(() => {
    if (!click) return
    const t = Tone.getTransport()
    const synth = new Tone.Synth({
      oscillator: { type: "square" },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 },
      volume: -14,
    }).toDestination()
    const id = t.scheduleRepeat((time) => {
      const downbeat = Math.round(t.getTicksAtTime(time) / t.PPQ) % 4 === 0
      synth.triggerAttackRelease(downbeat ? "C6" : "G5", 0.03, time)
    }, "4n")
    return () => {
      t.clear(id)
      synth.dispose()
    }
  }, [click])

  useEffect(() => {
    const t = Tone.getTransport()
    if (on) t.start()
    else if (t.state === "started") t.stop()
  }, [on])

  const toggle = async () => {
    await Tone.start() // browsers only allow audio after a user gesture
    if (playing === undefined) setInner(!on)
    onChange?.(!on)
  }

  return (
    <Container
      pixelSize={0.002}
      flexDirection="row"
      alignItems="center"
      gap={20}
      padding={16}
      backgroundColor="#1A1B18"
      borderRadius={16}
    >
      <Container
        onClick={toggle}
        width={112}
        height={56}
        borderRadius={12}
        alignItems="center"
        justifyContent="center"
        backgroundColor={on ? "#ECE9DF" : "#1FB54A"}
        hover={{ backgroundColor: on ? "#FFFFFF" : "#27CC57" }}
      >
        <Text fontSize={20} fontWeight="bold" color="#0E0F0D">
          {on ? "Stop" : "Play"}
        </Text>
      </Container>
      <Text fontSize={20} color="#ECE9DF">
        {tempo === null ? "-- BPM" : `${Math.round(tempo)} BPM`}
      </Text>
    </Container>
  )
}
