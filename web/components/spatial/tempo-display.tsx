"use client"

import { useEffect, useState } from "react"
import * as Tone from "tone"
import { Container, Text } from "@react-three/uikit"

type Props = { value?: number; label?: string }

/** Big BPM readout. Shows `value`, or follows the global Tone transport when `value` is not set. */
export default function TempoDisplay({ value, label = "Tempo" }: Props) {
  const [polled, setPolled] = useState(() => Tone.getTransport().bpm.value)

  useEffect(() => {
    if (value !== undefined) return
    const id = setInterval(() => setPolled(Tone.getTransport().bpm.value), 250)
    return () => clearInterval(id)
  }, [value])

  const bpm = value ?? polled

  return (
    <Container
      pixelSize={0.002}
      flexDirection="column"
      alignItems="center"
      padding={16}
      minWidth={140}
      backgroundColor="#1A1B18"
      borderRadius={16}
    >
      <Text fontSize={12} color="#A3A49D">
        {label}
      </Text>
      <Container flexDirection="row" alignItems="flex-end" gap={6}>
        <Text fontSize={48} fontWeight="bold" color="#ECE9DF">
          {Number.isFinite(bpm) ? `${Math.round(bpm)}` : "--"}
        </Text>
        <Text fontSize={14} color="#A3A49D" marginBottom={10}>
          BPM
        </Text>
      </Container>
    </Container>
  )
}
