"use client"

import { useState } from "react"
import { Container, Text } from "@react-three/uikit"
import { Switch as KitSwitch, type VanillaSwitch } from "@react-three/uikit-default"

const C = { panel: "#15171E", hover: "#262A35", border: "#323745", text: "#EEF0F4", muted: "#9AA0AD", accent: "#9FE7D2" }

// The thumb is internal to the kit and only follows the global theme.
const tint = (el: VanillaSwitch | null) => el?.handle.setProperties({ backgroundColor: C.text })

type Props = { value?: boolean; onChange?: (v: boolean) => void; label?: string; description?: string }

/** Labelled on/off switch (uikit default kit). The whole row is the hit target. Controlled via `value`, or uncontrolled. */
export default function Switch({ value, onChange, label = "Hand tracking", description = "Use your hands instead of controllers" }: Props) {
  const [inner, setInner] = useState(true)
  const v = value ?? inner
  const toggle = () => {
    if (value === undefined) setInner(!v)
    onChange?.(!v)
  }

  return (
    <Container
      pixelSize={0.002}
      width={360}
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      gap={16}
      padding={16}
      minHeight={64}
      borderRadius={16}
      borderWidth={1}
      borderColor={C.border}
      backgroundColor={C.panel}
      hover={{ backgroundColor: C.hover }}
      cursor="pointer"
      color={C.text}
      onClick={toggle}
    >
      <Container flexDirection="column" gap={2} flexShrink={1}>
        <Text fontSize={15} fontWeight="medium">
          {label}
        </Text>
        <Text fontSize={13} color={C.muted}>
          {description}
        </Text>
      </Container>
      {/* The kit switch is only 24 px tall, so the row takes the clicks and the switch just shows state. */}
      <KitSwitch ref={tint} checked={v} pointerEvents="none" backgroundColor={v ? C.accent : C.border} />
    </Container>
  )
}
