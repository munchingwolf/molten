"use client"

import { useEffect, useState } from "react"
import * as Tone from "tone"
import { Container, Text } from "@react-three/uikit"

type Props = { playing?: boolean; onChange?: (playing: boolean) => void; bpm?: number }

/** Play/Stop for the global Tone transport, with a kick on every beat. Controlled via `playing`, or uncontrolled. */
export default function Transport({ playing, onChange, bpm = 120 }: Props) {
  const [inner, setInner] = useState(false)
  const on = playing ?? inner

  useEffect(() => {
    Tone.getTransport().bpm.value = bpm
  }, [bpm])

  useEffect(() => {
    const kick = new Tone.MembraneSynth().toDestination()
    const id = Tone.getTransport().scheduleRepeat((time) => kick.triggerAttackRelease("C1", "8n", time), "4n")
    return () => {
      Tone.getTransport().clear(id)
      kick.dispose()
    }
  }, [])

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
        {`${bpm} BPM`}
      </Text>
    </Container>
  )
}
