"use client"

import { Container, Text } from "@react-three/uikit"
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@react-three/uikit-default"

const C = { panel: "#15171E", row: "#1B1E27", border: "#323745", text: "#EEF0F4", muted: "#9AA0AD", accent: "#9FE7D2", onAccent: "#06221B" }

const STATS = [
  ["Tempo", "92 BPM"],
  ["Key", "D minor"],
  ["Tracks", "8"],
]

type Props = { title?: string; description?: string; buttonLabel?: string; onPress?: () => void }

/** Content card with header, stat rows and an action button (uikit default kit). `onPress` fires on the button. */
export default function KitCard({
  title = "Night Session",
  description = "Ambient set · last edited 2 hours ago",
  buttonLabel = "Open session",
  onPress,
}: Props) {
  return (
    <Card pixelSize={0.002} width={360} borderRadius={16} backgroundColor={C.panel} borderColor={C.border} color={C.text}>
      <CardHeader>
        <CardTitle>
          <Text>{title}</Text>
        </CardTitle>
        <CardDescription color={C.muted}>
          <Text>{description}</Text>
        </CardDescription>
      </CardHeader>
      <CardContent flexDirection="column" gap={4}>
        {STATS.map(([k, v]) => (
          <Container key={k} flexDirection="row" justifyContent="space-between" paddingY={8} paddingX={12} borderRadius={8} backgroundColor={C.row}>
            <Text fontSize={14} color={C.muted}>
              {k}
            </Text>
            <Text fontSize={14}>{v}</Text>
          </Container>
        ))}
      </CardContent>
      <CardFooter>
        <Button
          onClick={() => onPress?.()}
          flexGrow={1}
          height={44}
          backgroundColor={C.accent}
          hover={{ backgroundColor: "#B5EEDD" }}
          color={C.onAccent}
        >
          <Text>{buttonLabel}</Text>
        </Button>
      </CardFooter>
    </Card>
  )
}
