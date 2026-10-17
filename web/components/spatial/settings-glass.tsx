"use client"

import { Container, Text, withOpacity } from "@react-three/uikit"
import { Slider, Switch } from "@react-three/uikit-default"

// Built on uikit 1.0 core: uikit-apfel (the Vision Pro kit) is pinned to uikit 0.8 and can't share a scene with 1.0 kits.
export default function SettingsGlass() {
  return (
    <Container
      pixelSize={0.002}
      width={360}
      flexDirection="column"
      gap={20}
      padding={28}
      borderRadius={32}
      backgroundColor={withOpacity("white", 0.14)}
      borderWidth={1.5}
      borderColor={withOpacity("white", 0.35)}
    >
      <Container flexDirection="column" gap={4}>
        <Text fontSize={22} fontWeight="semi-bold" color="white">
          Settings
        </Text>
        <Text fontSize={13} color={withOpacity("white", 0.7)}>
          Sound and feel
        </Text>
      </Container>
      <Row label="Master volume">
        <Slider defaultValue={70} max={100} width={150} />
      </Row>
      <Row label="Reverb">
        <Slider defaultValue={30} max={100} width={150} />
      </Row>
      <Row label="Tempo">
        <Slider defaultValue={120} min={60} max={180} width={150} />
      </Row>
      <Row label="Haptics">
        <Switch defaultChecked />
      </Row>
    </Container>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Container
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      padding={12}
      borderRadius={18}
      backgroundColor={withOpacity("white", 0.08)}
    >
      <Text fontSize={14} color="white">
        {label}
      </Text>
      {children}
    </Container>
  )
}
