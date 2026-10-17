"use client"

import { Container, Text } from "@react-three/uikit"
import { Avatar as KitAvatar } from "@react-three/uikit-default"

const C = { panel: "#15171E", border: "#323745", text: "#EEF0F4", muted: "#9AA0AD", accent: "#9FE7D2" }

type Props = { name?: string; role?: string; src?: string; online?: boolean }

/** Profile chip: round avatar image, name, role and presence dot (uikit default kit). No `src` uses a generated portrait seeded by name. */
export default function Avatar({ name = "Maya Chen", role = "Sound designer", src, online = true }: Props) {
  return (
    <Container
      pixelSize={0.002}
      flexDirection="row"
      alignItems="center"
      gap={14}
      paddingY={12}
      paddingLeft={12}
      paddingRight={20}
      borderRadius={999}
      borderWidth={1}
      borderColor={C.border}
      backgroundColor={C.panel}
      color={C.text}
    >
      <Container width={48} height={48}>
        <KitAvatar
          src={src || `https://api.dicebear.com/9.x/lorelei/png?seed=${encodeURIComponent(name)}`}
          width={48}
          height={48}
          borderRadius={24}
          backgroundColor={C.border}
        />
        <Container
          positionType="absolute"
          positionRight={0}
          positionBottom={0}
          width={14}
          height={14}
          borderRadius={7}
          borderWidth={2}
          borderColor={C.panel}
          backgroundColor={online ? C.accent : C.muted}
        />
      </Container>
      <Container flexDirection="column" gap={2}>
        <Text fontSize={15} fontWeight="medium">
          {name}
        </Text>
        <Text fontSize={13} color={C.muted}>
          {`${role} · ${online ? "online" : "away"}`}
        </Text>
      </Container>
    </Container>
  )
}
