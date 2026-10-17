"use client"

import { Container, Text } from "@react-three/uikit"
import { Input as KitInput } from "@react-three/uikit-default"

const C = { panel: "#15171E", row: "#1B1E27", border: "#323745", text: "#EEF0F4", muted: "#9AA0AD", accent: "#9FE7D2" }

type Props = { value?: string; onChange?: (v: string) => void; label?: string; placeholder?: string }

/** Labelled single-line text field (uikit default kit). Controlled via `value`, or uncontrolled. */
export default function Input({ value, onChange, label = "Project name", placeholder = "Untitled scene" }: Props) {
  return (
    <Container
      pixelSize={0.002}
      width={340}
      flexDirection="column"
      padding={20}
      gap={8}
      borderRadius={16}
      borderWidth={1}
      borderColor={C.border}
      backgroundColor={C.panel}
      color={C.text}
    >
      <Text fontSize={13} color={C.muted}>
        {label}
      </Text>
      <KitInput
        value={value}
        defaultValue="Night Session"
        onValueChange={(v) => onChange?.(v)}
        placeholder={placeholder}
        height={44}
        fontSize={15}
        backgroundColor={C.row}
        borderColor={C.border}
        focus={{ borderColor: C.accent }}
        placeholderStyle={{ color: C.muted }}
      />
    </Container>
  )
}
