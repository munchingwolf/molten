"use client"

import { Text } from "@react-three/uikit"
import { Button } from "@react-three/uikit-default"

type Variant = "default" | "secondary" | "outline" | "ghost" | "destructive"

// Night-studio colors per kit variant: [background, hover background, text, border].
const LOOK: Record<Variant, [string | undefined, string, string, string | undefined]> = {
  default: ["#9FE7D2", "#B5EEDD", "#06221B", undefined],
  secondary: ["#1B1E27", "#262A35", "#EEF0F4", undefined],
  outline: ["#15171E", "#262A35", "#EEF0F4", "#323745"],
  ghost: [undefined, "#262A35", "#EEF0F4", undefined],
  destructive: ["#F2555A", "#FF6B70", "#FFFFFF", undefined],
}

type Props = { label?: string; variant?: Variant; size?: "default" | "lg"; disabled?: boolean; onPress?: () => void }

/** Text button (uikit default kit) in five variants. `onPress` fires on click, poke or pinch. */
export default function KitButton({ label = "Publish", variant = "default", size = "lg", disabled = false, onPress }: Props) {
  const [bg, hover, fg, border] = LOOK[variant] ?? LOOK.default
  return (
    <Button
      pixelSize={0.002}
      variant={variant}
      size={size}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onPress?.()
      }}
      minHeight={44}
      minWidth={96}
      backgroundColor={bg}
      hover={{ backgroundColor: disabled ? bg : hover }}
      color={fg}
      borderColor={border}
    >
      <Text>{label}</Text>
    </Button>
  )
}
