"use client"

import { Container, Text } from "@react-three/uikit"

const SIZES = { sm: 16, md: 24, lg: 36 }

type Props = { text?: string; size?: "sm" | "md" | "lg" }

/** 3D title text. */
export default function Label({ text = "Section title", size = "md" }: Props) {
  return (
    <Container pixelSize={0.002} flexDirection="column" alignItems="center">
      <Text fontSize={SIZES[size]} fontWeight="semi-bold" color="#EEF0F4">
        {text}
      </Text>
    </Container>
  )
}
