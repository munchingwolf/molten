"use client"

import { Container, Text } from "@react-three/uikit"
import { Textarea as KitTextarea, type VanillaTextarea } from "@react-three/uikit-default"

const C = { panel: "#15171E", row: "#1B1E27", border: "#323745", text: "#EEF0F4", muted: "#9AA0AD" }

// The placeholder is an internal kit Text that only follows the global theme.
const tint = (el: VanillaTextarea | null) => el?.placeholder.setProperties({ color: C.muted })

type Props = { value?: string; onChange?: (v: string) => void; label?: string; placeholder?: string }

/** Labelled multi-line text box (uikit default kit). Controlled via `value`, or uncontrolled. */
export default function Textarea({ value, onChange, label = "Scene notes", placeholder = "What happens in this scene?" }: Props) {
  return (
    <Container
      pixelSize={0.002}
      width={380}
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
      <KitTextarea
        ref={tint}
        // The kit forwards these to its inner input at runtime, but its typings omit them.
        {...({
          value,
          defaultValue: "Warm pad enters at bar 17. Keep the hats dry until the drop, then open the filter over 8 bars.",
          onValueChange: (v: string) => onChange?.(v),
        } as object)}
        placeholder={placeholder}
        height={120}
        backgroundColor={C.row}
        borderColor={C.border}
      />
    </Container>
  )
}
