"use client"

import { Container, Text } from "@react-three/uikit"
import { RadioGroup as KitRadioGroup, RadioGroupItem, type VanillaRadioGroupItem } from "@react-three/uikit-default"

const C = { panel: "#15171E", hover: "#262A35", border: "#323745", text: "#EEF0F4", muted: "#9AA0AD", accent: "#9FE7D2" }

// The ring and dot are internal to the kit item and only take the global theme, so recolor them directly.
const tint = (el: VanillaRadioGroupItem | null) => {
  el?.radioButton.setProperties({ borderColor: C.accent })
  el?.radioDot.setProperties({ backgroundColor: C.accent })
}

type Props = { value?: string; onChange?: (v: string) => void; label?: string; options?: string }

/** Single-choice list (uikit default kit). `options` is comma-separated; `value` is the chosen option. Controlled or uncontrolled. */
export default function RadioGroup({ value, onChange, label = "Render quality", options = "Draft, Balanced, High" }: Props) {
  const opts = options.split(",").map((s) => s.trim()).filter(Boolean)
  return (
    <Container
      pixelSize={0.002}
      width={320}
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
      <KitRadioGroup
        value={value}
        defaultValue={opts[Math.min(1, opts.length - 1)]}
        onValueChange={(v) => onChange?.(v ?? "")}
        gap={4}
      >
        {opts.map((o) => (
          <RadioGroupItem key={o} ref={tint} value={o} height={44} paddingX={12} gap={12} borderRadius={10} hover={{ backgroundColor: C.hover }}>
            <Text fontSize={15}>{o}</Text>
          </RadioGroupItem>
        ))}
      </KitRadioGroup>
    </Container>
  )
}
