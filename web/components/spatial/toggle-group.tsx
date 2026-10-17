"use client"

import { useState } from "react"
import { Container, Text } from "@react-three/uikit"
import { ToggleGroup as KitToggleGroup, ToggleGroupItem } from "@react-three/uikit-default"

const C = { panel: "#15171E", row: "#1B1E27", hover: "#262A35", border: "#323745", text: "#EEF0F4", muted: "#9AA0AD", accent: "#9FE7D2", onAccent: "#06221B" }

type Props = { value?: string; onChange?: (v: string) => void; label?: string; options?: string }

/** Single-select toggle row (uikit default kit). `options` is comma-separated; `value` is the pressed option. Controlled or uncontrolled. */
export default function ToggleGroup({ value, onChange, label = "Grid snap", options = "Off, 1 cm, 5 cm, 10 cm" }: Props) {
  const opts = options.split(",").map((s) => s.trim()).filter(Boolean)
  const [inner, setInner] = useState(opts[2] ?? opts[0] ?? "")
  const v = value ?? inner
  const set = (o: string) => {
    if (value === undefined) setInner(o)
    onChange?.(o)
  }

  return (
    <Container
      pixelSize={0.002}
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
      <KitToggleGroup size="lg" padding={4} borderRadius={12} backgroundColor={C.row}>
        {opts.map((o) => {
          const on = o === v
          return (
            <ToggleGroupItem
              key={o}
              checked={on}
              onCheckedChange={() => set(o)}
              minWidth={56}
              backgroundColor={on ? C.accent : undefined}
              color={on ? C.onAccent : C.text}
              hover={{ backgroundColor: on ? C.accent : C.hover }}
            >
              <Text fontSize={14} fontWeight="medium">
                {o}
              </Text>
            </ToggleGroupItem>
          )
        })}
      </KitToggleGroup>
    </Container>
  )
}
