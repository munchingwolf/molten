"use client"

import { Text } from "@react-three/uikit"
import { Alert as KitAlert, AlertDescription, AlertIcon, AlertTitle } from "@react-three/uikit-default"
import { Info, TriangleAlert } from "@react-three/uikit-lucide"

const C = { row: "#1B1E27", border: "#323745", text: "#EEF0F4", muted: "#9AA0AD", accent: "#9FE7D2", danger: "#F2555A" }

type Props = { title?: string; description?: string; variant?: "default" | "destructive" }

/** Inline notice with icon, title and description (uikit default kit). */
export default function Alert({
  title = "Unpublished changes",
  description = "You have edits in this layout that others can't see yet. Publish to share them.",
  variant = "default",
}: Props) {
  const danger = variant === "destructive"
  const tone = danger ? C.danger : C.accent
  return (
    <KitAlert
      pixelSize={0.002}
      width={400}
      variant={variant}
      backgroundColor={C.row}
      borderColor={danger ? C.danger : C.border}
      color={C.text}
    >
      <AlertIcon color={tone}>{danger ? <TriangleAlert width={18} height={18} /> : <Info width={18} height={18} />}</AlertIcon>
      <AlertTitle color={danger ? C.danger : C.text}>
        <Text>{title}</Text>
      </AlertTitle>
      <AlertDescription color={C.muted}>
        <Text>{description}</Text>
      </AlertDescription>
    </KitAlert>
  )
}
