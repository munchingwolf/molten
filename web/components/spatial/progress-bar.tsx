"use client"

import { Container, Text } from "@react-three/uikit"
import { Progress, type VanillaProgress } from "@react-three/uikit-default"

const C = { panel: "#15171E", border: "#323745", text: "#EEF0F4", muted: "#9AA0AD", accent: "#9FE7D2" }

// The fill bar is internal to the kit and only follows the global theme.
const tint = (el: VanillaProgress | null) => el?.fill.setProperties({ backgroundColor: C.accent })

type Props = { value?: number; label?: string }

/** Labelled progress bar (uikit default kit). `value` is 0–1. Display only. */
export default function ProgressBar({ value = 0.62, label = "Exporting mixdown" }: Props) {
  const v = Math.min(1, Math.max(0, value))
  return (
    <Container
      pixelSize={0.002}
      width={360}
      flexDirection="column"
      padding={20}
      gap={10}
      borderRadius={16}
      borderWidth={1}
      borderColor={C.border}
      backgroundColor={C.panel}
      color={C.text}
    >
      <Container flexDirection="row" justifyContent="space-between">
        <Text fontSize={14}>{label}</Text>
        <Text fontSize={14} color={C.muted}>
          {`${Math.round(v * 100)}%`}
        </Text>
      </Container>
      <Progress ref={tint} value={v * 100} height={10} backgroundColor={C.border} />
    </Container>
  )
}
