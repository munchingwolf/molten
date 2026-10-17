"use client"

import { useState } from "react"
import { Text } from "@react-three/drei"

type Props = {
  text?: string
  color?: string
  /** Letter height in metres */
  fontSize?: number
  /** Wrap width in metres (0 = no wrap) */
  maxWidth?: number
}

/** Crisp SDF text (drei <Text>) with a soft outline so it reads on any background. Hover highlights it. */
export default function TextLabel({ text = "Hello, space", color = "#EEF0F4", fontSize = 0.04, maxWidth = 0 }: Props) {
  const [hover, setHover] = useState(false)
  return (
    <Text
      fontSize={fontSize}
      maxWidth={maxWidth || undefined}
      color={hover ? "#9FE7D2" : color}
      anchorX="center"
      anchorY="middle"
      textAlign="center"
      outlineWidth={fontSize * 0.06}
      outlineColor="#15171E"
      outlineBlur={fontSize * 0.15}
      outlineOpacity={0.8}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      {text}
    </Text>
  )
}
