"use client"

import type { ReactNode } from "react"
import { Container, Text, withOpacity } from "@react-three/uikit"

type Props = { title?: string; children?: ReactNode; width?: number }

// Built on uikit 1.0 core: uikit-apfel (the Vision Pro kit) is pinned to uikit 0.8 and can't share a scene with 1.0 kits.
/** Frosted glass backplate that groups content. `width` is in uikit px (360 px = 72 cm). Children must be uikit elements. */
export default function GlassCard({ title = "Glass card", children, width = 360 }: Props) {
  return (
    <Container
      pixelSize={0.002}
      width={width}
      flexDirection="column"
      gap={16}
      padding={24}
      borderRadius={28}
      backgroundColor={withOpacity("#15171E", 0.6)}
      borderWidth={1.5}
      borderColor={withOpacity("#EEF0F4", 0.22)}
    >
      <Text fontSize={20} fontWeight="semi-bold" color="#EEF0F4">
        {title}
      </Text>
      {children ?? (
        <Container padding={14} borderRadius={16} backgroundColor={withOpacity("#1B1E27", 0.7)}>
          <Text fontSize={14} color="#9AA0AD">
            Drop content here
          </Text>
        </Container>
      )}
    </Container>
  )
}
